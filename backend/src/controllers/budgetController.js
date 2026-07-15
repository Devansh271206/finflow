/**
 * Budget Controller
 * ------------------------------------------------------------------
 * Table: budgets (see budgetRepository.js for full column list)
 *
 * Route protection (see budgetRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.BUDGETS_*)
 *
 * Phase F.5: refactored from direct-Supabase-in-controller (including the
 * name-matching spend hack) to the standard Routes -> Controllers ->
 * Services -> Repositories layering used by categories/departments.
 * Response shape is intentionally close to the old attachSpendData()
 * output (limit/spent/remaining/utilization/category/icon/color) so the
 * frontend's Budgets.jsx keeps working without changes.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const budgetService = require("../services/budgetService");

// @desc    Get all budgets for the resolved workspace (enriched with
//          spend + utilization)
// @route   GET /api/budgets?department_id=
// @access  Member (budgets.read)
const getBudgets = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { department_id } = req.query;
  const budgets = await budgetService.getBudgetsForWorkspace(req.workspace.id, {
    departmentId: department_id,
  });

  return sendSuccess(res, { message: "Budgets fetched successfully", data: budgets });
});

// @desc    Get a single budget
// @route   GET /api/budgets/:id
// @access  Member (budgets.read)
const getBudgetById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const budget = await budgetService.getBudget(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Budget fetched successfully", data: budget });
});

// @desc    Create a new budget in the resolved workspace
// @route   POST /api/budgets
// @access  Admin / Finance-Ops (budgets.manage)
const createBudget = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { categoryId, departmentId, limit, periodType, periodStart } = req.body;

  const budget = await budgetService.createBudget(req.workspace.id, req.user.id, {
    categoryId,
    departmentId,
    limit,
    periodType,
    periodStart,
  });

  return sendSuccess(res, { statusCode: 201, message: "Budget created successfully", data: budget });
});

// @desc    Update a budget
// @route   PUT /api/budgets/:id
// @access  Admin / Finance-Ops (budgets.manage)
const updateBudget = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { categoryId, departmentId, limit, periodType, periodStart } = req.body;

  const budget = await budgetService.updateBudget(req.params.id, req.workspace.id, {
    categoryId,
    departmentId,
    limit,
    periodType,
    periodStart,
  });

  return sendSuccess(res, { message: "Budget updated successfully", data: budget });
});

// @desc    Delete a budget
// @route   DELETE /api/budgets/:id
// @access  Admin / Finance-Ops (budgets.manage)
const deleteBudget = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { id } = req.params;
  await budgetService.deleteBudget(id, req.workspace.id);
  return sendSuccess(res, { message: "Budget deleted successfully", data: { id } });
});

module.exports = { getBudgets, getBudgetById, createBudget, updateBudget, deleteBudget };