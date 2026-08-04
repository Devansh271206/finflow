-- ============================================================================
-- Migration 012: Department & Team Management
-- ------------------------------------------------------------------------
-- Sprint 8 — Department Head assignment, and the new Team Management
-- module (PRD §15.20): teams are a sub-unit of a Department, with a
-- Team Lead and a member roster (employees.team_id, many-to-one,
-- mirroring the existing employees.department_id relationship).
--
-- Depends on: workspaces, departments, employees (all already shipped —
-- confirmed live schema per 011_employee_contact_fields.sql and
-- departmentRepository.js).
--
-- Scope note (PRD §49.1 gap-fill, "Departments (15.3)"): v2.4 explicitly
-- decided departments are single-level only for this release — no
-- parent_department_id column is added here. Sub-departments are
-- logged as a Future Enhancement, not built.
--
-- This migration only ADDS columns/tables/indexes. No existing column,
-- constraint, trigger, or row is modified, renamed, or dropped.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. departments.department_head_employee_id
-- ----------------------------------------------------------------------------
-- Nullable — a department without an assigned head is valid state (e.g.
-- freshly created). ON DELETE SET NULL so an employee leaving the org
-- doesn't block their own deletion/offboarding path; the department is
-- simply left without a head until reassigned (same "must not be left
-- silently leaderless" spirit as the Team Lead edge case below, but
-- Department Head reassignment notification is out of Sprint 8 scope —
-- Notification Center is explicitly excluded from this sprint).

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS department_head_employee_id uuid
    REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departments_head_employee
  ON departments (department_head_employee_id);


-- ----------------------------------------------------------------------------
-- 2. teams
-- ----------------------------------------------------------------------------
-- Table: teams (PRD §15.20 database design).
-- department_id is NOT NULL — a team always belongs to exactly one
-- department; there is no org-level "unassigned team" concept.
-- team_lead_employee_id is nullable for the same reason as the
-- department head above.
--
-- Sprint 8 scope explicitly excludes team_budgets, team analytics,
-- leave calendar, and dashboard integration (PRD §15.20 functional
-- requirements beyond CRUD/lead/members) — those are left as TODOs
-- for a future sprint, not built here.

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  team_lead_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Team name must be unique within its parent department (not
  -- workspace-wide — "Platform" can exist under both Engineering and,
  -- hypothetically, another department).
  CONSTRAINT uq_teams_department_name UNIQUE (department_id, name)
);

CREATE INDEX IF NOT EXISTS idx_teams_workspace ON teams (workspace_id);
CREATE INDEX IF NOT EXISTS idx_teams_department ON teams (department_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead_employee ON teams (team_lead_employee_id);

CREATE OR REPLACE FUNCTION set_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION set_teams_updated_at();


-- ----------------------------------------------------------------------------
-- 3. employees.team_id
-- ----------------------------------------------------------------------------
-- Many-to-one: an employee belongs to at most one team at a time (PRD
-- §15.20 functional requirements), mirroring the existing
-- employees.department_id relationship. ON DELETE SET NULL — deleting/
-- archiving a team must not cascade-delete its former members' employee
-- rows; they simply become team-less until reassigned.
--
-- No FK-level constraint tying employees.department_id to
-- teams.department_id (i.e. "employee's team must belong to employee's
-- department") is enforced at the database layer here — it is enforced
-- at the service layer (teamService.js) instead, consistent with this
-- project's existing convention of keeping cross-entity business rules
-- out of raw check constraints (see departmentRepository.js header).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_team ON employees (team_id);


-- ----------------------------------------------------------------------------
-- Manual verification notes (could not be run from the authoring
-- environment — no live Postgres connection available there):
--
-- 1. Run against a staging copy first, same caution as 007/011.
-- 2. Confirm gen_random_uuid() is available (pgcrypto/pgcrypto-compatible
--    extension) — every other table in this project's migrations uses
--    the same default, so this should already be enabled.
-- 3. Insert a team row -> confirm updated_at is set and the trigger
--    fires independently of departments'/employees' own triggers.
-- 4. Assign department_head_employee_id / team_lead_employee_id to an
--    employee, then delete that employee -> confirm the FK's
--    ON DELETE SET NULL fires instead of blocking the delete.
-- 5. Confirm departmentRepository.js's SELECT_COLUMNS and
--    employeeRepository.js's SELECT_COLUMNS (next files) need
--    department_head_employee_id / team_id added, or they won't be
--    returned even though they exist in the DB.
-- ============================================================================