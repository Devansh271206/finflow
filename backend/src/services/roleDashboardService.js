/**
 * Role Dashboard Service
 * ------------------------------------------------------------------
 * Sprint 10 — Role-Based Dashboard System (PRD §15.9-15.11).
 *
 * One function per dashboard variant from dashboardRoleMap.js's
 * DASHBOARD_ROLES. Every function here is composition only — it calls
 * existing services/repositories and reshapes their output into the
 * widget groups the PRD lists for that role. No new business logic,
 * no new tables, no new Supabase queries beyond the two small additive
 * repository/service functions this sprint already added
 * (transactionRepository.listForWorkspace, payrollService.listOwnPayslips)
 * to fill genuine gaps — everything else already existed.
 *
 * This file is deliberately NOT the place that decides which function
 * to call for a given membership — see roleDashboardController.js,
 * which uses dashboardRoleMap.js's resolveDashboardRole() for that.
 *
 * Resilience: every section is fetched through settle() below rather
 * than a bare Promise.all — one section throwing (e.g. a Dept Lead
 * membership with no department assigned, or a permission grant that
 * isn't set up for a non-standard role) degrades that one widget to
 * its empty fallback instead of 500-ing the entire dashboard. Errors
 * are still logged so a real bug doesn't go silent.
 */

const employeeService = require("./employeeService");
const departmentService = require("./departmentService");
const teamService = require("./teamService");
const budgetService = require("./budgetService");
const payrollService = require("./payrollService");
const leaveRequestService = require("./leaveRequestService");
const leaveBalanceService = require("./leaveBalanceService");
const vendorRepository = require("../repositories/vendorRepository");
const transactionRepository = require("../repositories/transactionRepository");
const departmentRepository = require("../repositories/departmentRepository");
const employeeRepository = require("../repositories/employeeRepository");

/**
 * Runs a promise, swallowing any rejection and logging it, returning
 * `fallback` instead. Used so one widget's data source failing doesn't
 * take down the rest of the dashboard.
 */
async function settle(promise, fallback) {
  try {
    return await promise;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roleDashboardService] widget section failed:", err.message);
    return fallback;
  }
}

function sumAmount(rows) {
  return (rows || []).reduce((total, row) => total + Number(row.amount || 0), 0);
}

/** First-of-month..today, as YYYY-MM-DD strings, for "this month" KPIs. */
function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const toStr = now.toISOString().slice(0, 10);
  const fromStr = from.toISOString().slice(0, 10);
  return { from: fromStr, to: toStr };
}

const RECENT_TRANSACTIONS_LIMIT = 200; // see monthlyExpenseTotal() note below

/**
 * Sums this month's expense transactions across the whole workspace.
 * Caveat: transactionRepository.listForWorkspace caps at 200 rows per
 * call (same cap listForUser already had) and Supabase's JS client has
 * no server-side SUM, so this sums the first 200 matching rows for the
 * month rather than a true unbounded total — the same JS-aggregation
 * tradeoff budgetRepository.computeSpendForBudgets and
 * vendorRepository.getSpendByVendor already make elsewhere in this
 * codebase. Fine for a dashboard KPI; not meant for financial close.
 */
async function monthlyExpenseTotal(workspaceId, extraFilters = {}) {
  const { from, to } = currentMonthRange();
  const { rows, count } = await transactionRepository.listForWorkspace(workspaceId, {
    type: "expense",
    from,
    to,
    limit: RECENT_TRANSACTIONS_LIMIT,
    ...extraFilters,
  });
  return { total: sumAmount(rows), transactionCount: count };
}

function aggregateBudgetUtilization(budgets) {
  const totalLimit = budgets.reduce((sum, b) => sum + Number(b.limit || 0), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent || 0), 0);
  return {
    totalLimit,
    totalSpent,
    remaining: Math.max(totalLimit - totalSpent, 0),
    utilization: totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0,
  };
}

/**
 * Employees whose join-date anniversary falls within the next
 * `withinDays` days. date_of_joining exists on every employee (unlike
 * date_of_birth, which doesn't — see the birthdays placeholder below),
 * so this one's actually computable, just not something any existing
 * function already did.
 */
