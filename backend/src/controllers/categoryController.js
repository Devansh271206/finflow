/**
 * Category Controller
 * ------------------------------------------------------------------
 * Table: categories
 * Columns: id, user_id, name, icon, color, type ('income'|'expense'), created_at
 */

const { supabaseAdmin } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { applyWorkspaceScope, workspaceIdForInsert } = require("../utils/workspaceScope");

// @desc    Get all categories for the authenticated user
// @route   GET /api/categories
// @access  Private
const getCategories = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  let query = supabaseAdmin
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  query = applyWorkspaceScope(query, req);

  const { data, error } = await query;

  if (error) throw new ApiError(500, "Failed to fetch categories", error.message);

  return sendSuccess(res, { message: "Categories fetched successfully", data: data || [] });
});

// @desc    Get a single category
// @route   GET /api/categories/:id
// @access  Private
const getCategoryById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to fetch category", error.message);
  if (!data) throw new ApiError(404, "Category not found");

  return sendSuccess(res, { message: "Category fetched successfully", data });
});

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private
const createCategory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, icon, color, type } = req.body;

  const payload = {
    user_id: userId,
    name,
    icon: icon || "CreditCard",
    color: color || "emerald",
    type: type || "expense",
    workspace_id: workspaceIdForInsert(req),
  };

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert([payload])
    .select("*")
    .single();

  if (error) throw new ApiError(500, "Failed to create category", error.message);

  return sendSuccess(res, { statusCode: 201, message: "Category created successfully", data });
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private
const updateCategory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, icon, color, type } = req.body;

  const payload = {
    ...(name !== undefined && { name }),
    ...(icon !== undefined && { icon }),
    ...(color !== undefined && { color }),
    ...(type !== undefined && { type }),
  };

  const { data, error } = await supabaseAdmin
    .from("categories")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to update category", error.message);
  if (!data) throw new ApiError(404, "Category not found");

  return sendSuccess(res, { message: "Category updated successfully", data });
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private
const deleteCategory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to delete category", error.message);
  if (!data) throw new ApiError(404, "Category not found");

  return sendSuccess(res, { message: "Category deleted successfully", data: { id } });
});

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
