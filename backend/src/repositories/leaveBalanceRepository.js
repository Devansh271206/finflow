/**
 * Leave Balance Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `leave_balances`. Mirrors the shape of departmentRepository.js /
 * leaveTypeRepository.js (PRD §10.1 — services never touch Supabase
 * query syntax directly).
 *
 * Table: leave_balances
 * Columns: id, employee_id, leave_type_id, policy_period,
 *          allocated_days, used_days, carried_forward_days,
 *          created_at, updated_at
 * Constraint: unique (employee_id, leave_type_id, policy_period)
 *
 * No employee-wise/department-wise summary aggregation lives here —
 * that's leaveBalanceService.js's job (composing this repository's
 * plain per-row reads), consistent with this project's "cross-entity
 * shaping happens in the service layer" convention.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, employee_id, leave_type_id, policy_period, allocated_days, used_days, " +
  "carried_forward_days, created_at, updated_at, " +
  "leave_type:leave_type_id ( id, name, is_paid )";

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * All balance rows for a single employee (every leave type / policy
 * period they have a row for). Used by leaveBalanceService.js's
 * employee-wise summary and by leaveRequestService.js's balance
 * validation before approving a request.
 */
async function findByEmployee(employeeId, { policyPeriod } = {}) {
  let query = supabaseAdmin
    .from("leave_balances")
    .select(SELECT_COLUMNS)
    .eq("employee_id", employeeId)
    .order("policy_period", { ascending: false });

  if (policyPeriod) {
    query = query.eq("policy_period", policyPeriod);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Single balance row for an employee/type/period — the row
 * leaveRequestService.js reads-then-writes when validating and
 * applying a leave request's balance impact.
 */
async function findByEmployeeAndType(employeeId, leaveTypeId, policyPeriod) {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .select(SELECT_COLUMNS)
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("policy_period", policyPeriod)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * All balance rows for every employee in a given department, for a
 * given policy period — backs the department-wise leave summary.
 * Employee -> department join happens via the `employees` table since
 * leave_balances itself has no department_id column (kept normalized
 * against employee_id only, per migration 014).
 */
async function findByDepartment(departmentId, policyPeriod) {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .select(
      `${SELECT_COLUMNS}, employee:employee_id ( id, full_name, department_id )`
    )
    .eq("policy_period", policyPeriod)
    .eq("employee.department_id", departmentId);
  if (error) throw error;
  // Supabase's embedded-filter (`.eq("employee.department_id", ...)`)
  // still returns rows whose employee relation is null after the
  // filter didn't match — defensively drop those here rather than
  // trusting the join filter alone, same defensive style as
  // employeeRepository.js's workspace-scoped lookups.
  return (data || []).filter((row) => row.employee && row.employee.department_id === departmentId);
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update — used for allocation adjustments (HR correcting
 * allocated_days/carried_forward_days) and for used_days changes
 * driven by leaveRequestService.js's approve/cancel flows. Never
 * accepts employee_id/leave_type_id/policy_period in payload; callers
 * must not allow a balance row to be reassigned across its identity
 * columns (that's what the unique constraint keys on).
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  findById,
  findByEmployee,
  findByEmployeeAndType,
  findByDepartment,
  create,
  update,
  SELECT_COLUMNS,
};