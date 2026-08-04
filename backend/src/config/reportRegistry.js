/**
 * Report Registry
 * ------------------------------------------------------------------
 * Sprint 11 — Enterprise Reporting & BI Platform (PRD §15.13 / §46.9
 * "Reports" gap-fill entry: "a rendering/export layer over Analytics
 * Service and per-module data, not a separate data model").
 *
 * This is the ONLY place that knows about all 9 reports. reportService.js
 * reads this config to fetch, filter, sort, paginate and export data;
 * reportController.js reads it to know which permission gates which
 * report. Adding a 10th report later means adding one entry here, not
 * a new controller/service/route.
 *
 * Field reference:
 *   id           - URL-safe key, e.g. GET /api/reports/:id
 *   label        - display name
 *   module       - which existing module this reads from (for grouping
 *                  in the UI's ReportsHub)
 *   permission   - PERMISSIONS key required to VIEW this report (reuses
 *                  each module's own *_READ permission — consistent
 *                  with existing per-resource RBAC rather than one
 *                  blanket "reports" permission). Export additionally
 *                  requires REPORTS_EXPORT, checked in the controller.
 *   dataSource   - { repo, method } naming an existing repository
 *                  function. reportService.js resolves these via a
 *                  fixed require map — see the header comment there
 *                  for why this indirection exists (workspace scoping
 *                  is applied uniformly, not per-report).
 *   columns      - [{ key, label, type }] — type drives both frontend
 *                  cell rendering AND CSV formatting. type is one of:
 *                  'text' | 'number' | 'currency' | 'date' | 'badge'.
 *                  Nested keys (e.g. "departments.name") are resolved
 *                  by reportService's row projection step.
 *   filters      - [{ key, label, type }] — type is one of:
 *                  'search' | 'select' | 'dateRange'. 'select' filters
 *                  read their options from the row data itself
 *                  (distinct values) unless `options` is given.
 *   summaryCards - [{ key, label, agg, type }] — agg is 'sum' | 'count' |
 *                  'avg'; computed by reportService over the FILTERED
 *                  (pre-pagination) row set.
 *   defaultSort  - { key, direction }
 *   chart        - { type: 'bar'|'pie'|'line', xKey, yKey } | null
 */

const { PERMISSIONS } = require("../utils/permissionRegistry");

