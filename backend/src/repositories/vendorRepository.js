/**
 * Vendor Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `vendors`. Mirrors the shape of departmentRepository.js /
 * workspaceRepository.js (PRD §10.1 — services/controllers never
 * touch Supabase query syntax directly).
 *
 * Table: vendors (migrations/002_enterprise_transactions.sql)
 * Columns: id, workspace_id, name, contact_name, contact_email,
 *          contact_phone, tax_id, is_active, created_at, updated_at
 * Constraint: unique (workspace_id, name)
 *
 * No hard-delete function is exposed here on purpose, same rationale
 * as departmentRepository — a vendor referenced by transaction
 * history must never be hard-deleted. Deactivation goes through
 * update().
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, name, contact_name, contact_email, contact_phone, tax_id, is_active, created_at, updated_at";

/**
 * List vendors for a workspace. By default returns both active and
 * inactive rows (frontend is responsible for badge/filter display) so
 * Admin/Finance can still see and reactivate a deactivated vendor.
 */
async function listByWorkspace(workspaceId, { activeOnly = false } = {}) {
  let query = supabaseAdmin
    .from("vendors")
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
    .from("vendors")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Scoped lookup — confirms a vendor belongs to the given workspace
 * before the controller acts on it (defense-in-depth alongside RLS).
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByNameInWorkspace(workspaceId, name) {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update — used for both field edits and soft-delete/
 * reactivate (`is_active`). Never accepts workspace_id in payload;
 * callers must not allow a vendor to be reassigned across workspaces.
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .update({ ...payload, updated_at: new Date().toISOString() })
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