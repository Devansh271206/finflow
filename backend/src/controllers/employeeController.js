/**
 * Employee Controller
 * ------------------------------------------------------------------
 * Table: employees (see employeeRepository.js for full column list)
 *
 * Route protection (see employeeRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.EMPLOYEES_*)
 *
 * Phase E.2: Routes -> Controllers -> Services -> Repositories layering,
 * same pattern as budgetController.js / departmentController.js.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const employeeService = require("../services/employeeService");

// @desc    Get all employees for the resolved workspace
// @route   GET /api/employees?department_id=&employment_status=
// @access  Member (employees.read)
const getEmployees = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { department_id, employment_status } = req.query;
  const employees = await employeeService.getEmployeesForWorkspace(req.workspace.id, {
    departmentId: department_id,
    employmentStatus: employment_status,
  });

  return sendSuccess(res, { message: "Employees fetched successfully", data: employees });
});

// @desc    Get a single employee
// @route   GET /api/employees/:id
// @access  Member (employees.read)
const getEmployeeById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const employee = await employeeService.getEmployee(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Employee fetched successfully", data: employee });
});

// @desc    Get an employee's direct reports
// @route   GET /api/employees/:id/reports
// @access  Member (employees.read)
const getDirectReports = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const reports = await employeeService.getDirectReports(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Direct reports fetched successfully", data: reports });
});

// @desc    Create a new employee in the resolved workspace
// @route   POST /api/employees
// @access  Admin / Finance-Ops (employees.manage)
const createEmployee = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const {
    employeeCode,
    fullName,
    designation,
    departmentId,
    reportingManagerId,
    userId,
    employmentStatus,
    dateOfJoining,
  } = req.body;

  const employee = await employeeService.createEmployee(req.workspace.id, {
    employeeCode,
    fullName,
    designation,
    departmentId,
    reportingManagerId,
    userId,
    employmentStatus,
    dateOfJoining,
  });

  return sendSuccess(res, { statusCode: 201, message: "Employee created successfully", data: employee });
});

// @desc    Update an employee
// @route   PUT /api/employees/:id
// @access  Admin / Finance-Ops (employees.manage)
const updateEmployee = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const {
    employeeCode,
    fullName,
    designation,
    departmentId,
    reportingManagerId,
    userId,
    employmentStatus,
    dateOfJoining,
    dateOfExit,
  } = req.body;

  const employee = await employeeService.updateEmployee(req.params.id, req.workspace.id, {
    employeeCode,
    fullName,
    designation,
    departmentId,
    reportingManagerId,
    userId,
    employmentStatus,
    dateOfJoining,
    dateOfExit,
  });

  return sendSuccess(res, { message: "Employee updated successfully", data: employee });
});

// @desc    Terminate an employee (soft-delete equivalent — sets
//          employment_status='terminated' + date_of_exit; no hard-delete
//          route exists on purpose, mirrors departments)
// @route   POST /api/employees/:id/terminate
// @access  Admin / Finance-Ops (employees.manage)
const terminateEmployee = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { dateOfExit } = req.body;
  const employee = await employeeService.terminateEmployee(req.params.id, req.workspace.id, {
    dateOfExit,
  });

  return sendSuccess(res, { message: "Employee terminated successfully", data: employee });
});

module.exports = {
  getEmployees,
  getEmployeeById,
  getDirectReports,
  createEmployee,
  updateEmployee,
  terminateEmployee,
};