const REPORT_REGISTRY = Object.freeze({
  employees: {
    id: "employees",
    label: "Employee Report",
    module: "employees",
    permission: PERMISSIONS.EMPLOYEES_READ,
    dataSource: { repo: "employeeRepository", method: "listByWorkspace" },
    columns: [
      { key: "employee_code", label: "Employee Code", type: "text" },
      { key: "full_name", label: "Full Name", type: "text" },
      { key: "designation", label: "Designation", type: "text" },
      { key: "departments.name", label: "Department", type: "text" },
      { key: "employment_status", label: "Status", type: "badge" },
      { key: "employment_type", label: "Type", type: "text" },
      { key: "date_of_joining", label: "Date of Joining", type: "date" },
    ],
    filters: [
      { key: "search", label: "Search name / code", type: "search" },
      { key: "department_id", label: "Department", type: "select" },
      { key: "employment_status", label: "Status", type: "select" },
      { key: "date_of_joining", label: "Joined", type: "dateRange" },
    ],
    summaryCards: [
      { key: "id", label: "Total Employees", agg: "count", type: "number" },
    ],
    defaultSort: { key: "full_name", direction: "asc" },
    chart: { type: "pie", xKey: "employment_status", yKey: "count" },
  },

  departments: {
    id: "departments",
    label: "Department Report",
    module: "departments",
    permission: PERMISSIONS.DEPARTMENTS_READ,
    dataSource: { repo: "departmentRepository", method: "listByWorkspace" },
    columns: [
      { key: "name", label: "Department", type: "text" },
      { key: "head.full_name", label: "Head", type: "text" },
      { key: "is_active", label: "Active", type: "badge" },
      { key: "created_at", label: "Created", type: "date" },
    ],
    filters: [
      { key: "search", label: "Search name", type: "search" },
      { key: "is_active", label: "Status", type: "select" },
    ],
    summaryCards: [
      { key: "id", label: "Total Departments", agg: "count", type: "number" },
    ],
    defaultSort: { key: "name", direction: "asc" },
    chart: null,
  },

  teams: {
    id: "teams",
    label: "Team Report",
    module: "teams",
    permission: PERMISSIONS.DEPARTMENTS_READ,
    dataSource: { repo: "teamRepository", method: "listByWorkspace" },
    columns: [
      { key: "name", label: "Team", type: "text" },
      { key: "department.name", label: "Department", type: "text" },
      { key: "lead.full_name", label: "Team Lead", type: "text" },
      { key: "is_active", label: "Active", type: "badge" },
    ],
    filters: [
      { key: "search", label: "Search team", type: "search" },
      { key: "department_id", label: "Department", type: "select" },
    ],
    summaryCards: [
      { key: "id", label: "Total Teams", agg: "count", type: "number" },
    ],
    defaultSort: { key: "name", direction: "asc" },
    // No chart: teamRepository.listByWorkspace() doesn't return a
    // member count (team membership lives on the employees table, not
    // teams — see teamRepository.js header comment), and adding a
    // cross-table count here is out of this sprint's scope. Team
    // roster/headcount reporting can be a follow-up registry entry
    // once teamRepository exposes it.
    chart: null,
  },

  leave: {
    id: "leave",
    label: "Leave Report",
    module: "leave",
    permission: PERMISSIONS.LEAVE_READ,
    dataSource: { repo: "leaveRequestRepository", method: "listByWorkspace" },
    columns: [
      { key: "employee.full_name", label: "Employee", type: "text" },
      { key: "leave_type.name", label: "Leave Type", type: "text" },
      { key: "start_date", label: "Start Date", type: "date" },
      { key: "end_date", label: "End Date", type: "date" },
      { key: "day_count", label: "Days", type: "number" },
      { key: "status", label: "Status", type: "badge" },
    ],
    filters: [
      { key: "search", label: "Search employee", type: "search" },
      { key: "status", label: "Status", type: "select" },
      { key: "leave_type_id", label: "Leave Type", type: "select" },
      { key: "start_date", label: "Date Range", type: "dateRange" },
    ],
    summaryCards: [
      { key: "id", label: "Total Requests", agg: "count", type: "number" },
      { key: "day_count", label: "Total Days Taken", agg: "sum", type: "number" },
    ],
    defaultSort: { key: "start_date", direction: "desc" },
    chart: { type: "bar", xKey: "leave_type.name", yKey: "day_count" },
    // day_count is NOT a stored column on leave_requests (only
    // start_date/end_date/is_half_day are — see
    // leaveRequestRepository.js). reportService derives it per-row
    // from those fields using the same whole-day-inclusive logic as
    // leaveRequestService.computeDayCount, since half-day precision is
    // a display nicety this report doesn't need to reproduce exactly.
    derivedColumns: ["day_count"],
  },

  payroll: {
    id: "payroll",
    label: "Payroll Report",
    module: "payroll",
    permission: PERMISSIONS.PAYROLL_READ_AGGREGATE,
    dataSource: { repo: "payrollRepository", method: "listForWorkspace" },
    // Row-level salary figures (base_salary/net_salary) are only
    // populated by reportService when the caller ALSO holds the
    // separately-grantable SALARY_READ_DEPARTMENT grant — same split
    // enforced by payrollService.js/salaryHistoryService.js (PRD §13.3).
    // Callers without the grant still see this report, just with those
    // two columns blanked, rather than being denied the report outright.
    columns: [
      { key: "employees.full_name", label: "Employee", type: "text" },
      { key: "pay_period_month", label: "Month", type: "number" },
      { key: "pay_period_year", label: "Year", type: "number" },
      { key: "base_salary", label: "Base Salary", type: "currency" },
      { key: "net_salary", label: "Net Salary", type: "currency" },
      { key: "status", label: "Status", type: "badge" },
    ],
    filters: [
      { key: "search", label: "Search employee", type: "search" },
      { key: "pay_period_year", label: "Year", type: "select" },
      { key: "pay_period_month", label: "Month", type: "select" },
    ],
    summaryCards: [
      { key: "id", label: "Total Records", agg: "count", type: "number" },
      { key: "net_salary", label: "Total Net Payout", agg: "sum", type: "currency" },
    ],
    defaultSort: { key: "pay_period_year", direction: "desc" },
    chart: { type: "line", xKey: "pay_period_month", yKey: "net_salary" },
  },

  transactions: {
    id: "transactions",
    label: "Transaction Report",
    module: "transactions",
    permission: PERMISSIONS.TRANSACTIONS_READ_ALL,
    dataSource: { repo: "transactionRepository", method: "listForWorkspace" },
    // transactionRepository.SELECT_COLUMNS is flat (no joined relations)
    // — `category` is already a denormalized text column on the row
    // itself (see categoryAudit note in transactionRepository.js), and
    // there is no vendor-name join, so the Transaction Report shows
    // vendor_id only (raw id, not a name) rather than inventing a join
    // the repository doesn't provide.
    columns: [
      { key: "transaction_date", label: "Date", type: "date" },
      { key: "title", label: "Title", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "transaction_type", label: "Type", type: "badge" },
      { key: "amount", label: "Amount", type: "currency" },
      { key: "approval_status", label: "Approval Status", type: "badge" },
      { key: "payment_status", label: "Payment Status", type: "badge" },
    ],
    filters: [
      { key: "search", label: "Search title", type: "search" },
      { key: "transaction_type", label: "Type", type: "select" },
      { key: "approval_status", label: "Approval Status", type: "select" },
      { key: "category_id", label: "Category", type: "select" },
      { key: "transaction_date", label: "Date Range", type: "dateRange" },
    ],
    summaryCards: [
      { key: "id", label: "Total Transactions", agg: "count", type: "number" },
      { key: "amount", label: "Total Amount", agg: "sum", type: "currency" },
    ],
    defaultSort: { key: "transaction_date", direction: "desc" },
    chart: { type: "bar", xKey: "category", yKey: "amount" },
  },

  budgets: {
    id: "budgets",
    label: "Budget Report",
    module: "budgets",
    permission: PERMISSIONS.BUDGETS_READ,
    dataSource: { repo: "budgetRepository", method: "listByWorkspace" },
    columns: [
      { key: "name", label: "Budget", type: "text" },
      { key: "departments.name", label: "Department", type: "text" },
      { key: "categories.name", label: "Category", type: "text" },
      { key: "allocated_amount", label: "Allocated", type: "currency" },
      { key: "spent_amount", label: "Spent", type: "currency" },
      { key: "remaining_amount", label: "Remaining", type: "currency" },
    ],
    filters: [
      { key: "search", label: "Search budget", type: "search" },
      { key: "department_id", label: "Department", type: "select" },
      { key: "category_id", label: "Category", type: "select" },
    ],
    summaryCards: [
      { key: "allocated_amount", label: "Total Allocated", agg: "sum", type: "currency" },
      { key: "spent_amount", label: "Total Spent", agg: "sum", type: "currency" },
    ],
    defaultSort: { key: "name", direction: "asc" },
    chart: { type: "bar", xKey: "name", yKey: "spent_amount" },
  },

  expenses: {
    id: "expenses",
    label: "Expense Report",
    module: "approvals",
    permission: PERMISSIONS.TRANSACTIONS_READ_ALL,
    // Reuses the SAME transactions table/repository as the Transaction
    // Report, pre-filtered server-side to transaction_type = 'expense'
    // — per PRD §46.9, Reports is "not a separate data model." Kept as
    // its own registry entry (rather than a frontend-only filter on the
    // Transaction Report) because it needs a distinct approval-workflow
    // column set and summary cards.
    dataSource: {
      repo: "transactionRepository",
      method: "listForWorkspace",
      fixedFilters: { transaction_type: "expense" },
    },
    // Same flat-schema caveat as the Transaction Report above — no
    // vendor-name join on transactionRepository, and there is no
    // "current step" column (approval stage is derived at runtime by
    // approvalService.resolveStepForCurrentStatus from approval_status,
    // not stored), so this shows approval_status/payment_status only.
    columns: [
      { key: "transaction_date", label: "Date", type: "date" },
      { key: "title", label: "Title", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "amount", label: "Amount", type: "currency" },
      { key: "approval_status", label: "Approval Status", type: "badge" },
      { key: "payment_status", label: "Payment Status", type: "badge" },
    ],
    filters: [
      { key: "search", label: "Search title", type: "search" },
      { key: "approval_status", label: "Approval Status", type: "select" },
      { key: "transaction_date", label: "Date Range", type: "dateRange" },
    ],
    summaryCards: [
      { key: "id", label: "Total Expenses", agg: "count", type: "number" },
      { key: "amount", label: "Total Amount", agg: "sum", type: "currency" },
    ],
    defaultSort: { key: "transaction_date", direction: "desc" },
    chart: { type: "pie", xKey: "approval_status", yKey: "count" },
  },

  vendors: {
    id: "vendors",
    label: "Vendor Report",
    module: "vendors",
    permission: PERMISSIONS.VENDORS_READ,
    dataSource: { repo: "vendorRepository", method: "listByWorkspace" },
    // total_spend isn't part of listByWorkspace()'s own row shape — it
    // comes from the separate getSpendByVendor() aggregation query
    // (already used by vendorController's analytics endpoint).
    // reportService merges it onto each row by vendor id after the
    // primary fetch, keyed by `mergeKey`/`resultKey` below, rather than
    // duplicating that aggregation SQL here.
    enrichWith: {
      repo: "vendorRepository",
      method: "getSpendByVendor",
      mergeKey: "id",
      resultKey: "total_spend",
    },
    columns: [
      { key: "name", label: "Vendor", type: "text" },
      { key: "is_subscription", label: "Subscription", type: "badge" },
      { key: "billing_cycle", label: "Billing Cycle", type: "text" },
      { key: "next_billing_date", label: "Next Billing", type: "date" },
      { key: "total_spend", label: "Total Spend", type: "currency" },
    ],
    filters: [
      { key: "search", label: "Search vendor", type: "search" },
      { key: "is_subscription", label: "Subscription", type: "select" },
    ],
    summaryCards: [
      { key: "id", label: "Total Vendors", agg: "count", type: "number" },
      { key: "total_spend", label: "Total Spend", agg: "sum", type: "currency" },
    ],
    defaultSort: { key: "name", direction: "asc" },
    chart: { type: "bar", xKey: "name", yKey: "total_spend" },
  },
});

const REPORT_IDS = Object.freeze(Object.keys(REPORT_REGISTRY));

function getReportConfig(reportId) {
  return REPORT_REGISTRY[reportId] || null;
}

module.exports = { REPORT_REGISTRY, REPORT_IDS, getReportConfig };
