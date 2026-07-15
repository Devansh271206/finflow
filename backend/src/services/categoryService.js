/**
 * Category Service
 * ------------------------------------------------------------------
 * Business logic for the Enterprise Expense Categories module: listing/
 * filtering, create/rename/deactivate/reactivate/reorder, system-category
 * protection, and seeding the default category set for new workspaces.
 * Kept framework-agnostic per PRD §10.1 layering.
 *
 * DECISION (flagging per phase-brief output rules): the PRD lists Create/
 * Rename/Deactivate/Reactivate/Reorder/Delete as admin abilities, then
 * separately scopes Delete to "only custom categories". Read literally,
 * only *deletion* is system-category-restricted — rename/deactivate/
 * reactivate/reorder apply to both system and custom categories (e.g. a
 * workspace that doesn't use "Insurance" should be able to deactivate it
 * without losing it entirely). If you intended system categories to be
 * fully immutable (no rename either), that's a one-line change in
 * updateCategory below — flag it and I'll adjust.
 */

const categoryRepository = require("../repositories/categoryRepository");
const departmentRepository = require("../repositories/departmentRepository");
const ApiError = require("../utils/ApiError");

/**
 * Single source of truth for the default system category set. Kept in
 * sync manually with the seed list in migration
 * 004_enterprise_categories.sql (that migration seeds existing
 * workspaces; this list seeds workspaces created after the migration
 * has run — see workspaceController.js).
 */
const DEFAULT_SYSTEM_CATEGORIES = [
  { name: "Cloud Infrastructure" },
  { name: "SaaS Subscriptions" },
  { name: "Payroll" },
  { name: "Engineering" },
  { name: "Marketing" },
  { name: "Sales" },
  { name: "HR" },
  { name: "Finance" },
  { name: "Operations" },
  { name: "Office Expenses" },
  { name: "Travel" },
  { name: "Legal & Compliance" },
  { name: "Training" },
  { name: "Hardware" },
  { name: "Consulting" },
  { name: "Recruitment" },
  { name: "Taxes" },
  { name: "Insurance" },
  { name: "Miscellaneous" },
];

/**
 * Seed the default system categories for a workspace. Idempotent — safe
 * to call even if some/all defaults already exist (e.g. workspace was
 * created before this phase and the migration already seeded it).
 */
async function seedDefaultsForWorkspace(workspaceId, ownerUserId) {
  return categoryRepository.bulkInsertDefaults(workspaceId, ownerUserId, DEFAULT_SYSTEM_CATEGORIES);
}

async function listCategories(workspaceId, filters) {
  return categoryRepository.listByWorkspace(workspaceId, filters);
}

async function getCategory(id, workspaceId) {
  const category = await categoryRepository.findByIdInWorkspace(id, workspaceId);
  if (!category) throw new ApiError(404, "Category not found");
  return category;
}

async function assertDepartmentInWorkspace(departmentId, workspaceId) {
  if (!departmentId) return;
  const department = await departmentRepository.findByIdInWorkspace(departmentId, workspaceId);
  if (!department) throw new ApiError(404, "Department not found");
}

async function assertNameAvailable(workspaceId, name, excludeId = null) {
  const existing = await categoryRepository.findByNameInWorkspace(workspaceId, name, excludeId);
  if (existing) {
    throw new ApiError(400, `A category named "${name}" already exists in this workspace.`);
  }
}

/**
 * Create a custom category. System categories are never created through
 * this path (is_system is always false here) — they only ever come from
 * seedDefaultsForWorkspace.
 */
async function createCategory(workspaceId, userId, payload) {
  const { name, description, departmentId, expenseType, icon, color, type } = payload;

  if (!name || !name.trim()) throw new ApiError(400, "Category name is required");
  await assertNameAvailable(workspaceId, name);
  await assertDepartmentInWorkspace(departmentId, workspaceId);

  return categoryRepository.create({
    workspace_id: workspaceId,
    user_id: userId,
    created_by: userId,
    department_id: departmentId || null,
    name: name.trim(),
    description: description || null,
    expense_type: expenseType || name.trim(),
    icon: icon || "CreditCard",
    color: color || "emerald",
    type: type || "expense",
    status: "active",
    sort_order: 0,
    is_system: false,
  });
}

/**
 * Update a category's editable fields (name, description, department,
 * expense_type, icon, color). System categories may be edited (see
 * DECISION note above) but never deleted.
 */
async function updateCategory(id, workspaceId, payload) {
  const existing = await categoryRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Category not found");

  const { name, description, departmentId, expenseType, icon, color } = payload;

  if (name !== undefined && name.trim() && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameAvailable(workspaceId, name.trim(), id);
  }
  if (departmentId !== undefined) {
    await assertDepartmentInWorkspace(departmentId, workspaceId);
  }

  return categoryRepository.update(id, {
    ...(name !== undefined && name.trim() && { name: name.trim() }),
    ...(description !== undefined && { description }),
    ...(departmentId !== undefined && { department_id: departmentId || null }),
    ...(expenseType !== undefined && { expense_type: expenseType }),
    ...(icon !== undefined && { icon }),
    ...(color !== undefined && { color }),
  });
}

/**
 * Activate / deactivate a category. Applies to system and custom
 * categories alike — deactivating hides it from new-transaction/budget
 * pickers without deleting it.
 */
async function updateCategoryStatus(id, workspaceId, status) {
  const existing = await categoryRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Category not found");

  return categoryRepository.update(id, { status });
}

/**
 * Delete a category. System categories can never be deleted — this is
 * the one action the PRD explicitly restricts to custom categories only.
 */
async function deleteCategory(id, workspaceId) {
  const existing = await categoryRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Category not found");

  if (existing.is_system) {
    throw new ApiError(400, "System categories cannot be deleted. Deactivate it instead.");
  }

  return categoryRepository.remove(id);
}

/**
 * Reorder categories within a workspace. `orderedIds` must be the
 * complete set of category ids currently in the workspace (partial
 * reordering isn't supported — the frontend sends the full list after a
 * drag-and-drop).
 */
async function reorderCategories(workspaceId, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new ApiError(400, "orderedIds must be a non-empty array");
  }

  const current = await categoryRepository.listByWorkspace(workspaceId, {});
  const currentIds = new Set(current.map((c) => c.id));
  const invalid = orderedIds.some((id) => !currentIds.has(id));
  if (invalid) {
    throw new ApiError(400, "orderedIds contains a category not in this workspace");
  }

  await categoryRepository.reorder(workspaceId, orderedIds);
  return categoryRepository.listByWorkspace(workspaceId, {});
}

module.exports = {
  DEFAULT_SYSTEM_CATEGORIES,
  seedDefaultsForWorkspace,
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
  reorderCategories,
};