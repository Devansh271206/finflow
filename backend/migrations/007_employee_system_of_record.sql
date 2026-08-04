-- ============================================================================
-- Migration 007: Employee System of Record
-- ------------------------------------------------------------------------
-- Sprint 2 — Salary History, Employee Documents, Employee Timeline, plus
-- the two pieces of infrastructure they depend on that didn't exist yet:
-- a general per-membership permission override table, and a minimal
-- audit log (PRD §13.3 requires every salary_history read to be logged).
--
-- Depends on: workspaces, memberships, employees (all already shipped).
-- Run against a staging copy first — the trigger functions in particular
-- can only be verified by actually exercising them against a real
-- Postgres instance; that could not be done from the environment that
-- authored this migration. See the manual test notes at the bottom.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. membership_permission_grants
-- ----------------------------------------------------------------------------
-- General mechanism for per-membership permission overrides — i.e.
-- permissions granted to one specific membership regardless of its role,
-- as opposed to role_permissions which grants uniformly to every
-- membership with a given role. First (and currently only) consumer is
-- salary.read_department (PRD §13.3: "separately-grantable... set
-- per-membership by Admin/HR — it is not implied by role"), but the
-- shape is intentionally generic in case a future sensitive-data class
-- needs the same per-individual override pattern.
--
-- Never hard-deleted — a grant is revoked (revoked_by/revoked_at set),
-- not removed, so there's a durable history of who had access to what
-- and when. "Active grant" = revoked_at IS NULL.

CREATE TABLE IF NOT EXISTS membership_permission_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz
);

-- Only one ACTIVE grant per (membership, permission) at a time — doesn't
-- stop the same pair being granted again after a prior grant was
-- revoked, since that's a new row with its own history.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_membership_permission_grant
  ON membership_permission_grants (membership_id, permission_key)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_membership_permission_grants_membership
  ON membership_permission_grants (membership_id)
  WHERE revoked_at IS NULL;


