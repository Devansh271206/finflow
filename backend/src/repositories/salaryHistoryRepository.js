/**
 * Salary History Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `salary_history`. Append-only per PRD §11.5 — every revision is a
 * new row. No update()/delete() exposed here on purpose; the only
 * mutation is create(). employee_events rows for revisions are
 * generated entirely by the salary_history_timeline_trigger() DB
 * trigger (migration 007) — this repository never writes to
 * employee_events directly.
 *
 * Table: salary_history
 * Columns: id, employee_id, effective_date, ctc_annual, base_salary,
 *          allowances, bonus_amount, revision_reason, created_by,
 *          created_at
 *
 * Deliberately no workspace_id column/filter here (matches the exact
 * PRD-documented shape) — callers (salaryHistoryService) must confirm
 * the parent employee belongs to the caller's workspace first, via
 * employeeRepository.findByIdInWorkspace(), before calling any function
 * below.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, employee_id, effective_date, ctc_annual, base_salary, allowances, bonus_amount, revision_reason, created_by, created_at";

async function listByEmployee(employeeId) {
  const { data, error } = await supabaseAdmin
    .from("salary_history")
    .select(SELECT_COLUMNS)
    .eq("employee_id", employeeId)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("salary_history")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

module.exports = { listByEmployee, create };
