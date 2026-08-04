-- ============================================================================
-- Migration 010: Payroll Records
-- ------------------------------------------------------------------------
-- Sprint 5.
--
-- Column list is the PRD's own literal spec (§11.6) — not inferred, not
-- extended: workspace_id, employee_id, pay_period_month, pay_period_year,
-- base_salary, allowances_total, bonus_total, tax_deducted,
-- other_deductions, net_salary, payslip_storage_path, recorded_by,
-- created_at. Unique per (employee_id, pay_period_month, pay_period_year).
--
-- "Record store only — no tax computation, no statutory logic, no bank
-- integration" (§11.6, restated in §21's out-of-scope list) — net_salary
-- is entered/computed client-side or via CSV import, never derived by a
-- DB trigger or backend formula. This migration does not add any
-- computed-column logic for that reason.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_period_month integer NOT NULL CHECK (pay_period_month BETWEEN 1 AND 12),
  pay_period_year integer NOT NULL CHECK (pay_period_year BETWEEN 2000 AND 2100),
  base_salary numeric(14, 2) NOT NULL CHECK (base_salary >= 0),
  allowances_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (allowances_total >= 0),
  bonus_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (bonus_total >= 0),
  tax_deducted numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_deducted >= 0),
  other_deductions numeric(14, 2) NOT NULL DEFAULT 0 CHECK (other_deductions >= 0),
  net_salary numeric(14, 2) NOT NULL CHECK (net_salary >= 0),
  payslip_storage_path text,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_payroll_employee_period UNIQUE (employee_id, pay_period_month, pay_period_year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_workspace_period
  ON payroll_records (workspace_id, pay_period_year, pay_period_month);

CREATE INDEX IF NOT EXISTS idx_payroll_records_employee
  ON payroll_records (employee_id, pay_period_year DESC, pay_period_month DESC);
