-- ============================================================================
-- Migration 020: Notification & Activity Permissions Seed
-- ------------------------------------------------------------------------
-- Sprint 14 — registers activity.read and confirms notifications.manage
-- (permissionRegistry.js's ACTIVITY_READ / NOTIFICATIONS_MANAGE keys) in
-- the `permissions` table and grants them to roles, following the same
-- clone-from-existing-grant pattern used in migrations 015/018.
--
-- IMPORTANT PRE-EXISTING GAP THIS MIGRATION CLOSES:
-- NOTIFICATIONS_MANAGE ("notifications.manage") has existed in
-- permissionRegistry.js since before this sprint, but was never
-- seeded into `permissions` or granted to any role in any prior
-- migration (confirmed via grep across backend/migrations/ and
-- backend/src/) — meaning any existing authorize(PERMISSIONS.NOTIFICATIONS_MANAGE)
-- call site would 403 for every single role today. This migration
-- seeds it for the first time, on the assumption it's meant to gate
-- "Organization Announcement" broadcast creation (Sprint 14's one
-- notification type an admin creates directly rather than the system
-- generating it) — Organization Admin only, same tier as holidays.manage.
--
-- activity.read grant anchors (Sprint 14 RBAC table):
--   "Organization Admin — View organization activity.
--    Managers — View department/team notifications.
--    Employees — View only their own notifications."
--   Read access to the activity_feed endpoint itself is granted broadly
--   (Employee/Manager/HR/Admin, cloned from departments.read, same
--   anchor migration 018 used for holidays.read) — the RBAC table's
--   distinction between Admin/Manager/Employee is about SCOPE of what
--   rows they see (all vs. dept vs. own), which activityService.js
--   enforces at the query level (mirroring calendarAggregationService.js's
--   resolveLeaveScope pattern from Sprint 13), not about who can hit the
--   endpoint at all.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Register the two permission keys
-- ----------------------------------------------------------------------------

INSERT INTO permissions (key, description)
VALUES
  ('activity.read', 'View organization activity feed, scoped by role (Sprint 14)'),
  ('notifications.manage', 'Create organization-wide announcement notifications — Organization Admin only (Sprint 14)')
ON CONFLICT (key) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Clone grants from departments.read -> activity.read
-- ----------------------------------------------------------------------------
-- Broad endpoint access; row-level scoping (all/dept/own) is enforced
-- in activityService.js, not here — same split calendarAggregationService.js
-- already established for holidays.read + role-scoped leave visibility.

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, activity_read.id
FROM role_permissions rp
JOIN permissions dept_read ON dept_read.id = rp.permission_id AND dept_read.key = 'departments.read'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'activity.read') AS activity_read
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. Clone grants from departments.manage -> notifications.manage
-- ----------------------------------------------------------------------------
-- Organization Admin only, same anchor migration 018 used for
-- holidays.manage — broadcasting an organization announcement is an
-- admin action, not a manager/employee one.

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, notif_manage.id
FROM role_permissions rp
JOIN permissions dept_manage ON dept_manage.id = rp.permission_id AND dept_manage.key = 'departments.manage'
CROSS JOIN (SELECT id FROM permissions WHERE key = 'notifications.manage') AS notif_manage
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- Manual verification notes:
-- 1. Run against a staging copy first.
-- 2. SELECT r.key, p.key FROM role_permissions rp JOIN roles r ON
--    r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
--    WHERE p.key IN ('activity.read', 'notifications.manage')
--    ORDER BY r.key, p.key;
--    -> confirm activity.read landed broadly and notifications.manage
--    landed ONLY on the Admin role.
-- 3. Same caveat as 015/018: if departments.read/departments.manage
--    are granted more/less broadly than expected in this specific
--    deployment's seeded roles table, these new permissions inherit
--    that same breadth — re-check and manually adjust if so.
-- ============================================================================
