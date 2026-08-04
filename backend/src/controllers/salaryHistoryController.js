const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const salaryHistoryService = require("../services/salaryHistoryService");

// @desc    List salary history for an employee
// @route   GET /api/employees/:employeeId/salary-history
// @access  Private (EMPLOYEES_READ + active salary.read_department grant)
const getSalaryHistory = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;
  const data = await salaryHistoryService.listForEmployee(
    employeeId,
    req.workspace.id,
    req.membership?.id,
    req.user.id
  );

  return sendSuccess(res, { message: "Salary history fetched successfully", data });
});

// @desc    Create a new salary revision
// @route   POST /api/employees/:employeeId/salary-history
// @access  Private (EMPLOYEES_MANAGE)
const createSalaryRevision = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;
  const {
    effectiveDate,
    ctcAnnual,
    baseSalary,
    allowances,
    bonusAmount,
    revisionReason,
  } = req.body;

  const data = await salaryHistoryService.createRevision(
    employeeId,
    req.workspace.id,
    { effectiveDate, ctcAnnual, baseSalary, allowances, bonusAmount, revisionReason },
    req.user.id
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Salary revision recorded successfully",
    data,
  });
});

module.exports = { getSalaryHistory, createSalaryRevision };