function computeUpcomingAnniversaries(employees, withinDays = 30) {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cutoff = new Date(todayMidnight.getTime() + withinDays * 24 * 60 * 60 * 1000);

  return employees
    .filter((e) => e.date_of_joining)
    .map((e) => {
      const joined = new Date(`${e.date_of_joining}T00:00:00`);
      let anniversary = new Date(today.getFullYear(), joined.getMonth(), joined.getDate());
      if (anniversary < todayMidnight) {
        anniversary = new Date(today.getFullYear() + 1, joined.getMonth(), joined.getDate());
      }
      return {
        employeeId: e.id,
        fullName: e.full_name,
        anniversaryDate: anniversary.toISOString().slice(0, 10),
        yearsOfService: anniversary.getFullYear() - joined.getFullYear(),
      };
    })
    .filter((a) => new Date(a.anniversaryDate) <= cutoff)
    .sort((a, b) => new Date(a.anniversaryDate) - new Date(b.anniversaryDate));
}

// ------------------------------------------------------------------
// Executive Dashboard
// ------------------------------------------------------------------
async function getExecutiveDashboard(workspaceId) {
  const [
    totalEmployees,
    activeEmployees,
    departments,
    teams,
    budgets,
    payroll,
    pendingLeave,
    monthlyExpenses,
    pendingApprovals,
    vendors,
    renewalRisks,
  ] = await Promise.all([
    settle(employeeService.getEmployeesForWorkspace(workspaceId, { pageSize: 1 }), { total: 0 }),
    settle(
      employeeService.getEmployeesForWorkspace(workspaceId, { status: "active", pageSize: 1 }),
      { total: 0 }
    ),
    settle(departmentService.listDepartments(workspaceId, {}), []),
    settle(teamService.listTeams(workspaceId, {}), []),
    settle(budgetService.getBudgetsForWorkspace(workspaceId, {}), []),
    settle(payrollService.getAggregateSummary(workspaceId, {}), { totalNet: 0, totalBase: 0, recordCount: 0, byDepartment: [] }),
    settle(leaveRequestService.listLeaveRequests(workspaceId, { status: "pending" }), []),
    settle(monthlyExpenseTotal(workspaceId), { total: 0, transactionCount: 0 }),
    settle(
      transactionRepository.listForWorkspace(workspaceId, { approvalStatus: "submitted", limit: 5 }),
      { rows: [], count: 0 }
    ),
    settle(vendorRepository.listByWorkspace(workspaceId), []),
    settle(vendorRepository.findRenewalRisks(workspaceId, 30), []),
  ]);

  return {
    organizationOverview: {
      totalEmployees: totalEmployees.total,
      activeEmployees: activeEmployees.total,
      departmentCount: departments.length,
      teamCount: teams.length,
    },
    budgetUtilization: aggregateBudgetUtilization(budgets),
    monthlyExpenses,
    payrollSummary: payroll,
    pendingApprovals: { count: pendingApprovals.count, recent: pendingApprovals.rows },
    leaveSummary: {
      pendingCount: pendingLeave.length,
      recent: pendingLeave.slice(0, 5),
    },
    vendorSummary: {
      totalVendors: vendors.length,
      activeVendors: vendors.filter((v) => v.is_active).length,
      renewalRisks,
    },
    recentActivity: buildRecentActivity(pendingApprovals.rows, pendingLeave),
  };
}

// ------------------------------------------------------------------
// Finance Dashboard
// ------------------------------------------------------------------
async function getFinanceDashboard(workspaceId) {
  const [budgets, monthlyExpenses, recentTransactions, pendingApprovals, vendorSpend, payroll] =
    await Promise.all([
      settle(budgetService.getBudgetsForWorkspace(workspaceId, {}), []),
      settle(monthlyExpenseTotal(workspaceId), { total: 0, transactionCount: 0 }),
      settle(transactionRepository.listForWorkspace(workspaceId, { limit: 10 }), { rows: [], count: 0 }),
      settle(
        transactionRepository.listForWorkspace(workspaceId, { approvalStatus: "submitted", limit: 10 }),
        { rows: [], count: 0 }
      ),
      settle(vendorRepository.getSpendByVendor(workspaceId), []),
      settle(payrollService.getAggregateSummary(workspaceId, {}), { totalNet: 0, totalBase: 0, recordCount: 0, byDepartment: [] }),
    ]);

  const utilization = aggregateBudgetUtilization(budgets);

  return {
    budgetUtilization: utilization,
    monthlyExpenses,
    recentTransactions: recentTransactions.rows,
    pendingExpenseApprovals: { count: pendingApprovals.count, recent: pendingApprovals.rows },
    vendorPayments: vendorSpend.sort((a, b) => b.total - a.total).slice(0, 5),
    payrollSummary: payroll,
    financialKPIs: {
      monthlyExpenses: monthlyExpenses.total,
      budgetUtilization: utilization.utilization,
      pendingApprovalCount: pendingApprovals.count,
      totalPayrollNet: payroll.totalNet,
    },
  };
}

