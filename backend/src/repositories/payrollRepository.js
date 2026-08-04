/**
 * Payroll Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `payroll_records`. No update()/delete() exposed for the core payroll
 * figures — PRD §11.6 calls this a "record store only", and payroll
 * figures are tied to a specific pay period that's already closed by
 * the time it's entered; a correction is a new understanding of the
 * same period, which this repository deliberately does not support
 * editing in place (see payrollService.js for the actual policy —
 * corrections are out of this sprint's scope, flagged there, not
 * silently allowed here). updatePayslipPath() is the one exception —
 * attaching a payslip file after the fact isn't a correction to the
 * recorded figures themselves.
 *
 * Table: payroll_records
 * Columns: id, workspace_id, employee_id, pay_period_month,
 *          pay_period_year, base_salary, allowances_total, bonus_total,
 *          tax_deducted, other_deductions, net_salary,
 *          payslip_storage_path, recorded_by, created_at
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, employee_id, pay_period_month, pay_period_year, base_salary, " +
  "allowances_total, bonus_total, tax_deducted, other_deductions, net_salary, " +
  "payslip_storage_path, recorded_by, created_at";

async function listByEmployee(employeeId) {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select(SELECT_COLUMNS)
    .eq("employee_id", employeeId)
    .order("pay_period_year", { ascending: false })
    .order("pay_period_month", { ascending: false });
  if (error) throw error;
  return data;
}

async function findByIdForEmployee(id, employeeId) {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByEmployeeAndPeriod(employeeId, month, year) {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .select(SELECT_COLUMNS)
    .eq("employee_id", employeeId)
    .eq("pay_period_month", month)
    .eq("pay_period_year", year)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Raw rows for a workspace within a period range — the ingredient set
 * for getAggregateSummary() in payrollService.js. Deliberately does NOT
 * join to employees here; the service layer does that join in JS so
 * this repository stays a plain single-table reader, consistent with
 * every other repository in this codebase.
 */
async function listForWorkspace(workspaceId, { month, year } = {}) {
  let query = supabaseAdmin
    .from("payroll_records")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId);

  if (year) query = query.eq("pay_period_year", year);
  if (month) query = query.eq("pay_period_month", month);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function updatePayslipPath(id, payslipStoragePath) {
  const { data, error } = await supabaseAdmin
    .from("payroll_records")
    .update({ payslip_storage_path: payslipStoragePath })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  listByEmployee,
  findByIdForEmployee,
  findByEmployeeAndPeriod,
  listForWorkspace,
  create,
  updatePayslipPath,
};
