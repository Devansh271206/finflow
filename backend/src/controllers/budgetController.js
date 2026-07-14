/**
 * Budget Controller
 * ------------------------------------------------------------------
 * Table: budgets
 * Columns: id, user_id, category_id, monthly_limit, month, year, created_at
 *
 * Budgets are enriched on read with:
 *  - category name/icon/color (joined from `categories`)
 *  - actual amount spent this month/category (aggregated from `transactions`)
 */

const { supabaseAdmin } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { applyWorkspaceScope, workspaceIdForInsert } = require("../utils/workspaceScope");

async function attachSpendData(budgets, userId) {
  if (!budgets.length) return [];

  const now = new Date();
  const { data: transactions, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("amount, type, category, category_id")
    .eq("user_id", userId)
    .neq("type", "income");

  if (txError) throw new ApiError(500, "Failed to compute budget spend", txError.message);

  const { data: categories } = await supabaseAdmin
    .from("categories")
    .select("id, name, icon, color")
    .eq("user_id", userId);

  const categoriesById = new Map((categories || []).map((c) => [c.id, c]));

  const spentByKey = new Map();
  (transactions || []).forEach((t) => {
    const key = t.category_id ? `id:${t.category_id}` : `name:${(t.category || "Uncategorized").toLowerCase()}`;
    spentByKey.set(key, (spentByKey.get(key) || 0) + Math.abs(Number(t.amount || 0)));
  });

  return budgets.map((budget) => {
    const category = categoriesById.get(budget.category_id) || null;
    const key = budget.category_id
      ? `id:${budget.category_id}`
      : `name:${(category?.name || "uncategorized").toLowerCase()}`;
    const spent = Math.round(spentByKey.get(key) || 0);
    const limit = Number(budget.monthly_limit || 0);

    return {
      id: budget.id,
      category: category?.name || "Uncategorized",
      category_id: budget.category_id,
      icon: category?.icon || "CreditCard",
      color: category?.color || "emerald",
      monthly_limit: limit,
      limit,
      spent,
      remaining: Math.max(limit - spent, 0),
      utilization: limit > 0 ? Math.round((spent / limit) * 100) : 0,
      month: budget.month || now.getMonth() + 1,
      year: budget.year || now.getFullYear(),
      created_at: budget.created_at,
    };
  });
}

// @desc    Get all budgets (enriched with spend + utilization)
// @route   GET /api/budgets
// @access  Private
const getBudgets = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let query = supabaseAdmin
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  query = applyWorkspaceScope(query, req);

  const { data, error } = await query;

  if (error) throw new ApiError(500, "Failed to fetch budgets", error.message);

  const enriched = await attachSpendData(data || [], userId);

  return sendSuccess(res, { message: "Budgets fetched successfully", data: enriched });
});

// @desc    Get a single budget
// @route   GET /api/budgets/:id
// @access  Private
const getBudgetById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("budgets")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to fetch budget", error.message);
  if (!data) throw new ApiError(404, "Budget not found");

  const [enriched] = await attachSpendData([data], userId);

  return sendSuccess(res, { message: "Budget fetched successfully", data: enriched });
});

// @desc    Create a new budget
// @route   POST /api/budgets
// @access  Private
const createBudget = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { categoryId, limit, month, year } = req.body;
  const now = new Date();

  if (categoryId) {
    const { data: categoryRow, error: categoryError } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("user_id", userId)
      .maybeSingle();

    if (categoryError) throw new ApiError(500, "Failed to validate category", categoryError.message);
    if (!categoryRow) throw new ApiError(400, "Selected category does not exist");
  }

  const payload = {
    user_id: userId,
    category_id: categoryId || null,
    monthly_limit: Number(limit),
    month: month || now.getMonth() + 1,
    year: year || now.getFullYear(),
    workspace_id: workspaceIdForInsert(req),
  };

  const { data, error } = await supabaseAdmin
    .from("budgets")
    .insert([payload])
    .select("*")
    .single();

  if (error) {
  console.error("Supabase Error:", error);
  throw new ApiError(500, "Failed to create budget", error.message);
}

  const [enriched] = await attachSpendData([data], userId);

  return sendSuccess(res, { statusCode: 201, message: "Budget created successfully", data: enriched });
});

// @desc    Update a budget
// @route   PUT /api/budgets/:id
// @access  Private
const updateBudget = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { categoryId, limit, month, year } = req.body;

  if (categoryId) {
    const { data: categoryRow, error: categoryError } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("user_id", userId)
      .maybeSingle();

    if (categoryError) throw new ApiError(500, "Failed to validate category", categoryError.message);
    if (!categoryRow) throw new ApiError(400, "Selected category does not exist");
  }

  const payload = {
    ...(categoryId !== undefined && { category_id: categoryId || null }),
    ...(limit !== undefined && { monthly_limit: Number(limit) }),
    ...(month !== undefined && { month }),
    ...(year !== undefined && { year }),
  };

  const { data, error } = await supabaseAdmin
    .from("budgets")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to update budget", error.message);
  if (!data) throw new ApiError(404, "Budget not found");

  const [enriched] = await attachSpendData([data], userId);

  return sendSuccess(res, { message: "Budget updated successfully", data: enriched });
});

// @desc    Delete a budget
// @route   DELETE /api/budgets/:id
// @access  Private
const deleteBudget = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to delete budget", error.message);
  if (!data) throw new ApiError(404, "Budget not found");

  return sendSuccess(res, { message: "Budget deleted successfully", data: { id } });
});

module.exports = { getBudgets, getBudgetById, createBudget, updateBudget, deleteBudget };