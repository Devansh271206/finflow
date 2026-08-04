-- ============================================================================
-- Migration 015: Leave Management Permissions Seed
-- ------------------------------------------------------------------------
-- Sprint 9 — registers leave.read / leave.manage / leave.approve
-- (permissionRegistry.js's new LEAVE_READ / LEAVE_MANAGE / LEAVE_APPROVE
-- keys) in the `permissions` table and grants them to roles, so
-- authorize() (which resolves grants via role_permissions, NOT
-- permissionRegistry.js directly — see roleRepository.getPermissionKeysForRole)
-- actually allows anyone through on the new /api/leave-* routes.
--
-- Depends on: permissions, role_permissions, roles (all already shipped —
-- same caveat as 013_team_permissions_seed.sql: the original seeding
-- migration, referenced throughout this codebase as "migration 001",
-- predates the migrations included in this repository snapshot and was
-- not available to inspect from the authoring environment).
--
-- Same limitation 013 documented applies here: exact role keys in this
-- workspace's `roles` table could not be confirmed (role key casing is
-- inconsistent even across this codebase's own source — compare
-- approvalService.js's "ADMIN"/"DEPARTMENT_LEAD"/"FINANCE" to
-- membershipService.js's "finance_ops"). This migration deliberately
-- does NOT hardcode role keys, for the same reason 013 didn't.
--
-- Grant anchors chosen (PRD §15.16 RBAC: "Employee — own leave only...
-- Department Lead — approve/reject for own department... HR — approval
-- override, full leave CRUD... Organization Admin — full... Finance/
-- Operations — no leave access"):
--
--   - leave.read / leave.manage -> cloned from departments.read grants.
--     This is broader than the PRD's literal RBAC line (it also reaches
--     Finance/Operations, who already hold departments.read per
--     migration 001/013's own precedent), because there is no existing
--     permission key in this codebase that is granted to Employee +
--     Dept Lead + HR + Admin while excluding Finance/Operations — every
--     role that can read Departments already reads broadly. If precise
--     exclusion of Finance/Operations from Leave is required, HR/Admin
--     should manually revoke these two grants from that specific role
--     row post-migration (same caveat as 013's own admitted limitation,
--     not something this migration can safely automate without
--     confirmed role keys).
--   - leave.approve -> cloned from approvals.act grants (the existing
--     "who can approve/reject things" permission, already used for
--     Expense approvals per migration 009) — a defensible proxy for
--     "who has approval authority" until a leave-specific role mapping
--     is confirmed.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Register the three new permission keys
-- ----------------------------------------------------------------------------
-- Assumes permissions.key has a unique constraint (every existing
-- permission was seeded the same way; ON CONFLICT here is a no-op
-- safety net if this migration is ever re-run).

INSERT INTO permissions (key, description)
VALUES
  ('leave.read', 'Read access to leave types, balances, and requests (PRD §15.16 Leave Management)'),
  ('leave.manage', 'Create/edit leave types (HR/Admin) and submit/edit/cancel own leave requests (PRD §15.16)'),
  ('leave.approve', 'Approve/reject leave requests — Department Lead (own department, first stage) or HR/Admin (override) (PRD §15.16)')
ON CONFLICT (key) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Clone grants from departments.read -> leave.read
-- ----------------------------------------------------------------------------

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, leave_read.id
FROM role_permissions rp
JOIN permissions dept_read ON dept_read.id = rp.permission_id AND dept_read.key = 'departments.read'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'leave.read') AS leave_read
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. Clone grants from departments.read -> leave.manage
-- ----------------------------------------------------------------------------
-- Every role that can see Departments can at least submit/manage its
-- own leave requests; leave TYPE CRUD is additionally gated at the
-- service layer to HR/Admin only (leaveTypeService.js does not check
-- role directly today — see that file's NEXT FILE follow-up note if
-- stricter server-side role gating beyond the permission table is
-- needed, since role key strings couldn't be confirmed here).

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, leave_manage.id
FROM role_permissions rp
JOIN permissions dept_read ON dept_read.id = rp.permission_id AND dept_read.key = 'departments.read'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'leave.manage') AS leave_manage
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 4. Clone grants from approvals.act -> leave.approve
-- ----------------------------------------------------------------------------

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, leave_approve.id
FROM role_permissions rp
JOIN permissions approvals_act ON approvals_act.id = rp.permission_id AND approvals_act.key = 'approvals.act'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'leave.approve') AS leave_approve
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- Manual verification notes:
--
-- 1. Run against a staging copy first, same caution as 013/014.
-- 2. SELECT r.key, p.key FROM role_permissions rp JOIN roles r ON
--    r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
--    WHERE p.key LIKE 'leave.%' ORDER BY r.key, p.key; -> confirm the
--    expected roles (and, per the header note above, decide whether
--    Finance/Operations' resulting leave.read/leave.manage grants
--    should be manually revoked to match PRD §15.16 exactly).
-- 3. Confirm authorize(PERMISSIONS.LEAVE_READ) on GET /api/leave-types
--    now returns 200 (not 403) for a Department Lead or Employee
--    membership.
-- ============================================================================