// ------------------------------------------------------------------
// HR Dashboard
// ------------------------------------------------------------------
async function getHRDashboard(workspaceId) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [totalEmployees, activeEmployees, pendingLeave, approvedLeaveStartingByToday, recentJoinees, activeEmployeeList] =
    await Promise.all([
      settle(employeeService.getEmployeesForWorkspace(workspaceId, { pageSize: 1 }), { total: 0 }),
      settle(
        employeeService.getEmployeesForWorkspace(workspaceId, { status: "active", pageSize: 1 }),
        { total: 0 }
      ),
      settle(leaveRequestService.listLeaveRequests(workspaceId, { status: "pending" }), []),
      // No single existing filter covers "on leave today" (listLeaveRequests
      // only range-filters on start_date, not end_date) — narrow to
      // approved requests that have already started, then finish the
      // "hasn't ended yet" check in JS, same embedded-filter pattern
      // leaveRequestRepository already uses for department scoping.
      settle(
        leaveRequestService.listLeaveRequests(workspaceId, {
          status: "approved",
          start_date_to: todayStr,
        }),
        []
      ),
      settle(
        employeeService.getEmployeesForWorkspace(workspaceId, {
          status: "active",
          sortBy: "date_of_joining",
          sortOrder: "desc",
          pageSize: 5,
        }),
        { items: [] }
      ),
      settle(
        employeeService.getEmployeesForWorkspace(workspaceId, { status: "active", pageSize: 100 }),
        { items: [] }
      ),
    ]);

  const onLeaveToday = approvedLeaveStartingByToday.filter((r) => r.end_date >= todayStr);

  return {
    employeeCount: { total: totalEmployees.total, active: activeEmployees.total },
    leaveRequests: { pendingCount: pendingLeave.length, recent: pendingLeave.slice(0, 5) },
    employeesOnLeaveToday: onLeaveToday,
    // No date_of_birth column exists on employees (see employeeRepository
    // SELECT_COLUMNS) — birthdays aren't computable yet. Explicit
    // placeholder rather than silently omitting the widget.
    upcomingBirthdays: { available: false, items: [] },
    upcomingAnniversaries: computeUpcomingAnniversaries(activeEmployeeList.items, 30),
    recentJoinees: recentJoinees.items,
  };
}

// ------------------------------------------------------------------
// Operations Dashboard
// ------------------------------------------------------------------
async function getOperationsDashboard(workspaceId) {
  const [vendors, renewalRisks, vendorSpend] = await Promise.all([
    settle(vendorRepository.listByWorkspace(workspaceId), []),
    settle(vendorRepository.findRenewalRisks(workspaceId, 30), []),
    settle(vendorRepository.getSpendByVendor(workspaceId), []),
  ]);

  const recentVendorActivity = [...vendors]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  return {
    vendorOverview: {
      totalVendors: vendors.length,
      activeVendors: vendors.filter((v) => v.is_active).length,
      subscriptionVendors: vendors.filter((v) => v.is_subscription).length,
    },
    subscriptionRenewals: renewalRisks,
    // No procurement module exists yet (out of scope per the PRD, which
    // explicitly allows a placeholder here).
    procurementSummary: { available: false, items: [] },
    costOptimization: vendorSpend.sort((a, b) => b.total - a.total).slice(0, 5),
    recentVendorActivity,
  };
}

