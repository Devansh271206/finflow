/**
 * Category Controller
 * ------------------------------------------------------------------
 * Table: categories (see categoryRepository.js for full column list)
 *
 * Route protection (see categoryRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.CATEGORIES_*)
 *
 * Phase 2.2.1: refactored from direct-Supabase-in-controller to the
 * standard Routes -> Controllers -> Services -> Repositories layering
 * used everywhere else in this project. All 5 original endpoints
 * (GET /, GET /:id, POST /, PUT /:id, DELETE /:id) keep their existing
 * routes/response shape — Budgets.jsx's existing getCategories() call
 * is unaffected. New: GET / accepts search/department/status filters,
 * POST /:id/status (activate/deactivate), PATCH /reorder.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const categoryService = require("../services/categoryService");

// @desc    Get all categories for the resolved workspace, with optional
//          search/department/status filters
// @route   GET /api/categories?search=&department=&status=
// @access  Member (categories.read)
const getCategories = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { search, department, status } = req.query;
  const categories = await categoryService.listCategories(req.workspace.id, {
    search,
    department,
    status,
  });

  return sendSuccess(res, { message: "Categories fetched successfully", data: categories });
});

// @desc    Get a single category
// @route   GET /api/categories/:id
// @access  Member (categories.read)
const getCategoryById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const category = await categoryService.getCategory(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Category fetched successfully", data: category });
});

// @desc    Create a new custom category in the resolved workspace
// @route   POST /api/categories
// @access  Admin / Finance-Ops (categories.manage)
const createCategory = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { name, description, icon, color, type, department_id, expense_type } = req.body;

  const category = await categoryService.createCategory(req.workspace.id, req.user.id, {
    name,
    description,
    icon,
    color,
    type,
    departmentId: department_id,
    expenseType: expense_type,
  });

  return sendSuccess(res, { statusCode: 201, message: "Category created successfully", data: category });
});

// @desc    Update a category (name, description, department, expense
//          type, icon, color). See categoryService for the system-vs-
//          custom editability policy.
// @route   PUT /api/categories/:id
// @access  Admin / Finance-Ops (categories.manage)
const updateCategory = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { name, description, icon, color, department_id, expense_type } = req.body;

  const category = await categoryService.updateCategory(req.params.id, req.workspace.id, {
    name,
    description,
    icon,
    color,
    departmentId: department_id,
    expenseType: expense_type,
  });

  return sendSuccess(res, { message: "Category updated successfully", data: category });
});

// @desc    Activate or deactivate a category (system or custom)
// @route   PATCH /api/categories/:id/status
// @access  Admin / Finance-Ops (categories.manage)
const updateCategoryStatus = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { status } = req.body;
  if (!["active", "inactive"].includes(status)) {
    throw new ApiError(400, "status must be 'active' or 'inactive'");
  }

  const category = await categoryService.updateCategoryStatus(req.params.id, req.workspace.id, status);
  return sendSuccess(res, { message: "Category status updated successfully", data: category });
});

// @desc    Reorder categories within the resolved workspace
// @route   PATCH /api/categories/reorder
// @access  Admin / Finance-Ops (categories.manage)
const reorderCategories = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { ordered_ids } = req.body;
  const categories = await categoryService.reorderCategories(req.workspace.id, ordered_ids);
  return sendSuccess(res, { message: "Categories reordered successfully", data: categories });
});

// @desc    Delete a category. System categories are rejected with a 400
//          (see categoryService.deleteCategory) — deactivate instead.
// @route   DELETE /api/categories/:id
// @access  Admin / Finance-Ops (categories.manage)
const deleteCategory = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { id } = req.params;
  await categoryService.deleteCategory(id, req.workspace.id);
  return sendSuccess(res, { message: "Category deleted successfully", data: { id } });
});

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  reorderCategories,
  deleteCategory,
};