/**
 * Budget Service
 * ------------------------------------------------------------------
 * Business logic for budgets: create/update with category & department
 * validation, and wiring the spend computation (budgetRepository) into
 * a consistent read path. Framework-agnostic per PRD §10.1 layering.
 *
 * DECISION (flagging per phase-brief output rules): spend is recomputed
 * on every list/get call AND persisted back via persistSpend(), so
 * amount_spent stays queryable/sortable in the DB (useful for future
 * dashboard queries that need to sort/filter by utilization without
 * pulling every transaction into memory) while still always being
 * accurate at read time. If read volume grows large enough that
 * recomputing on every GET becomes a cost concern, this is the one
 * function (getBudgetsForWorkspace) to move to a scheduled job instead —
 * flag it if you want that now rather than later.
 */

const budgetRepository = require("../repositories/budgetRepository");
const categoryRepository = require("../repositories/categoryRepository");
const departmentRepository = require("../repositories/departmentRepository");
const ApiError = require("../utils/ApiError");

async function assertCategoryInWorkspace(categoryId, workspaceId) {
  if (!categoryId) return;
  const category = await categoryRepository.findByIdInWorkspace(categoryId, workspaceId);
  if (!category) throw new ApiError(400, "Selected category does not exist in this workspace");
}

async function assertDepartmentInWorkspace(departmentId, workspaceId) {
  if (!departmentId) return;
  const department = await departmentRepository.findByIdInWorkspace(departmentId, workspaceId);
  if (!department) throw new ApiError(404, "Department not found");
}

function enrichWithSpend(budget, spendByBudgetId) {
  const spent = spendByBudgetId.get(budget.id) ?? budget.amount_spent ?? 0;
  const limit = Number(budget.amount_limit ?? budget.monthly_limit ?? 0);

  return {
    id: budget.id,
    workspace_id: budget.workspace_id,
    department_id: budget.department_id,
    department: budget.departments?.name || null,
    category_id: budget.category_id,
    category: budget.categories?.name || "Uncategorized",
    icon: budget.categories?.icon || "CreditCard",
    color: budget.categories?.color || "emerald",
    period_type: budget.period_type || "monthly",
    period_start: budget.period_start,
    limit,
    amount_limit: limit,
    spent,
    amount_spent: spent,
    remaining: Math.max(limit - spent, 0),
    utilization: limit > 0 ? Math.round((spent / limit) * 100) : 0,
    created_at: budget.created_at,
    updated_at: budget.updated_at,
  };
}

/**
 * Lists budgets for a workspace with fresh, correctly-scoped spend data
 * (workspace_id + category_id/department_id join — see budgetRepository
 * for the root-cause fix this replaces). Persists the recomputed
 * amount_spent back to each row before returning.
 */
async function getBudgetsForWorkspace(workspaceId, filters = {}) {
  const budgets = await budgetRepository.listByWorkspace(workspaceId, filters);
  if (!budgets.length) return [];

  const spendByBudgetId = await budgetRepository.computeSpendForBudgets(workspaceId, budgets);
  await budgetRepository.persistSpend(spendByBudgetId);

  return budgets.map((b) => enrichWithSpend(b, spendByBudgetId));
}

async function getBudget(id, workspaceId) {
  const budget = await budgetRepository.findByIdInWorkspace(id, workspaceId);
  if (!budget) throw new ApiError(404, "Budget not found");

  const spendByBudgetId = await budgetRepository.computeSpendForBudgets(workspaceId, [budget]);
  await budgetRepository.persistSpend(spendByBudgetId);

  return enrichWithSpend(budget, spendByBudgetId);
}

/**
 * Creates a budget. Requires either categoryId or departmentId (or both)
 * so spend can actually be attributed — a budget with neither would never
 * match any transaction and would always show 0 spent, which is a silent
 * footgun rather than a useful "workspace-wide" budget type (that's out
 * of scope here; flag if you want a true workspace-wide budget type).
 */
async function createBudget(workspaceId, userId, payload) {
  const { categoryId, departmentId, limit, periodType, periodStart } = payload;

  if (!categoryId && !departmentId) {
    throw new ApiError(400, "A budget must be scoped to a category or a department");
  }
  if (!limit || Number(limit) <= 0) {
    throw new ApiError(400, "limit must be a positive number");
  }

  await assertCategoryInWorkspace(categoryId, workspaceId);
  await assertDepartmentInWorkspace(departmentId, workspaceId);

  const start = periodStart ? new Date(periodStart) : new Date();
  const normalizedStart = new Date(start.getFullYear(), start.getMonth(), 1);

  const budget = await budgetRepository.create({
    workspace_id: workspaceId,
    user_id: userId,
    category_id: categoryId || null,
    department_id: departmentId || null,
    period_type: periodType || "monthly",
    period_start: normalizedStart.toISOString().slice(0, 10),
    amount_limit: Number(limit),
    amount_spent: 0,
    // legacy columns kept in sync for any code path not yet migrated off them
    monthly_limit: Number(limit),
    month: normalizedStart.getMonth() + 1,
    year: normalizedStart.getFullYear(),
  });

  return getBudget(budget.id, workspaceId);
}

async function updateBudget(id, workspaceId, payload) {
  const existing = await budgetRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Budget not found");

  const { categoryId, departmentId, limit, periodType, periodStart } = payload;

  if (categoryId !== undefined) await assertCategoryInWorkspace(categoryId, workspaceId);
  if (departmentId !== undefined) await assertDepartmentInWorkspace(departmentId, workspaceId);

  const updatePayload = {
    ...(categoryId !== undefined && { category_id: categoryId || null }),
    ...(departmentId !== undefined && { department_id: departmentId || null }),
    ...(periodType !== undefined && { period_type: periodType }),
    ...(limit !== undefined && { amount_limit: Number(limit), monthly_limit: Number(limit) }),
  };

  if (periodStart !== undefined) {
    const start = new Date(periodStart);
    const normalizedStart = new Date(start.getFullYear(), start.getMonth(), 1);
    updatePayload.period_start = normalizedStart.toISOString().slice(0, 10);
    updatePayload.month = normalizedStart.getMonth() + 1;
    updatePayload.year = normalizedStart.getFullYear();
  }

  await budgetRepository.update(id, workspaceId, updatePayload);
  return getBudget(id, workspaceId);
}

async function deleteBudget(id, workspaceId) {
  const existing = await budgetRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Budget not found");

  return budgetRepository.remove(id, workspaceId);
}

module.exports = {
  getBudgetsForWorkspace,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
};