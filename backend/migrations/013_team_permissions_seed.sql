-- ============================================================================
-- Migration 013: Team Permissions Seed
-- ------------------------------------------------------------------------
-- Sprint 8 — registers teams.read / teams.manage (permissionRegistry.js's
-- new TEAMS_READ / TEAMS_MANAGE keys) in the `permissions` table and
-- grants them to roles, so authorize() (which resolves grants via
-- role_permissions, NOT permissionRegistry.js directly — see
-- roleRepository.getPermissionKeysForRole) actually allows anyone
-- through on the new /api/teams routes.
--
-- Depends on: permissions, role_permissions, roles (all already shipped
-- — the seeding migration that originally populated them, referenced
-- throughout this codebase as "migration 001", predates the migrations
-- included in this repository snapshot and was not available to
-- inspect from the authoring environment).
--
-- Because the exact role keys in this workspace's `roles` table could
-- not be confirmed (role key casing is inconsistent even across this
-- codebase's own source — compare approvalService.js's "ADMIN"/
-- "DEPARTMENT_LEAD" to membershipService.js's "finance_ops"), this
-- migration deliberately does NOT hardcode role keys. Instead it grants
-- teams.read to every role that already holds departments.read, and
-- teams.manage to every role that already holds departments.manage —
-- correct by construction per PRD §15.20 ("teams... first-class module
-- with the same depth as Departments"), and self-correcting if roles
-- are renamed later, since it isn't tied to a specific key string.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Register the two new permission keys
-- ----------------------------------------------------------------------------
-- Assumes permissions.key has a unique constraint (every existing
-- permission — departments.read, employees.manage, etc. — was seeded
-- the same way; ON CONFLICT here is a no-op safety net if this
-- migration is ever re-run).

INSERT INTO permissions (key, description)
VALUES
  ('teams.read', 'Read access to teams (PRD §15.20 Team Management)'),
  ('teams.manage', 'Create/edit teams, assign Team Lead, manage team members (PRD §15.20)')
ON CONFLICT (key) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Clone grants from departments.read -> teams.read
-- ----------------------------------------------------------------------------

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, teams_read.id
FROM role_permissions rp
JOIN permissions dept_read ON dept_read.id = rp.permission_id AND dept_read.key = 'departments.read'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'teams.read') AS teams_read
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. Clone grants from departments.manage -> teams.manage
-- ----------------------------------------------------------------------------

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, teams_manage.id
FROM role_permissions rp
JOIN permissions dept_manage ON dept_manage.id = rp.permission_id AND dept_manage.key = 'departments.manage'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'teams.manage') AS teams_manage
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- Manual verification notes (could not be run from the authoring
-- environment — no live Postgres connection available there):
--
-- 1. Run against a staging copy first, same caution as every prior
--    migration in this project.
-- 2. Confirm role_permissions has a UNIQUE or PRIMARY KEY constraint on
--    (role_id, permission_id) — if it doesn't, the ON CONFLICT clauses
--    above will error, not silently no-op, and need to be replaced
--    with an explicit NOT EXISTS guard instead.
-- 3. SELECT r.key, p.key FROM role_permissions rp JOIN roles r ON
--    r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
--    WHERE p.key IN ('teams.read','teams.manage') ORDER BY 1,2;
--    -> confirm this exactly mirrors the same query with
--    'departments.read','departments.manage' (same role set on both
--    sides), which is the intended outcome of steps 2-3 above.
-- 4. If a Department Lead's teams.manage grant needs to be scoped to
--    "own department only" at the database/RLS level rather than only
--    in application code (teamController.js currently enforces this
--    at the controller layer, same pattern as employeeController.js's
--    existing Department Lead scoping) — that's a larger RLS policy
--    change out of Sprint 8's scope, left as a Future Enhancement.
-- ============================================================================