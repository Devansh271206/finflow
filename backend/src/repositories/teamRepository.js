/**
 * Team Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for `teams`.
 * Mirrors the shape of departmentRepository.js / employeeRepository.js
 * (PRD §10.1 — services never touch Supabase query syntax directly).
 *
 * Table: teams (migration 012)
 * Columns: id, workspace_id, department_id, name, description,
 *          team_lead_employee_id, is_active, created_at, updated_at
 * Constraint: unique (department_id, name)
 *
 * Team membership itself (employees.team_id) is NOT owned by this
 * repository — it lives on the `employees` row and is read/written via
 * employeeRepository.js (findByIdInWorkspace / update), same as
 * department membership already works. This repository only owns the
 * `teams` row itself plus read-only member-roster lookups.
 *
 * No hard-delete function is exposed here on purpose, same convention
 * as departmentRepository.js — teams are soft-deleted via is_active.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, department_id, name, description, team_lead_employee_id, " +
  "is_active, created_at, updated_at, " +
  "department:department_id ( id, name ), " +
  "lead:team_lead_employee_id ( id, full_name )";

// Whitelist of columns listByWorkspace() may sort on — never interpolate
// req.query.sortBy directly into the query builder.
const SORTABLE_COLUMNS = new Set(["name", "created_at", "is_active"]);

/**
 * List teams for a workspace, optionally scoped to a single department.
 * By default returns both active and inactive rows (frontend badges
 * them), same convention as departmentRepository.js.
 *
 *   - departmentId: restrict to one department (Team Directory nested
 *     under a Department Details page)
 *   - search: case-insensitive match on name
 *   - sortBy / sortOrder: whitelisted column sort (default name/asc)
 *   - page / limit: when both are provided, returns
 *     { data, total, page, limit } instead of a plain array.
 */
async function listByWorkspace(
  workspaceId,
  {
    departmentId,
    activeOnly = false,
    search,
    sortBy = "name",
    sortOrder = "asc",
    page,
    limit,
  } = {}
) {
  const column = SORTABLE_COLUMNS.has(sortBy) ? sortBy : "name";
  const ascending = sortOrder !== "desc";

  let query = supabaseAdmin
    .from("teams")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order(column, { ascending });

  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

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
    .from("teams")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Scoped lookup — confirms a team belongs to the given workspace before
 * the controller acts on it (defense-in-depth alongside RLS), same
 * pattern as departmentRepository.findByIdInWorkspace.
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByNameInDepartment(departmentId, name, excludeId = null) {
  let query = supabaseAdmin
    .from("teams")
    .select(SELECT_COLUMNS)
    .eq("department_id", departmentId)
    .ilike("name", name);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update — name/description rename and is_active soft-delete/
 * reactivate. Never accepts workspace_id or department_id in payload;
 * a team cannot be moved across workspaces or departments in Sprint 8
 * (not in PRD §15.20's functional requirements — moving a team to a
 * different department would orphan its existing members' department
 * assignment consistency, left as a Future Enhancement if ever needed).
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Assign (or clear, with employeeId = null) the Team Lead. Separated
 * from the generic update() so teamService.js can apply its own
 * "employee must belong to this team's department" validation first,
 * same pattern as departmentRepository.assignHead.
 */
async function assignLead(id, employeeId) {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .update({ team_lead_employee_id: employeeId })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Read-only member roster for a team — queries `employees` directly
 * (team membership is owned by employees.team_id, not by this table).
 * Kept here rather than in employeeRepository.js since it's a
 * team-shaped read (used by GET /teams/:id and the Team Details page),
 * mirroring how departmentController.js's employee list is served by
 * employeeRepository.listByWorkspace({ departmentId }) today.
 */
async function listMembers(teamId, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, designation, email, employment_status, department_id, team_id")
    .eq("team_id", teamId)
    .eq("workspace_id", workspaceId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data;
}

module.exports = {
  listByWorkspace,
  findById,
  findByIdInWorkspace,
  findByNameInDepartment,
  create,
  update,
  assignLead,
  listMembers,
  SELECT_COLUMNS,
  SORTABLE_COLUMNS,
};
