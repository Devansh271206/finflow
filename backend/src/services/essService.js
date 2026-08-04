/**
 * Employee Self-Service (ESS) Portal — Overview Aggregator
 * ------------------------------------------------------------------
 * Sprint 13. This service does NOT introduce new business logic or
 * new tables. It purely composes calls into the already-existing
 * Employee / Leave / Payroll services (and a notifications read that
 * mirrors notificationController.js, which has no service layer of
 * its own) so the Overview tab can render from a single request
 * instead of 4-5 parallel round trips from the client.
 *
 * Every downstream call already scopes to "own record" — see
 * employeeRepository.findByUserIdInWorkspace, leaveBalanceService.
 * getEmployeeSummary, and payrollService.listOwnPayslips — so no
 * additional access-control logic is needed here beyond resolving
 * which employee row belongs to the caller.
 */

const employeeRepository = require("../repositories/employeeRepository");
const employeeService = require("./employeeService");
const leaveBalanceService = require("./leaveBalanceService");
const leaveRequestService = require("./leaveRequestService");
const payrollService = require("./payrollService");
const { supabaseAdmin } = require("../config/supabase");
const ApiError = require("../utils/ApiError");

const RECENT_NOTIFICATIONS_LIMIT = 5;

/**
 * Resolves the employee record for the authenticated user within the
 * active workspace. Thrown as 404 rather than silently returning null
 * so essController can surface a clear "no employee record" state
 * distinct from a generic empty overview.
 */
async function resolveOwnEmployee(userId, workspaceId) {
  const employee = await employeeRepository.findByUserIdInWorkspace(userId, workspaceId);
  if (!employee) {
    throw new ApiError(
      404,
      "No employee record is linked to your account yet. Contact your admin."
    );
  }
  return employee;
}

/**
 * Best-effort recent notifications + unread count for the Overview
 * tab's notification preview. Mirrors notificationController.
 * getNotifications() exactly (same table/columns), kept inline since
 * that controller has no service layer to import from.
 */
async function getNotificationSummary(userId, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(RECENT_NOTIFICATIONS_LIMIT);

  if (error) {
    // Non-fatal for the overview — surfaced as an empty section rather
    // than failing the whole aggregator.
    return { recent: [], unreadCount: 0 };
  }

  const unreadCount = (data || []).filter((n) => !n.is_read).length;
  return { recent: data || [], unreadCount };
}

/**
 * Composes the full "My Portal" Overview payload for the authenticated
 * employee: profile summary, employment snapshot, leave balance
 * summary + pending request count, latest payslip, and a notification
 * preview.
 */
async function getMyOverview(userId, workspaceId) {
  const ownRecord = await resolveOwnEmployee(userId, workspaceId);

  const [employee, leaveBalances, leaveRequests, payslips, notifications] = await Promise.all([
    employeeService.getEmployee(ownRecord.id, workspaceId),
    leaveBalanceService.getEmployeeSummary(ownRecord.id, workspaceId).catch(() => []),
    leaveRequestService
      .listLeaveRequests(workspaceId, { employee_id: ownRecord.id })
      .catch(() => []),
    payrollService.listOwnPayslips(ownRecord.id, workspaceId, userId).catch(() => []),
    getNotificationSummary(userId, workspaceId),
  ]);

  const pendingLeaveRequests = (Array.isArray(leaveRequests) ? leaveRequests : []).filter(
    (r) => r.status === "pending" || r.status === "dept_approved"
  );

  const latestPayslip = (payslips || [])
    .slice()
    .sort((a, b) => {
      if (a.pay_period_year !== b.pay_period_year) return b.pay_period_year - a.pay_period_year;
      return b.pay_period_month - a.pay_period_month;
    })[0] || null;

  return {
    employee,
    employment: {
      employeeCode: employee.employee_code ?? employee.employeeCode,
      designation: employee.designation,
      departmentId: employee.department_id ?? employee.departmentId,
      reportingManagerId: employee.reporting_manager_id ?? employee.reportingManagerId,
      dateOfJoining: employee.date_of_joining ?? employee.dateOfJoining,
      employmentType: employee.employment_type ?? employee.employmentType,
      employmentStatus: employee.employment_status ?? employee.employmentStatus,
    },
    leave: {
      balances: leaveBalances,
      pendingRequestsCount: pendingLeaveRequests.length,
      recentRequests: (Array.isArray(leaveRequests) ? leaveRequests : []).slice(0, 5),
    },
    payroll: {
      latestPayslip,
      recordCount: (payslips || []).length,
    },
    notifications,
  };
}

module.exports = {
  resolveOwnEmployee,
  getMyOverview,
};
