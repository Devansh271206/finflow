/**
 * Department Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `departments`. Mirrors the shape of workspaceRepository.js /
 * roleRepository.js (PRD §10.1 — services never touch Supabase
 * query syntax directly).
 *
 * Table: departments
 * Columns: id, workspace_id, name, is_active, department_head_employee_id,
 *          created_at
 * Constraint: unique (workspace_id, name)
 *
 * No hard-delete function is exposed here on purpose — PRD §5.2
 * requires soft-delete (is_active) only, never hard-delete of a
 * department with transaction history. Deactivation goes through
 * update().
 *
 * Sprint 8: added department_head_employee_id (migration 012) plus
 * search/filter/sort/pagination support on listByWorkspace() and a
 * dedicated assignHead() for PATCH /departments/:id/head. The joined
 * `head:department_head_employee_id ( id, full_name )` alias mirrors
 * employeeRepository.js's `departments:department_id ( id, name )`
 * join pattern.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, name, is_active, department_head_employee_id, created_at, " +
  "head:department_head_employee_id ( id, full_name )";

// Whitelist of columns listByWorkspace() may sort on — never interpolate
// req.query.sortBy directly into the query builder.
const SORTABLE_COLUMNS = new Set(["name", "created_at", "is_active"]);

/**
 * List departments for a workspace. By default returns both active and
 * inactive rows (frontend is responsible for badge/filter display) so
 * Admin/Finance can still see and reactivate a deactivated department.
 *
 * Sprint 8 additions (all optional, backward compatible — calling with
 * no options behaves exactly as before and returns a plain array):
 *   - search: case-insensitive match on name
 *   - sortBy / sortOrder: whitelisted column sort (default name/asc)
 *   - page / limit: when both are provided, returns
 *     { data, total, page, limit } instead of a plain array so the
 *     frontend can render pagination controls.
 */
async function listByWorkspace(
  workspaceId,
  { activeOnly = false, search, sortBy = "name", sortOrder = "asc", page, limit } = {}
) {
  const column = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "name";
  const ascending = sortOrder !== "desc";

  let query = supabaseAdmin
    .from("departments")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order(column, { ascending });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const paginate = Number.isInteger(page) && Number.isInteger(limit);
  if (paginate) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  if (paginate) {
    return { data, total: count ?? data.length, page, limit };
  }
  return data;
}

async function findById(id) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Scoped lookup — confirms a department belongs to the given workspace
 * before the controller acts on it (defense-in-depth alongside RLS).
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByNameInWorkspace(workspaceId, name) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update — used for both rename (`name`) and soft-delete/
 * reactivate (`is_active`). Never accepts workspace_id in payload;
 * callers must not allow a department to be reassigned across
 * workspaces.
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Assign (or clear, with employeeId = null) the Department Head.
 * Separated from the generic update() so departmentService.js can apply
 * its own "employee must belong to this department" validation before
 * this write, without that rule leaking into the repository layer.
 */
async function assignHead(id, employeeId) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .update({ department_head_employee_id: employeeId })
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
  findByNameInWorkspace,
  create,
  update,
  assignHead,
  SELECT_COLUMNS,
  SORTABLE_COLUMNS,
};