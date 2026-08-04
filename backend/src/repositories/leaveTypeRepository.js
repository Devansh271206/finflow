/**
 * Leave Type Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `leave_types`. Mirrors the shape of departmentRepository.js
 * (PRD §10.1 — services never touch Supabase query syntax directly).
 *
 * Table: leave_types
 * Columns: id, workspace_id, name, is_paid, default_annual_days,
 *          is_active, created_at, updated_at
 * Constraint: unique (workspace_id, name)
 *
 * No hard-delete function is exposed here on purpose — a leave type
 * with historical leave_requests attached is protected by
 * ON DELETE RESTRICT at the DB layer (migration 014). Deactivation
 * goes through update() (is_active = false), same soft-delete
 * convention as departments.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, name, is_paid, default_annual_days, is_active, created_at, updated_at";

// Whitelist of columns listByWorkspace() may sort on — never interpolate
// req.query.sortBy directly into the query builder.
const SORTABLE_COLUMNS = new Set(["name", "created_at", "is_active"]);

/**
 * List leave types for a workspace. By default returns both active and
 * inactive rows (frontend is responsible for badge/filter display) so
 * HR/Admin can still see and reactivate a deactivated leave type.
 *
 * Optional, backward compatible — calling with no options behaves the
 * same as always and returns a plain array:
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
    .from("leave_types")
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
    .from("leave_types")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Scoped lookup — confirms a leave type belongs to the given workspace
 * before the controller acts on it (defense-in-depth alongside RLS).
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("leave_types")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByNameInWorkspace(workspaceId, name) {
  const { data, error } = await supabaseAdmin
    .from("leave_types")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("leave_types")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update — used for rename, is_paid/default_annual_days
 * changes, and soft-delete/reactivate (is_active). Never accepts
 * workspace_id in payload; callers must not allow a leave type to be
 * reassigned across workspaces.
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("leave_types")
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
  findByNameInWorkspace,
  create,
  update,
  SELECT_COLUMNS,
  SORTABLE_COLUMNS,
};