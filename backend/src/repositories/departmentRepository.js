/**
 * Department Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `departments`. Mirrors the shape of workspaceRepository.js /
 * roleRepository.js (PRD §10.1 — services never touch Supabase
 * query syntax directly).
 *
 * Table: departments
 * Columns: id, workspace_id, name, is_active, created_at
 * Constraint: unique (workspace_id, name)
 *
 * No hard-delete function is exposed here on purpose — PRD §5.2
 * requires soft-delete (is_active) only, never hard-delete of a
 * department with transaction history. Deactivation goes through
 * update().
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS = "id, workspace_id, name, is_active, created_at";

/**
 * List departments for a workspace. By default returns both active and
 * inactive rows (frontend is responsible for badge/filter display) so
 * Admin/Finance can still see and reactivate a deactivated department.
 */
async function listByWorkspace(workspaceId, { activeOnly = false } = {}) {
  let query = supabaseAdmin
    .from("departments")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
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

module.exports = {
  listByWorkspace,
  findById,
  findByIdInWorkspace,
  findByNameInWorkspace,
  create,
  update,
  SELECT_COLUMNS,
};