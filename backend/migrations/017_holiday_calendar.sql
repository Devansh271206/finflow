-- ============================================================================
-- Migration 017: Holiday Calendar
-- ------------------------------------------------------------------------
-- Sprint 13 — creates the `holiday_calendar` table designed in PRD §15.16
-- ("Holiday Calendar (organization-configured public/company holidays,
-- excluded from leave-day counting)") but explicitly deferred at Sprint 9
-- time. Confirmed absent from the shipped schema:
--   - leaveRequestService.js: "Holiday-calendar / working-day exclusion is
--     out of Sprint 9 scope (holiday_calendar table isn't built yet)"
--   - roleDashboardService.js: upcomingHolidays: { available: false, items: [] }
--
-- Column set follows the PRD's base definition (id, workspace_id, name,
-- date, is_recurring_annual) extended with the fields Sprint 13 explicitly
-- asks for (description, type) plus standard audit/timestamp columns
-- already used by every other table in this codebase (created_by,
-- created_at, updated_at — see e.g. leave_types from migration 014).
--
-- `type` distinguishes "public" (national/regional statutory holidays)
-- from "organization" (company-specific closures), matching Sprint 13's
-- Part 2 requirement to support both. Kept as a CHECK-constrained text
-- column rather than a separate lookup table, consistent with how
-- leave_requests.status and similar small enums are modeled elsewhere in
-- this schema (see leave_requests status column, migration 014).
--
-- Depends on: workspaces (migration 001), auth.users (Supabase-managed).
-- ============================================================================

CREATE TABLE IF NOT EXISTS holiday_calendar (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  date               DATE NOT NULL,
  description        TEXT,
  type               TEXT NOT NULL DEFAULT 'organization'
                       CHECK (type IN ('public', 'organization')),
  is_recurring_annual BOOLEAN NOT NULL DEFAULT false,
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary access pattern: "give me all holidays for workspace X within a
-- date range" (calendar month/week/day/agenda views, leave-day exclusion
-- checks). A composite index on (workspace_id, date) covers both the
-- plain listing case and range-bounded queries efficiently.
CREATE INDEX IF NOT EXISTS idx_holiday_calendar_workspace_date
  ON holiday_calendar (workspace_id, date);

-- Recurring-holiday lookups (e.g. "does this org already have a recurring
-- Independence Day entry") filter on workspace + recurring flag before
-- touching date, so a second narrower index avoids a full-column scan on
-- larger installations.
CREATE INDEX IF NOT EXISTS idx_holiday_calendar_workspace_recurring
  ON holiday_calendar (workspace_id, is_recurring_annual)
  WHERE is_recurring_annual = true;

COMMENT ON TABLE holiday_calendar IS
  'Workspace-scoped public/organization holidays (PRD §15.16, Sprint 13). Recurring rows (is_recurring_annual = true) represent an annual pattern anchored on the stored date''s month/day; single-instance overrides for one year are handled at the application layer per PRD v2.4''s calendar edge-case note, not by mutating the recurring row.';
COMMENT ON COLUMN holiday_calendar.type IS
  'public = national/regional statutory holiday; organization = company-specific closure. Drives calendar color-coding (red vs blue) per Sprint 13 color scheme.';
COMMENT ON COLUMN holiday_calendar.is_recurring_annual IS
  'When true, the calendar aggregation layer projects this holiday onto every year using the stored date''s month/day, matching PRD v2.4''s recurring-event edge case.';

-- Manual verification notes:
-- 1. Run against a staging copy first, same caution as prior migrations.
-- 2. INSERT a sample row per workspace and confirm
--    SELECT * FROM holiday_calendar WHERE workspace_id = '<id>'
--    ORDER BY date; returns it.
-- 3. Confirm ON DELETE CASCADE behavior is acceptable (deleting a
--    workspace removes its holidays) — consistent with how leave_types
--    and other workspace-scoped tables behave in this schema.
-- ============================================================================
