/**
 * Employee Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `employees`. Mirrors the shape of departmentRepository.js /
 * categoryRepository.js (PRD §10.1 — services never touch Supabase
 * query syntax directly).
 *
 * Table: employees
 * Columns: id, workspace_id, user_id, employee_code, full_name,
 *          designation, department_id, reporting_manager_id,
 *          employment_status ('active'|'on_leave'|'terminated'),
 *          date_of_joining, date_of_exit, created_at, email,
 *          employment_type ('full_time'|'part_time'|'contract'|'intern'),
 *          is_active, deleted_at
 *
 * is_active/deleted_at (soft-delete/restore) are intentionally
 * independent of employment_status — a terminated employee can still
 * be is_active=true (record kept, just no longer employed), and
 * soft-deleting a record does not change employment_status. Callers
 * needing "not soft-deleted" rows must filter on is_active explicitly;
 * this repository does NOT default to excluding inactive rows on
 * findById/findByIdInWorkspace (restore needs to be able to find a
 * soft-deleted row by id), only listByWorkspace excludes them by
 * default.
 *
 * Salary/CTC data lives in a separate table (salary_history, Phase E.3)
 * and is never selected here — this repository only ever returns
 * employee profile fields, so no salary.view permission check is needed
 * at this layer (defense-in-depth: even if a caller forgot the
 * permission check, this repository has nothing sensitive to leak).
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS = `
  id, workspace_id, user_id, employee_code, full_name, designation,
  department_id, reporting_manager_id, employment_status,
  date_of_joining, date_of_exit, created_at, email, employment_type,
  is_active, deleted_at,
  departments:department_id ( id, name ),
  manager:reporting_manager_id ( id, full_name, designation )
`;

// Whitelisted sort columns — never interpolate a caller-provided column
// name directly into the query.
const SORTABLE_COLUMNS = new Set([
  "full_name",
  "employee_code",
  "designation",
  "date_of_joining",
  "created_at",
]);

/**
 * List employees for a workspace with optional filters, search,
 * sorting, and pagination.
 *
 * Excludes soft-deleted rows (is_active = false) unless
 * filters.includeDeleted is true.
 *
 * Search spans full_name/employee_code/designation and is applied in
 * memory (same approach as before — not filterable via a single ilike
 * across multiple columns and an embedded relation in one query).
 * Because of that, pagination is also applied in memory, AFTER search
 * filtering, so `total` always reflects the post-search result count
 * rather than the pre-search row count.
 *
 * Returns { rows, total } — total is the full filtered count (before
 * the limit/offset slice), for the caller to compute page metadata.
 */
async function listByWorkspace(workspaceId, filters = {}) {
  const {
    departmentId,
    status,
    employmentType,
    search,
    includeDeleted = false,
    sortBy = "full_name",
    sortOrder = "asc",
    limit,
    offset = 0,
  } = filters;

  const sortColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "full_name";
  const ascending = sortOrder !== "desc";

  let query = supabaseAdmin
    .from("employees")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order(sortColumn, { ascending });

  if (departmentId) query = query.eq("department_id", departmentId);
  if (status) query = query.eq("employment_status", status);
  if (employmentType) query = query.eq("employment_type", employmentType);
  if (!includeDeleted) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;

  let rows = data || [];

  const term = (search || "").trim().toLowerCase();
  if (term) {
    rows = rows.filter((r) => {
      const name = r.full_name?.toLowerCase() || "";
      const code = r.employee_code?.toLowerCase() || "";
      const designation = r.designation?.toLowerCase() || "";
      return name.includes(term) || code.includes(term) || designation.includes(term);
    });
  }

  const total = rows.length;

  if (limit) {
    rows = rows.slice(offset, offset + limit);
  }

  return { rows, total };
}

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Scoped lookup — confirms an employee belongs to the given workspace
 * before the service acts on it (defense-in-depth alongside RLS).
 * Deliberately does NOT filter on is_active, so a soft-deleted
 * employee can still be looked up (e.g. for restore).
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Uniqueness check for employee_code within a workspace, ahead of
 * hitting the DB's unique index — same pattern as
 * categoryRepository.findByNameInWorkspace.
 */
async function findByCodeInWorkspace(workspaceId, employeeCode, excludeId = null) {
  let query = supabaseAdmin
    .from("employees")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("employee_code", employeeCode);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Uniqueness check for email within a workspace, same pattern as
 * findByCodeInWorkspace. email is nullable, so callers should only
 * invoke this when a non-empty email was actually supplied.
 */
async function findByEmailInWorkspace(workspaceId, email, excludeId = null) {
  let query = supabaseAdmin
    .from("employees")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .ilike("email", email);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * All direct reports of a given employee (for org-chart / reporting
 * validation — e.g. preventing a manager from being set to their own
 * report, which would create a cycle).
 */
async function findDirectReports(employeeId, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("reporting_manager_id", employeeId);
  if (error) throw error;
  return data || [];
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update — full_name, designation, department_id,
 * reporting_manager_id, employment_status, date_of_exit, email,
 * employment_type, is_active, deleted_at. Never accepts workspace_id
 * in payload; callers must not allow an employee to be reassigned
 * across workspaces.
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  listByWorkspace,
  findById,
  findByIdInWorkspace,
  findByCodeInWorkspace,
  findByEmailInWorkspace,
  findDirectReports,
  create,
  update,
  SELECT_COLUMNS,
};