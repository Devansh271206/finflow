/**
 * Dashboard Role Map
 * ------------------------------------------------------------------
 * Sprint 10 — Role-Based Dashboard System (PRD §15.9-15.11).
 *
 * Maps a resolved membership's `roleKey` (req.membership.roleKey, set by
 * resolveWorkspace.js from roles.key — see membershipRepository.js) to
 * exactly one of the six dashboard variants this sprint implements:
 *
 *   executive | finance | hr | operations | dept_lead | employee
 *
 * This is the ONLY place that decision is made. roleDashboardController.js
 * calls resolveDashboardRole() to pick which roleDashboardService.js
 * function to call; the frontend's Dashboard.jsx reads the same `role`
 * value back from the API response (GET /api/dashboard/role-summary)
 * rather than re-deriving it from roleKey itself, so there is exactly one
 * mapping in the whole system, not two that could drift apart.
 *
 * WHY THIS NEEDS TO BE CASE/SPELLING-TOLERANT (not just a straight
 * Set.has() on one casing):
 * This codebase's own role-key checks are already inconsistent between
 * files — membershipService.js's ADMIN_ROLE_KEY/FINANCE_OPS_ROLE_KEY
 * constants are lowercase ("admin", "finance_ops"), matching what
 * roleRepository actually seeds, while approvalService.js and the
 * (now-fixed) leaveRequestController.js check uppercase ("ADMIN",
 * "FINANCE", "DEPARTMENT_LEAD"). Rather than add a seventh inconsistent
 * checker here, every comparison below is case-insensitive and accepts
 * both the underscore ("finance_ops") and separate-role ("FINANCE")
 * spellings, plus OWNER/FOUNDER as synonyms for the workspace creator —
 * the same synonym set leaveRequestController.js's isFullApprover()
 * already had to add for the identical reason.
 *
 * Unknown/missing roleKey resolves to "employee" — the least-privileged
 * dashboard — never to a more powerful one; a membership that failed to
 * resolve a role should never default into seeing Executive/Finance data.
 */

const DASHBOARD_ROLES = Object.freeze({
  EXECUTIVE: "executive",
  FINANCE: "finance",
  HR: "hr",
  OPERATIONS: "operations",
  DEPT_LEAD: "dept_lead",
  EMPLOYEE: "employee",
});

// Every known real/spec spelling of each role key, normalized to
// uppercase for comparison. Add new synonyms here only — never add a
// new ad-hoc roleKey check anywhere else in the codebase.
const ROLE_KEY_TO_DASHBOARD = {
  ADMIN: DASHBOARD_ROLES.EXECUTIVE,
  OWNER: DASHBOARD_ROLES.EXECUTIVE,
  FOUNDER: DASHBOARD_ROLES.EXECUTIVE,
  ORGANIZATION_ADMIN: DASHBOARD_ROLES.EXECUTIVE,
  EXECUTIVE: DASHBOARD_ROLES.EXECUTIVE,

  FINANCE: DASHBOARD_ROLES.FINANCE,
  // finance_ops is this workspace's actual seeded combined Finance+Ops
  // role (membershipService.js's FINANCE_OPS_ROLE_KEY) — it lands on the
  // Finance dashboard by default since Finance is the more data-dense of
  // the two; Operations widgets (vendors.read-gated) are still reachable
  // via the Operations dashboard route for the same membership, since
  // widget-level visibility is permission-gated, not role-gated, in
  // roleDashboardController.js.
  FINANCE_OPS: DASHBOARD_ROLES.FINANCE,

  HR: DASHBOARD_ROLES.HR,
  HUMAN_RESOURCES: DASHBOARD_ROLES.HR,

  OPERATIONS: DASHBOARD_ROLES.OPERATIONS,
  OPS: DASHBOARD_ROLES.OPERATIONS,

  DEPARTMENT_LEAD: DASHBOARD_ROLES.DEPT_LEAD,
  DEPT_LEAD: DASHBOARD_ROLES.DEPT_LEAD,
  MANAGER: DASHBOARD_ROLES.DEPT_LEAD,

  EMPLOYEE: DASHBOARD_ROLES.EMPLOYEE,
  MEMBER: DASHBOARD_ROLES.EMPLOYEE,
};

/**
 * Resolve a membership's roleKey to one of the six DASHBOARD_ROLES
 * values. Never throws — an unrecognized or missing roleKey safely
 * falls back to "employee" (least-privileged dashboard).
 */
function resolveDashboardRole(roleKey) {
  const normalized = String(roleKey || "").trim().toUpperCase();
  return ROLE_KEY_TO_DASHBOARD[normalized] || DASHBOARD_ROLES.EMPLOYEE;
}

module.exports = { DASHBOARD_ROLES, resolveDashboardRole };