// ------------------------------------------------------------------
// Department Lead Dashboard
// ------------------------------------------------------------------
async function getDeptLeadDashboard(workspaceId, departmentId) {
  if (!departmentId) {
    // A Dept Lead membership with no department assigned yet — degrade
    // to empty widgets rather than throwing (this can legitimately
    // happen right after a role change, before an admin assigns them).
    return {
      departmentAssigned: false,
      departmentEmployees: { total: 0, items: [] },
      teamOverview: [],
      pendingLeaveRequests: { count: 0, recent: [] },
      pendingExpenseRequests: { count: 0, recent: [] },
      departmentBudget: aggregateBudgetUtilization([]),
    };
  }

  const [department, employees, teams, pendingLeave, pendingExpenses, budgets] = await Promise.all([
    settle(departmentRepository.findByIdInWorkspace(departmentId, workspaceId), null),
    settle(
      employeeService.getEmployeesForWorkspace(workspaceId, {
        departmentId,
        status: "active",
        pageSize: 100,
      }),
      { total: 0, items: [] }
    ),
    settle(teamService.listTeams(workspaceId, { departmentId }), []),
    settle(
      leaveRequestService.listLeaveRequests(workspaceId, { department_id: departmentId, status: "pending" }),
      []
    ),
    settle(
      transactionRepository.listForWorkspace(workspaceId, {
        departmentId,
        approvalStatus: "submitted",
        limit: 10,
      }),
      { rows: [], count: 0 }
    ),
    settle(budgetService.getBudgetsForWorkspace(workspaceId, { departmentId }), []),
  ]);

  return {
    departmentAssigned: true,
    department,
    departmentEmployees: { total: employees.total, items: employees.items },
    teamOverview: teams,
    pendingLeaveRequests: { count: pendingLeave.length, recent: pendingLeave.slice(0, 5) },
    pendingExpenseRequests: { count: pendingExpenses.count, recent: pendingExpenses.rows },
    departmentBudget: aggregateBudgetUtilization(budgets),
  };
}

// ------------------------------------------------------------------
// Employee Dashboard
// ------------------------------------------------------------------
async function getEmployeeDashboard(workspaceId, employeeId, actorUserId) {
  if (!employeeId) {
    // Callers with no employee record in this workspace (e.g. an admin
    // account created before any employee profile existed) — same
    // graceful-degradation approach as the Dept Lead case above.
    return {
      hasEmployeeRecord: false,
      profile: null,
      leaveBalance: [],
      myLeaveRequests: [],
      myExpenseRequests: [],
      myPayslips: [],
      companyAnnouncements: { available: false, items: [] },
      upcomingHolidays: { available: false, items: [] },
    };
  }

  const [profile, leaveBalance, myLeaveRequests, myExpenseRequests, myPayslips] = await Promise.all([
    settle(employeeRepository.findByIdInWorkspace(employeeId, workspaceId), null),
    settle(leaveBalanceService.getEmployeeBalances(employeeId, workspaceId, {}), []),
    settle(leaveRequestService.listLeaveRequests(workspaceId, { employee_id: employeeId }), []),
    settle(
      transactionRepository.listForWorkspace(workspaceId, { employeeId, limit: 10 }),
      { rows: [], count: 0 }
    ),
    settle(payrollService.listOwnPayslips(employeeId, workspaceId, actorUserId), []),
  ]);

  return {
    hasEmployeeRecord: true,
    profile,
    leaveBalance,
    myLeaveRequests: myLeaveRequests.slice(0, 5),
    myExpenseRequests: myExpenseRequests.rows,
    myPayslips: myPayslips.slice(0, 5),
    // Neither has a backing table yet (holiday_calendar was explicitly
    // deferred out of Sprint 9's leave management scope; announcements
    // don't exist anywhere) — placeholders per the PRD's own allowance.
    companyAnnouncements: { available: false, items: [] },
    upcomingHolidays: { available: false, items: [] },
  };
}

/**
 * Merges pending expense approvals and pending leave requests into one
 * "recent activity" feed for the Executive dashboard, newest first.
 * Both inputs are already sorted newest-first by their own repository
 * (transactions by transaction_date, leave requests by submitted_at) —
 * this just interleaves the two small slices rather than re-deriving
 * a sort key neither table shares.
 */
function buildRecentActivity(recentTransactions, recentLeaveRequests) {
  const activity = [
    ...recentTransactions.slice(0, 5).map((t) => ({
      type: "transaction",
      id: t.id,
      title: t.title,
      amount: t.amount,
      date: t.transaction_date,
    })),
    ...recentLeaveRequests.slice(0, 5).map((r) => ({
      type: "leave_request",
      id: r.id,
      status: r.status,
      date: r.submitted_at,
    })),
  ];
  return activity
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
}

module.exports = {
  getExecutiveDashboard,
  getFinanceDashboard,
  getHRDashboard,
  getOperationsDashboard,
  getDeptLeadDashboard,
  getEmployeeDashboard,
};