-- ----------------------------------------------------------------------------
-- 2. audit_logs
-- ----------------------------------------------------------------------------
-- Generic, workspace-scoped audit trail. This sprint's only writer is
-- salary_history reads (PRD §13.3's hard requirement), but the shape is
-- intentionally generic — Payroll Records (Sprint 5) is expected to
-- reuse this same table rather than get its own, per the PRD's ER
-- diagram (workspaces ||--o{ audit_logs). No reading UI/endpoint is
-- built this sprint — write-only, until an Audit Logs module is
-- actually scoped.

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_resource
  ON audit_logs (workspace_id, resource_type, resource_id);


-- ----------------------------------------------------------------------------
-- 3. salary_history
-- ----------------------------------------------------------------------------
-- Append-only per PRD §11.5 — every revision is a new row, never
-- updated/deleted. Deliberately has no workspace_id column, matching
-- the PRD's exact documented shape — repositories must confirm the
-- parent employee belongs to the caller's workspace first (the same
-- assertDepartmentInWorkspace/assertManagerInWorkspace pattern already
-- used in employeeService.js), rather than this table duplicating
-- workspace_id itself.

CREATE TABLE IF NOT EXISTS salary_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  ctc_annual numeric(14, 2) NOT NULL CHECK (ctc_annual >= 0),
  base_salary numeric(14, 2) NOT NULL CHECK (base_salary >= 0),
  allowances jsonb DEFAULT '{}'::jsonb,
  bonus_amount numeric(14, 2) DEFAULT 0 CHECK (bonus_amount >= 0),
  revision_reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_history_employee
  ON salary_history (employee_id, effective_date DESC);


-- ----------------------------------------------------------------------------
-- 4. employee_documents
-- ----------------------------------------------------------------------------
-- storage_path (not a URL) is deliberate — signed, time-limited URLs
-- are generated on read via the new getSignedDocumentUrl() helper in
-- utils/upload.js, never stored as a permanent link.

CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee
  ON employee_documents (employee_id);


-- ----------------------------------------------------------------------------
-- 5. employee_events
-- ----------------------------------------------------------------------------
-- System-generated only — no application code ever inserts into this
-- table directly. Populated entirely by the two trigger functions below.

CREATE TABLE IF NOT EXISTS employee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_events_employee
  ON employee_events (employee_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- 6. Trigger: employees INSERT/UPDATE -> employee_events
-- ----------------------------------------------------------------------------
-- NOTE on scope: PRD §11.5 literally says triggers on "employees UPDATE
-- and salary_history INSERT" — but PRD §15.2's own worked example
-- (§15.2's process-flow line) describes a 'joined' event being written
-- when an employee is FIRST created, which requires an INSERT trigger,
-- not just UPDATE. Building both INSERT and UPDATE handling here to
-- satisfy the worked example; flagging the §11.5 wording as slightly
-- imprecise rather than silently picking one reading.

CREATE OR REPLACE FUNCTION employees_timeline_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO employee_events (employee_id, event_type, description, metadata)
    VALUES (
      NEW.id,
      'joined',
      NEW.full_name || ' joined as ' || NEW.designation,
      jsonb_build_object('department_id', NEW.department_id, 'date_of_joining', NEW.date_of_joining)
    );
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' from here on. One event row per meaningful field
  -- that actually changed, not one row summarizing everything, so each
  -- shows up as its own distinct timeline entry.

  IF NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
    INSERT INTO employee_events (employee_id, event_type, description, metadata)
    VALUES (
      NEW.id,
      CASE WHEN NEW.employment_status = 'terminated' THEN 'terminated' ELSE 'status_change' END,
      'Employment status changed from ' || OLD.employment_status || ' to ' || NEW.employment_status,
      jsonb_build_object('from', OLD.employment_status, 'to', NEW.employment_status)
    );
  END IF;

  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    INSERT INTO employee_events (employee_id, event_type, description, metadata)
    VALUES (
      NEW.id,
      'department_change',
      'Department changed',
      jsonb_build_object('from', OLD.department_id, 'to', NEW.department_id)
    );
  END IF;

  IF NEW.reporting_manager_id IS DISTINCT FROM OLD.reporting_manager_id THEN
    INSERT INTO employee_events (employee_id, event_type, description, metadata)
    VALUES (
      NEW.id,
      'manager_change',
      'Reporting manager changed',
      jsonb_build_object('from', OLD.reporting_manager_id, 'to', NEW.reporting_manager_id)
    );
  END IF;

  IF NEW.designation IS DISTINCT FROM OLD.designation THEN
    INSERT INTO employee_events (employee_id, event_type, description, metadata)
    VALUES (
      NEW.id,
      'designation_change',
      'Designation changed from ' || OLD.designation || ' to ' || NEW.designation,
      jsonb_build_object('from', OLD.designation, 'to', NEW.designation)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employees_timeline ON employees;
CREATE TRIGGER trg_employees_timeline
  AFTER INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION employees_timeline_trigger();


-- ----------------------------------------------------------------------------
-- 7. Trigger: salary_history INSERT -> employee_events
-- ----------------------------------------------------------------------------
-- "Diffing old vs new" (PRD §15.2 worked example) means diffing against
-- this employee's MOST RECENT PRIOR salary_history row, not an OLD/NEW
-- row pair the way an UPDATE trigger gets — salary_history is
-- append-only, so there is no OLD row for an INSERT. If no prior row
-- exists (first-ever salary_history entry, typically at joining), the
-- event just records the starting CTC rather than a diff.

CREATE OR REPLACE FUNCTION salary_history_timeline_trigger()
RETURNS TRIGGER AS $$
DECLARE
  previous_row salary_history%ROWTYPE;
BEGIN
  SELECT *
  INTO previous_row
  FROM salary_history
  WHERE employee_id = NEW.employee_id
    AND id != NEW.id
  ORDER BY effective_date DESC, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO employee_events (employee_id, event_type, description, metadata)
    VALUES (
      NEW.employee_id,
      'salary_revision',
      'Starting CTC recorded: ' || NEW.ctc_annual,
      jsonb_build_object('ctc_annual', NEW.ctc_annual, 'effective_date', NEW.effective_date)
    );
  ELSE
    INSERT INTO employee_events (employee_id, event_type, description, metadata)
    VALUES (
      NEW.employee_id,
      'salary_revision',
      'CTC changed from ' || previous_row.ctc_annual || ' to ' || NEW.ctc_annual,
      jsonb_build_object(
        'from_ctc_annual', previous_row.ctc_annual,
        'to_ctc_annual', NEW.ctc_annual,
        'effective_date', NEW.effective_date,
        'revision_reason', NEW.revision_reason
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salary_history_timeline ON salary_history;
CREATE TRIGGER trg_salary_history_timeline
  AFTER INSERT ON salary_history
  FOR EACH ROW
  EXECUTE FUNCTION salary_history_timeline_trigger();


-- ============================================================================
-- Manual verification notes (could not be run from the authoring
-- environment — no live Postgres connection available there):
--
-- 1. INSERT a row into employees -> confirm exactly one 'joined' row
--    appears in employee_events.
-- 2. UPDATE that employee's designation -> confirm exactly one
--    'designation_change' row appears (and only one, not a duplicate
--    for unrelated column changes in the same UPDATE).
-- 3. UPDATE employment_status to 'terminated' -> confirm the event_type
--    is 'terminated', not 'status_change'.
-- 4. INSERT the first salary_history row for an employee -> confirm a
--    'salary_revision' event with the "Starting CTC" wording (no
--    "from"/"to" diff, since there's no prior row).
-- 5. INSERT a second salary_history row for the same employee -> confirm
--    the event now reads "CTC changed from X to Y" against the first
--    row's ctc_annual.
-- ============================================================================
