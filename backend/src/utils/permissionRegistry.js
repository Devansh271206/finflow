/**
 * Permission Registry
 * ------------------------------------------------------------------
 * Single source of truth for permission keys used by authorize().
 * Mirrors the `permissions` table seeded in
 * migrations/001_phase1_multitenant.sql — keep both in sync.
 *
 * Keys follow `resource.action` convention (PRD §4/§5 RBAC matrix).
 */

const PERMISSIONS = Object.freeze({
  WORKSPACE_READ: "workspace.read",
  WORKSPACE_UPDATE: "workspace.update",
  WORKSPACE_TRANSFER: "workspace.transfer",
  COMPANY_MANAGE: "company.manage",
  TEAM_INVITE: "team.invite",
  TEAM_MANAGE: "team.manage",
  DEPARTMENTS_MANAGE: "departments.manage",
  DEPARTMENTS_READ: "departments.read",
  EMPLOYEES_MANAGE: "employees.manage",
  EMPLOYEES_READ: "employees.read",
  CATEGORIES_MANAGE: "categories.manage",
  CATEGORIES_READ: "categories.read",
  TRANSACTIONS_CREATE: "transactions.create",
  TRANSACTIONS_READ: "transactions.read",
  TRANSACTIONS_READ_ALL: "transactions.read_all",
  TRANSACTIONS_EDIT: "transactions.edit",
  TRANSACTIONS_DELETE: "transactions.delete",
  BUDGETS_MANAGE: "budgets.manage",
  BUDGETS_READ: "budgets.read",
  BUDGETS_APPROVE: "budgets.approve",
  VENDORS_MANAGE: "vendors.manage",
  VENDORS_READ: "vendors.read",
  APPROVALS_ACT: "approvals.act",
  APPROVALS_SUBMIT: "approvals.submit",
  REVENUE_MANAGE: "revenue.manage",
  DASHBOARD_VIEW: "dashboard.view",
  ANALYTICS_VIEW: "analytics.view",
  AUDIT_READ: "audit.read",
  NOTIFICATIONS_MANAGE: "notifications.manage",
  REPORTS_EXPORT: "reports.export",
  // Sprint 2: salary.read_department is deliberately NOT checked via
  // authorize() anywhere — per PRD §13.3 it is "separately-grantable...
  // not implied by role", so it's only ever checked as a per-membership
  // grant via membershipPermissionGrantService.hasActiveGrant(). It's
  // still defined here (not just as a raw string) so the grantable-key
  // allowlist and the route/service code that reference it share one
  // source of truth, same as every other permission key in this file.
  SALARY_READ_DEPARTMENT: "salary.read_department",
  PERMISSION_GRANTS_MANAGE: "permission_grants.manage",
  // Sprint 5: PRD RBAC row 354 — Create/Edit is Admin+HR only, Finance
  // is NOT included (unlike most finance-adjacent resources where
  // Finance has manage rights). Individual payroll_records row reads
  // are additionally gated by the SAME salary.read_department grant as
  // salary_history (§13.3 groups them together explicitly) — PAYROLL_READ
  // only confirms the caller's ROLE can reach row-level data at all;
  // the grant check happens in payrollService.js, same split as
  // salaryHistoryService.js. PAYROLL_READ_AGGREGATE is the separate,
  // ungated-by-salary-grant permission backing Finance's "aggregate-only"
  // visibility — deliberately a different key, not a weaker check on
  // the same one, so aggregate access can never accidentally imply
  // row-level access.
  PAYROLL_MANAGE: "payroll.manage",
  PAYROLL_READ: "payroll.read",
  PAYROLL_READ_AGGREGATE: "payroll.read_aggregate",
  // Sprint 9: Leave Management (PRD §15.16). LEAVE_READ covers listing/
  // viewing leave types, balances, and requests (Employee = own only,
  // Dept Lead = own department, HR/Admin = all — the "own vs all" split
  // is enforced in leaveRequestService.js/leaveBalanceService.js, not
  // by a separate permission key, same pattern as
  // TRANSACTIONS_READ/TRANSACTIONS_READ_ALL elsewhere in this file).
  // LEAVE_MANAGE covers leave type CRUD (HR/Admin only) and submitting/
  // editing/cancelling one's own leave request. LEAVE_APPROVE is the
  // separate permission gating approve/reject actions (Dept Lead for
  // first-stage, HR for override) — kept distinct from LEAVE_MANAGE so
  // approval authority is never accidentally implied by ordinary
  // submit/manage rights.
  LEAVE_READ: "leave.read",
  LEAVE_MANAGE: "leave.manage",
  LEAVE_APPROVE: "leave.approve",
  // Sprint 13: Enterprise Onboarding & Calendar Experience. HOLIDAYS_READ
  // covers viewing public/organization holidays on the enterprise
  // calendar (Employee/Manager/HR/Admin — broad, same anchor as
  // DEPARTMENTS_READ per migration 018). HOLIDAYS_MANAGE covers
  // holiday CRUD and is deliberately narrower (Organization Admin only,
  // cloned from DEPARTMENTS_MANAGE grants in migration 018) — kept
  // distinct from HOLIDAYS_READ so viewing the calendar never implies
  // the ability to create/edit/delete holidays, same separation-of-
  // concerns pattern as LEAVE_READ vs LEAVE_MANAGE above.
  // CALENDAR_CONFIGURE gates organization-level calendar settings
  // (working days, weekend configuration) — Organization Admin only,
  // cloned from WORKSPACE_UPDATE grants in migration 018.
  HOLIDAYS_READ: "holidays.read",
  HOLIDAYS_MANAGE: "holidays.manage",
  CALENDAR_CONFIGURE: "calendar.configure",
  // Sprint 14: Enterprise Notification Center & Activity Feed.
  // ACTIVITY_READ gates the /api/activity endpoint itself (broad —
  // Employee/Manager/HR/Admin, cloned from DEPARTMENTS_READ per
  // migration 020). The RBAC distinction between Admin (all activity),
  // Manager (department/team activity), and Employee (own activity)
  // is enforced as row-level scoping inside activityService.js, not
  // as separate permission keys — same split HOLIDAYS_READ/HOLIDAYS_MANAGE
  // and calendarAggregationService.js's role-scoped leave visibility
  // already established in Sprint 13. NOTIFICATIONS_MANAGE (above,
  // pre-existing) was never actually seeded into role_permissions
  // until migration 020 — it now correctly gates organization
  // announcement creation, Organization Admin only.
  ACTIVITY_READ: "activity.read",
});

module.exports = { PERMISSIONS };