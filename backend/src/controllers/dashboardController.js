const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const dashboardService = require("../services/dashboardService");

// @desc    Get full dashboard summary: balance, income, expenses, cash flow,
//          recent transactions, monthly summary, budget utilization, health score
// @route   GET /api/dashboard
// @access  Private
const getDashboard = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const userId = req.user.id;
  const summary = await dashboardService.getDashboardSummary(userId, req.workspace.id);

  return sendSuccess(res, {
    message: "Dashboard data fetched successfully",
    data: summary,
  });
});

module.exports = { getDashboard };
