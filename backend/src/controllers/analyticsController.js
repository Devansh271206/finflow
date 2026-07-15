const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const analyticsService = require("../services/analyticsService");

// @desc    Expense breakdown by category
// @route   GET /api/analytics/expense-by-category
// @access  Private
const getExpenseByCategory = asyncHandler(async (req, res) => {
  const data = await analyticsService.getExpenseByCategory(req.user.id, req.workspace?.id);
  return sendSuccess(res, { message: "Expense by category fetched successfully", data });
});

// @desc    Income vs Expense (trailing 6 months)
// @route   GET /api/analytics/income-vs-expense
// @access  Private
const getIncomeVsExpense = asyncHandler(async (req, res) => {
  const data = await analyticsService.getIncomeVsExpense(req.user.id, req.workspace?.id);
  return sendSuccess(res, { message: "Income vs expense fetched successfully", data });
});

// @desc    Daily spending for the current month
// @route   GET /api/analytics/monthly-spending
// @access  Private
const getMonthlySpending = asyncHandler(async (req, res) => {
  const data = await analyticsService.getMonthlySpending(req.user.id, req.workspace?.id);
  return sendSuccess(res, { message: "Monthly spending fetched successfully", data });
});

// @desc    Weekly spending (trailing 8 weeks)
// @route   GET /api/analytics/weekly-spending
// @access  Private
const getWeeklySpending = asyncHandler(async (req, res) => {
  const data = await analyticsService.getWeeklySpending(req.user.id, req.workspace?.id);
  return sendSuccess(res, { message: "Weekly spending fetched successfully", data });
});

// @desc    Net + cumulative cash flow (trailing 6 months)
// @route   GET /api/analytics/cash-flow
// @access  Private
const getCashFlow = asyncHandler(async (req, res) => {
  const data = await analyticsService.getCashFlowTrend(req.user.id, req.workspace?.id);
  return sendSuccess(res, { message: "Cash flow fetched successfully", data });
});

// @desc    Savings growth over time
// @route   GET /api/analytics/savings-growth
// @access  Private
const getSavingsGrowth = asyncHandler(async (req, res) => {
  const data = await analyticsService.getSavingsGrowth(req.user.id, req.workspace?.id);
  return sendSuccess(res, { message: "Savings growth fetched successfully", data });
});

module.exports = {
  getExpenseByCategory,
  getIncomeVsExpense,
  getMonthlySpending,
  getWeeklySpending,
  getCashFlow,
  getSavingsGrowth,
};