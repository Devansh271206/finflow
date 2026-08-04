-- ============================================================================
-- Migration 011: Employee Contact Fields
-- ------------------------------------------------------------------------
-- Sprint 7 — Employee Management Module (contact info / emergency
-- contact / notes gap-fill on top of the already-shipped employees
-- table from Sprint 2's 007_employee_system_of_record.sql).
--
-- Depends on: employees (already shipped, confirmed live schema:
--   id, workspace_id, user_id, employee_code, full_name, designation,
--   department_id, reporting_manager_id, employment_status
--   ('active'|'on_leave'|'terminated'), date_of_joining, date_of_exit,
--   created_at, email, employment_type, is_active, deleted_at).
--
-- This migration only ADDS columns/indexes. No existing column,
-- constraint, trigger, or row is modified, renamed, or dropped.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Contact info (Sprint 7: "Employee Contact Information")
-- ----------------------------------------------------------------------------

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text;


-- ----------------------------------------------------------------------------
-- 2. Emergency contact (Sprint 7: "Emergency Contact")
-- ----------------------------------------------------------------------------

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;


-- ----------------------------------------------------------------------------
-- 3. Notes (Sprint 7: "Employee Notes")
-- ----------------------------------------------------------------------------

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS notes text;


-- ----------------------------------------------------------------------------
-- 4. updated_at audit column
-- ----------------------------------------------------------------------------
-- employees currently has created_at but no updated_at. Every other
-- audited write path in this project (see 007's employee_events
-- triggers) already tracks change history via employee_events, but
-- there's no cheap "when was this row last touched" column on the row
-- itself yet. Adding it here since Sprint 7 is touching the row shape
-- anyway; wiring it via trigger, not left to the application layer to
-- remember to set on every update.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION set_employees_updated_at();


-- ----------------------------------------------------------------------------
-- Manual verification notes (could not be run from the authoring
-- environment — no live Postgres connection available there):
--
-- 1. Run against a staging copy first, same caution as 007.
-- 2. UPDATE any employee row -> confirm updated_at changes and no
--    existing trigger (trg_employees_timeline, 007) is affected —
--    both triggers should fire independently on the same UPDATE.
-- 3. Confirm employeeRepository.js's SELECT_COLUMNS (next file) needs
--    updated_at/phone/address/emergency_contact_name/
--    emergency_contact_phone/notes added, or they won't be returned
--    even though they exist in the DB.
-- ============================================================================