const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const employeeEventRepository = require("../repositories/employeeEventRepository");
const employeeRepository = require("../repositories/employeeRepository");

// @desc    List timeline events for an employee (trigger-generated)
// @route   GET /api/employees/:employeeId/timeline
// @access  Private (EMPLOYEES_READ)
const getEmployeeTimeline = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;

  // Confirm the employee belongs to the caller's workspace before
  // returning any timeline rows — same assert-first pattern used by
  // salaryHistoryService/employeeDocumentService, just inlined here
  // since there's no other business logic to justify a separate
  // service file for a single read-only endpoint.
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, req.workspace.id);
  if (!employee) throw new ApiError(404, "Employee not found");

  const data = await employeeEventRepository.listByEmployee(employeeId);

  return sendSuccess(res, { message: "Employee timeline fetched successfully", data });
});

module.exports = { getEmployeeTimeline };
