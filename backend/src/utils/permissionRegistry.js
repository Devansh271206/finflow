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
});

module.exports = { PERMISSIONS };