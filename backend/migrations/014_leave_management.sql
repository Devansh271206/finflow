-- ============================================================================
-- Migration 014: Leave Management
-- ------------------------------------------------------------------------
-- Sprint 9 — Leave Management module (PRD §15.16): leave types, per-
-- employee/per-type balances, leave requests with a two-stage approval
-- workflow (Department Lead -> HR override), and an append-only audit
-- trail mirroring employee_events (Section 11.5).
--
-- Depends on: workspaces, departments, employees (all already shipped —
-- confirmed live schema per 012_department_team_management.sql and
-- employeeRepository.js).
--
-- Scope note (Sprint 9 scope): leave_policies (accrual rules, notice
-- periods, blackout dates), wfh_requests, and holiday_calendar are
-- explicitly PRD §15.16 sub-features but are OUT of Sprint 9 scope per
-- the sprint brief — left as a Future Sprint TODO, not built here.
-- leave_balances.allocated_days is therefore seeded/managed manually
-- (by HR, via PATCH) in Sprint 9; automatic accrual depends on
-- leave_policies and is deferred.
--
-- This migration only ADDS tables/indexes. No existing column,
-- constraint, trigger, or row is modified, renamed, or dropped.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. leave_types
-- ----------------------------------------------------------------------------
-- Table: leave_types (PRD §15.16 database design + §11.10).
-- Configurable per workspace (Casual, Sick, Earned, Unpaid, etc. per the
-- Sprint 9 brief). is_paid mirrors the PRD column list; default_annual_days
-- is the seed value used when a leave_balances row is first created for a
-- new employee/type/period (service-layer concern, not a DB default,
-- consistent with this project's "business rules live in the service
-- layer" convention — see departmentRepository.js header).

CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_paid boolean NOT NULL DEFAULT true,
  default_annual_days numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Leave type name must be unique within its workspace (mirrors
  -- departments' uq_departments_workspace_name convention).
  CONSTRAINT uq_leave_types_workspace_name UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_leave_types_workspace ON leave_types (workspace_id);

CREATE OR REPLACE FUNCTION set_leave_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leave_types_updated_at ON leave_types;
CREATE TRIGGER trg_leave_types_updated_at
  BEFORE UPDATE ON leave_types
  FOR EACH ROW
  EXECUTE FUNCTION set_leave_types_updated_at();


-- ----------------------------------------------------------------------------
-- 2. leave_balances
-- ----------------------------------------------------------------------------
-- Table: leave_balances (PRD §15.16 database design).
-- One row per (employee, leave_type, policy_period). policy_period is a
-- plain text label (e.g. "2026") rather than a FK — leave_policies
-- (which would normally own period definitions) is out of Sprint 9
-- scope, so periods are simple year labels for now; revisit once
-- leave_policies ships.
--
-- used_days and carried_forward_days are numeric to support half-day
-- (AM/PM) granularity per PRD §15.16 ("Half Day Leave"), consistent
-- with leave_requests.is_half_day below.

CREATE TABLE IF NOT EXISTS leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  policy_period text NOT NULL,
  allocated_days numeric(5,2) NOT NULL DEFAULT 0,
  used_days numeric(5,2) NOT NULL DEFAULT 0,
  carried_forward_days numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_leave_balances_employee_type_period
    UNIQUE (employee_id, leave_type_id, policy_period),
  -- used_days must never exceed allocated + carried_forward; enforced
  -- again at the service layer (leaveBalanceService.js) before every
  -- write, but kept here too as a last-line-of-defense invariant.
  CONSTRAINT chk_leave_balances_used_nonneg CHECK (used_days >= 0),
  CONSTRAINT chk_leave_balances_used_within_allocation
    CHECK (used_days <= allocated_days + carried_forward_days)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON leave_balances (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_type ON leave_balances (leave_type_id);

CREATE OR REPLACE FUNCTION set_leave_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leave_balances_updated_at ON leave_balances;
CREATE TRIGGER trg_leave_balances_updated_at
  BEFORE UPDATE ON leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION set_leave_balances_updated_at();


-- ----------------------------------------------------------------------------
-- 3. leave_requests
-- ----------------------------------------------------------------------------
-- Table: leave_requests (PRD §15.16 database design, column list and
-- status enum copied verbatim from the PRD table in Section 11.10/15.16).
--
-- decided_by references employees(id) rather than a raw user id,
-- consistent with employee-centric attribution used elsewhere in this
-- module (e.g. departments.department_head_employee_id). ON DELETE
-- SET NULL so deleting/offboarding the deciding employee never blocks
-- or cascades into historical leave records.

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_half_day boolean NOT NULL DEFAULT false,
  half_day_period text CHECK (half_day_period IN ('AM', 'PM')),
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dept_approved', 'approved', 'rejected', 'cancelled')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_leave_requests_date_order CHECK (end_date >= start_date),
  -- Half-day requests are single-day by definition (PRD §15.16 "AM/PM
  -- granularity") — enforced here rather than only in the service
  -- layer since it's a simple, immutable structural rule.
  CONSTRAINT chk_leave_requests_half_day_single_date
    CHECK (NOT is_half_day OR start_date = end_date),
  CONSTRAINT chk_leave_requests_half_day_period_required
    CHECK (NOT is_half_day OR half_day_period IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_workspace ON leave_requests (workspace_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON leave_requests (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests (status);
-- Supports leaveRequestService.js's conflict-detection query (overlapping
-- date ranges for the same employee among non-terminal statuses).
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_dates
  ON leave_requests (employee_id, start_date, end_date);

CREATE OR REPLACE FUNCTION set_leave_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_leave_requests_updated_at();


-- ----------------------------------------------------------------------------
-- 4. leave_events
-- ----------------------------------------------------------------------------
-- Table: leave_events (PRD §15.16 database design) — append-only audit
-- trail, same pattern as employee_events (Section 11.5): every state
-- change (submitted, dept_approved, approved, rejected, cancelled,
-- edited-while-pending) is recorded here by leaveRequestService.js.
-- No updated_at/trigger — rows are never updated, only inserted.

CREATE TABLE IF NOT EXISTS leave_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_events_request ON leave_events (leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_events_created_at ON leave_events (created_at);


-- ----------------------------------------------------------------------------
-- Manual verification notes (could not be run from the authoring
-- environment — no live Postgres connection available there):
--
-- 1. Run against a staging copy first, same caution as 012/013.
-- 2. Confirm gen_random_uuid() is available — every other table in this
--    project's migrations uses the same default.
-- 3. Insert a leave_type, then a leave_balance row referencing it ->
--    confirm updated_at triggers fire independently per table.
-- 4. Insert a leave_request with is_half_day = true and start_date <>
--    end_date -> confirm chk_leave_requests_half_day_single_date blocks it.
-- 5. Attempt to push leave_balances.used_days above
--    allocated_days + carried_forward_days directly via SQL -> confirm
--    chk_leave_balances_used_within_allocation blocks it (defense in
--    depth behind the service-layer check in leaveBalanceService.js).
-- 6. Delete an employee referenced only as leave_requests.decided_by ->
--    confirm ON DELETE SET NULL fires instead of blocking the delete.
-- 7. Confirm leave_requests.leave_type_id uses ON DELETE RESTRICT (unlike
--    most FKs here) — a leave_type with historical requests attached must
--    not be hard-deletable; leaveTypeService.js should offer deactivate
--    (is_active = false) instead, same soft-delete convention as
--    departments.
-- ============================================================================