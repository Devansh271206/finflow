/**
 * Category Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `categories`. Mirrors the shape of departmentRepository.js /
 * budgetRepository.js (PRD §10.1 — services never touch Supabase
 * query syntax directly).
 *
 * Table: categories
 * Columns: id, workspace_id, user_id, created_by, department_id, name,
 *          description, expense_type, icon, color, type, status,
 *          sort_order, is_system, created_at
 * Constraint: unique (workspace_id, name) — enforced at the service
 * layer via findByNameInWorkspace (see categoryService.assertNameAvailable),
 * not at the DB level here.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS =
  "id, workspace_id, user_id, created_by, department_id, name, description, expense_type, icon, color, type, status, sort_order, is_system, created_at";

/**
 * List categories for a workspace, optionally filtered by a case-
 * insensitive name search, department_id, and/or status. Always
 * ordered by sort_order so a saved drag-and-drop order is reflected
 * without any client-side re-sort.
 */
async function listByWorkspace(workspaceId, { search, department, status } = {}) {
  let query = supabaseAdmin
    .from("categories")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }
  if (department) {
    query = query.eq("department_id", department);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Scoped lookup — confirms a category belongs to the given workspace
 * before the service acts on it (defense-in-depth alongside RLS).
 */
async function findByIdInWorkspace(id, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Case-insensitive name lookup within a workspace. Used to guard
 * create() (excludeId omitted) and update()/rename (excludeId set to
 * the category's own id so it doesn't collide with itself).
 */
async function findByNameInWorkspace(workspaceId, name, excludeId = null) {
  let query = supabaseAdmin
    .from("categories")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", workspaceId)
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
    .from("categories")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Partial update — used for rename/description/department/expense_type/
 * icon/color (updateCategory) as well as the activate/deactivate toggle
 * (updateCategoryStatus). Never accepts workspace_id in payload; the
 * caller has already confirmed the category belongs to the workspace.
 */
async function update(id, payload) {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Hard delete. Only called for custom (non-system) categories — the
 * system-category guard lives in categoryService.deleteCategory, which
 * already confirms workspace ownership before calling this.
 */
async function remove(id) {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Persist a full reorder. `orderedIds` is the complete, already-
 * validated (see categoryService.reorderCategories) list of category
 * ids for this workspace in their new display order — index position
 * becomes the new sort_order. Supabase JS has no native "bulk update
 * with a different value per row", so this runs one update per row
 * concurrently.
 */
async function reorder(workspaceId, orderedIds) {
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const { error } = await supabaseAdmin
        .from("categories")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
    })
  );
}

/**
 * Seed the default system category set for a new workspace. Idempotent:
 * skips any default whose name already exists in the workspace (e.g.
 * this ran once already, or a migration pre-seeded it), so it's safe
 * to call unconditionally from workspaceController.createWorkspace.
 */
async function bulkInsertDefaults(workspaceId, ownerUserId, defaults) {
  const existing = await listByWorkspace(workspaceId, {});
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

  const toInsert = defaults
    .filter((d) => !existingNames.has(d.name.toLowerCase()))
    .map((d, index) => ({
      workspace_id: workspaceId,
      user_id: ownerUserId,
      created_by: ownerUserId,
      department_id: null,
      name: d.name,
      description: null,
      expense_type: d.name,
      icon: "CreditCard",
      color: "emerald",
      type: "expense",
      status: "active",
      sort_order: existing.length + index,
      is_system: true,
    }));

  if (toInsert.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert(toInsert)
    .select(SELECT_COLUMNS);
  if (error) throw error;
  return data;
}

module.exports = {
  listByWorkspace,
  findByIdInWorkspace,
  findByNameInWorkspace,
  create,
  update,
  remove,
  reorder,
  bulkInsertDefaults,
  SELECT_COLUMNS,
};