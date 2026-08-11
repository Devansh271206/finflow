-- ============================================================================
-- Migration 019: Notifications & Activity Feed
-- ------------------------------------------------------------------------
-- Sprint 14 — Enterprise Notification Center & Activity Feed.
--
-- IMPORTANT PRE-EXISTING GAP THIS MIGRATION CLOSES:
-- The `notifications` table is already live (used by
-- notificationController.js and essService.js), but no migration file
-- for it exists anywhere in backend/migrations/ — it predates the
-- migration-tracked era of this schema. This migration does NOT
-- recreate it (CREATE TABLE IF NOT EXISTS is safe either way, but the
-- ALTER TABLE statements below are what actually matter for an
-- already-live table) — it formalizes and extends the table that's
-- already there.
--
-- Confirmed existing columns (from notificationController.js's insert/
-- select code) were assumed to include title/message/type/is_read —
-- this assumption was WRONG for at least `type` (confirmed by a live
-- "column \"type\" does not exist" error against a real database).
-- essService.js's getNotificationSummary() only ever used .select("*"),
-- so nothing had actually verified these columns pre-existed. Every
-- column below is now added defensively via ADD COLUMN IF NOT EXISTS
-- rather than assumed present — see the corrected block below.
--
-- This migration adds:
--   resource_type, resource_id, action_url  (so a notification can deep
--     link to the record that caused it — e.g. a leave request)
--   a CHECK constraint on `type` covering all 17 Sprint 14 event types
--     PLUS the four legacy free-text values already in use
--     ('info', 'leave', 'payroll', 'expense') so existing rows and any
--     in-flight inserts from the not-yet-updated controller remain
--     valid until eventBusService/notificationService fully replace
--     direct inserts (see NEXT FILEs — controller rewrite comes later
--     in the implementation order, so this constraint must not break
--     the CURRENT code path before that rewrite lands).
--
-- New tables:
--   activity_feed — organization-wide activity timeline (PRD's
--     "Activity Feed" requirement). Deliberately schema-twin to
--     audit_logs (same actor/workspace/resource/metadata shape) per
--     the sprint brief's "Reuse existing Audit Logs wherever possible"
--     instruction, but kept as its OWN table rather than a view over
--     audit_logs because activity_feed needs a `module` facet
--     (Leave / Expense / Payroll / etc.) that audit_logs has no use
--     for, and the two logs deliberately serve different audiences
--     (compliance vs. org-wide visibility) — a shared write path
--     (activityService calling auditLogRepository.record() AS WELL AS
--     its own insert) keeps them in lockstep without forcing one
--     table's shape onto the other's use case.
--
--   notification_preferences — per-user, per-event-type mute toggle.
--     `channel` is included as a column (defaulting to 'in_app') even
--     though this sprint only implements in-app notifications — the
--     brief is silent on email/push, and adding the column now avoids
--     a second migration + backfill if a future sprint adds channels.
--
-- Depends on: workspaces (migration 001), auth.users (Supabase-managed).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Formalize + extend `notifications`
-- ----------------------------------------------------------------------------

-- Safety net only — this table is already live in every real
-- environment. If it somehow doesn't exist (fresh DB bootstrapped from
-- migrations alone with no manual table creation), this creates it
-- with the exact shape notificationController.js already assumes.
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CORRECTION: CREATE TABLE IF NOT EXISTS above is a no-op against an
-- already-live table — it does NOT retroactively add columns to an
-- existing table with a different shape. This migration originally
-- assumed title/message/type/is_read already existed on the live
-- table (inferred from notificationController.js's code, which was
-- never actually verified against the real schema — essService.js's
-- getNotificationSummary() only ever used .select("*"), so nothing
-- confirmed these columns' existence). Confirmed via the reported
-- "column \"type\" does not exist" error that at least `type` was
-- genuinely missing. Every column this migration touches is now
-- explicitly ADD COLUMN IF NOT EXISTS'd, defensively, rather than
-- assumed:
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- title was NOT NULL in this migration's original CREATE TABLE
-- statement; backfill any pre-existing NULL rows before enforcing that
-- constraint, since ADD COLUMN above can't retroactively set NOT NULL
-- on a column that may already have NULL data in it.
UPDATE notifications SET title = 'Notification' WHERE title IS NULL;
ALTER TABLE notifications ALTER COLUMN title SET NOT NULL;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resource_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Drop-and-recreate pattern (rather than a bare ADD CONSTRAINT) so this
-- migration is safely re-runnable if the constraint's value list needs
-- a follow-up tweak later without a brand new migration number.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    -- Sprint 14's 17 defined event types
    'leave_submitted', 'leave_approved', 'leave_rejected',
    'expense_submitted', 'expense_approved', 'expense_rejected',
    'payroll_generated',
    'employee_created', 'employee_updated',
    'department_created', 'team_created',
    'vendor_added',
    'budget_exceeded', 'budget_updated',
    'organization_announcement',
    'holiday_added',
    'report_generated',
    -- Legacy free-text values already in use by the current
    -- notificationController.js / NotificationsTab.jsx bucketing logic.
    -- Kept valid until the controller rewrite (later in this sprint's
    -- file order) fully migrates callers to the typed set above.
    'info', 'leave', 'payroll', 'expense'
  )
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_created
  ON notifications (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_resource
  ON notifications (resource_type, resource_id)
  WHERE resource_id IS NOT NULL;

COMMENT ON COLUMN notifications.type IS
  'One of Sprint 14''s 17 typed events, or a legacy free-text value pending controller migration (see notifications_type_check).';
COMMENT ON COLUMN notifications.action_url IS
  'Optional frontend deep link (e.g. /leave-requests?id=...) so clicking a notification navigates to the source record.';


-- ----------------------------------------------------------------------------
-- 2. Activity Feed
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_feed (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL,
  module        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_workspace_created
  ON activity_feed (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_workspace_module
  ON activity_feed (workspace_id, module, created_at DESC);

COMMENT ON TABLE activity_feed IS
  'Organization-wide activity timeline (Sprint 14). Schema-twin to audit_logs by design — see this migration''s header note on why it is a separate table rather than a view.';
COMMENT ON COLUMN activity_feed.module IS
  'Source module facet for filtering (e.g. Leave, Expense, Payroll, Department, Team, Vendor, Budget, Holiday, Organization) — the one field audit_logs has no equivalent for.';


-- ----------------------------------------------------------------------------
-- 3. Notification Preferences
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  event_type   TEXT NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app')),
  is_enabled   BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, event_type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user
  ON notification_preferences (workspace_id, user_id);

COMMENT ON TABLE notification_preferences IS
  'Per-user mute toggle per event type (Sprint 14). channel is constrained to in_app only this sprint — email/push are out of scope per the sprint brief''s silence on channels, but the column exists now to avoid a future migration + backfill.';
COMMENT ON COLUMN notification_preferences.is_enabled IS
  'Absence of a row for (user, event_type) means enabled by default — notificationService.js only needs to check for an explicit false row, not seed one per user per event type.';

-- ----------------------------------------------------------------------------
-- Manual verification notes:
-- 1. Run against a staging copy first.
-- 2. SELECT conname FROM pg_constraint WHERE conname = 'notifications_type_check';
--    -> confirm it applied.
-- 3. INSERT a row into activity_feed and notification_preferences per
--    workspace, confirm SELECT * ... WHERE workspace_id = '<id>' returns it.
-- 4. Existing notifications rows with type IN ('info','leave','payroll','expense')
--    must still pass the new CHECK constraint — verify with
--    SELECT DISTINCT type FROM notifications; before/after applying.
-- ============================================================================