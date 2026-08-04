-- ============================================================================
-- Migration 018: Calendar & Holiday Permissions Seed
-- ------------------------------------------------------------------------
-- Sprint 13 — registers holidays.read / holidays.manage / calendar.configure
-- (permissionRegistry.js's new HOLIDAYS_READ / HOLIDAYS_MANAGE /
-- CALENDAR_CONFIGURE keys) in the `permissions` table and grants them to
-- roles, so authorize() (which resolves grants via role_permissions, NOT
-- permissionRegistry.js directly — see roleRepository.getPermissionKeysForRole)
-- actually allows anyone through on the new /api/holidays and
-- /api/calendar/* routes.
--
-- Depends on: permissions, role_permissions, roles (all already shipped).
-- Same caveat migrations 013/015 documented applies here: exact role keys
-- in this workspace's `roles` table could not be confirmed from the
-- authoring environment (role key casing is inconsistent even across this
-- codebase's own source). This migration deliberately does NOT hardcode
-- role keys, cloning grants from existing permissions instead, same as
-- 013 and 015 did.
--
-- Grant anchors chosen (Sprint 13 RBAC spec, from the sprint brief itself):
--   "Organization Admin — Manage Holidays, Configure Calendar.
--    Managers — View Team Leave, Approve Leave.
--    Employees — View Calendar, View Holidays, View Their Leave."
--
--   - holidays.read / calendar (view) -> cloned from departments.read
--     grants, same anchor migration 015 used for leave.read, since
--     "every role that can read Departments already reads broadly" is
--     still true here and there is no tighter existing "Employee+"
--     permission to clone from without hand-confirmed role keys.
--   - holidays.manage -> cloned from departments.manage grants (Admin-only
--     tier in this codebase, per departmentController.js's existing
--     authorize(PERMISSIONS.DEPARTMENTS_MANAGE) usage), matching the
--     sprint brief's "Organization Admin only" requirement for holiday
--     CRUD far more precisely than departments.read would.
--   - calendar.configure -> cloned from workspace.update grants (the
--     existing "who can change workspace-level settings" permission,
--     already Admin-gated via workspaceController.updateWorkspace's route),
--     matching "Configure Calendar" being an Organization Admin action.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Register the three new permission keys
-- ----------------------------------------------------------------------------
-- Assumes permissions.key has a unique constraint (every existing
-- permission was seeded the same way; ON CONFLICT here is a no-op safety
-- net if this migration is ever re-run).

INSERT INTO permissions (key, description)
VALUES
  ('holidays.read', 'View public/organization holidays on the enterprise calendar (Sprint 13)'),
  ('holidays.manage', 'Create/edit/delete public and organization holidays — Organization Admin only (Sprint 13)'),
  ('calendar.configure', 'Configure organization calendar settings (working days, weekend config) — Organization Admin only (Sprint 13)')
ON CONFLICT (key) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Clone grants from departments.read -> holidays.read
-- ----------------------------------------------------------------------------
-- Broad view access: Employees, Managers, HR, and Admin all need to see
-- the calendar per the sprint brief's RBAC table.

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, holidays_read.id
FROM role_permissions rp
JOIN permissions dept_read ON dept_read.id = rp.permission_id AND dept_read.key = 'departments.read'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'holidays.read') AS holidays_read
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. Clone grants from departments.manage -> holidays.manage
-- ----------------------------------------------------------------------------
-- departments.manage is already restricted to Organization Admin in this
-- codebase (departmentController.js gates create/update/delete routes with
-- it), making it the correct narrow anchor for "Manage Holidays" per the
-- sprint brief — unlike departments.read (used above), which is
-- deliberately broad.

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, holidays_manage.id
FROM role_permissions rp
JOIN permissions dept_manage ON dept_manage.id = rp.permission_id AND dept_manage.key = 'departments.manage'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'holidays.manage') AS holidays_manage
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 4. Clone grants from workspace.update -> calendar.configure
-- ----------------------------------------------------------------------------
-- workspace.update is the existing "workspace-level settings" permission
-- (workspaceController.updateWorkspace's route), already Admin-scoped,
-- making it the correct anchor for "Configure Calendar".

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, calendar_configure.id
FROM role_permissions rp
JOIN permissions ws_update ON ws_update.id = rp.permission_id AND ws_update.key = 'workspace.update'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'calendar.configure') AS calendar_configure
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- Manual verification notes:
--
-- 1. Run against a staging copy first, same caution as 013/014/015.
-- 2. SELECT r.key, p.key FROM role_permissions rp JOIN roles r ON
--    r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
--    WHERE p.key IN ('holidays.read', 'holidays.manage', 'calendar.configure')
--    ORDER BY r.key, p.key; -> confirm holidays.manage/calendar.configure
--    landed ONLY on the Admin role, and holidays.read landed broadly
--    (Employee/Manager/HR/Admin), matching the sprint brief's RBAC table.
-- 3. If departments.manage or workspace.update turn out to be granted
--    more broadly than "Admin only" in this specific deployment's seeded
--    roles table, holidays.manage/calendar.configure will inherit that
--    same breadth — re-check step 2's query and manually revoke from any
--    unexpected role if so, same caveat 015 documented for leave.approve.
-- ============================================================================
