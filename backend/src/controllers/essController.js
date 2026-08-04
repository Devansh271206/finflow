/**
 * ESS (Employee Self-Service) Controller
 * ------------------------------------------------------------------
 * Sprint 13. Thin wrapper over essService — no business logic here,
 * matching every other controller in this codebase (e.g.
 * departmentController.js, teamController.js).
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const essService = require("../services/essService");

// @desc    Get the authenticated employee's My Portal overview
//          (profile summary, employment snapshot, leave balances +
//          pending requests, latest payslip, notification preview)
// @route   GET /api/ess/overview
// @access  Private (any authenticated user with a linked employee
//          record in the active workspace — not gated by a role
//          permission, same as GET /api/employees/me)
const getMyOverview = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const data = await essService.getMyOverview(req.user.id, req.workspace.id);

  return sendSuccess(res, { message: "My Portal overview fetched successfully", data });
});

module.exports = { getMyOverview };
