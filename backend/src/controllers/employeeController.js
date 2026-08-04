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
 *
 * Sprint 7: getEmployees now reads search/sortBy/sortOrder/page/pageSize
 * from the querystring — the service/repository already supported all
 * of this, this was the only layer not passing it through. Also wires
 * phone/address/emergencyContactName/emergencyContactPhone/notes on
 * create/update.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const employeeService = require("../services/employeeService");
const departmentRepository = require("../repositories/departmentRepository");

// @desc    Get all employees for the resolved workspace
// @route   GET /api/employees?department_id=&employment_status=&employment_type=
//              &search=&sort_by=&sort_order=&page=&page_size=
// @access  Admin / HR (employees.read, unscoped) / Dept Lead (scoped)
const getEmployees = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  let {
    department_id,
    employment_status,
    employment_type,
    search,
    sort_by,
    sort_order,
    page,
    page_size,
  } = req.query;

  // Department Lead scope restriction
  if (req.membership && req.membership.roleKey === 'DEPARTMENT_LEAD') {
    department_id = req.membership.departmentId;
  }

  const result = await employeeService.getEmployeesForWorkspace(req.workspace.id, {
    departmentId: department_id,
    status: employment_status,
    employmentType: employment_type,
    search,
    sortBy: sort_by,
    sortOrder: sort_order,
    page,
    pageSize: page_size,
  });

  // data is the full { items, total, page, pageSize } object — this
  // matches the ORIGINAL contract (confirmed against Frontend/src/pages/
  // Employees.jsx, which already reads `data?.items`). No meta param
  // needed here after all; the apiResponse.js addition is harmless to
  // keep but unused by this endpoint.
  return sendSuccess(res, {
    message: "Employees fetched successfully",
    data: result,
  });
});

// @desc    Get current user's employee record
// @route   GET /api/employees/me
// @access  Authenticated (un-gated by permissions)
const getSelfEmployee = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  // Fetch all employees in the workspace to bypass service limitations, then filter by userId
  const result = await employeeService.getEmployeesForWorkspace(req.workspace.id, { pageSize: 1000 });
  let employee = result.items.find((emp) => emp.user_id === req.user.id);

  if (!employee) {
    // Auto-create an employee record for this user if one doesn't exist
    // First, find or create a default department
    let departments = await departmentRepository.listByWorkspace(req.workspace.id);
    let defaultDept = departments.find(d => d.is_active !== false) || departments[0];

    if (!defaultDept) {
      defaultDept = await departmentRepository.create({ workspace_id: req.workspace.id, name: "General" });
    }

    const fullName = req.user.user_metadata?.full_name
      || req.user.email?.split("@")[0]
      || "User";

    const employeeCode =
      `EMP-${fullName.substring(0, 4).toUpperCase()}${req.user.id.substring(0, 4).toUpperCase()}`;

    employee = await employeeService.createEmployee(req.workspace.id, {
      employeeCode,
      fullName,
      email: req.user.email,
      designation: "Member",
      departmentId: defaultDept.id,
      userId: req.user.id,
      dateOfJoining: new Date().toISOString().split("T")[0],
      employmentStatus: "active",
      employmentType: "full_time",
    });
  }
  
  return sendSuccess(res, { message: "Employee record fetched successfully", data: employee });
});

// @desc    Get a single employee
// @route   GET /api/employees/:id
// @access  Admin / HR (employees.read, unscoped) / Dept Lead (scoped)
const getEmployeeById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const employee = await employeeService.getEmployee(req.params.id, req.workspace.id);
  
  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  // Department Lead scope restriction
  if (req.membership && req.membership.roleKey === 'DEPARTMENT_LEAD') {
    if (employee.departmentId !== req.membership.departmentId) {
      throw new ApiError(403, "Not authorized to view employees outside your department");
    }
  }

  return sendSuccess(res, { message: "Employee fetched successfully", data: employee });
});

// @desc    Get an employee's direct reports
// @route   GET /api/employees/:id/reports
// @access  Admin / HR (employees.read, unscoped) / Dept Lead (scoped)
const getDirectReports = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  // Department Lead scope restriction
  if (req.membership && req.membership.roleKey === 'DEPARTMENT_LEAD') {
    const manager = await employeeService.getEmployee(req.params.id, req.workspace.id);
    if (!manager || manager.departmentId !== req.membership.departmentId) {
      throw new ApiError(403, "Not authorized to view direct reports outside your department");
    }
  }

  const reports = await employeeService.getDirectReports(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Direct reports fetched successfully", data: reports });
});

// @desc    Create a new employee in the resolved workspace
// @route   POST /api/employees
// @access  Admin / HR (employees.manage)
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
    employmentType,
    dateOfJoining,
    email,
    phone,
    address,
    emergencyContactName,
    emergencyContactPhone,
    notes,
  } = req.body;

  const employee = await employeeService.createEmployee(req.workspace.id, {
    employeeCode,
    fullName,
    designation,
    departmentId,
    reportingManagerId,
    userId,
    employmentStatus,
    employmentType,
    dateOfJoining,
    email,
    phone,
    address,
    emergencyContactName,
    emergencyContactPhone,
    notes,
  });

  return sendSuccess(res, { statusCode: 201, message: "Employee created successfully", data: employee });
});

// @desc    Update an employee
// @route   PUT /api/employees/:id
// @access  Admin / HR (employees.manage)
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
    employmentType,
    dateOfJoining,
    dateOfExit,
    email,
    phone,
    address,
    emergencyContactName,
    emergencyContactPhone,
    notes,
  } = req.body;

  const employee = await employeeService.updateEmployee(req.params.id, req.workspace.id, {
    employeeCode,
    fullName,
    designation,
    departmentId,
    reportingManagerId,
    userId,
    employmentStatus,
    employmentType,
    dateOfJoining,
    dateOfExit,
    email,
    phone,
    address,
    emergencyContactName,
    emergencyContactPhone,
    notes,
  });

  return sendSuccess(res, { message: "Employee updated successfully", data: employee });
});

// @desc    Terminate an employee (soft-delete equivalent — sets
//          employment_status='terminated' + date_of_exit; no hard-delete
//          route exists on purpose, mirrors departments)
// @route   POST /api/employees/:id/terminate
// @access  Admin / HR (employees.manage)
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

// @desc    Soft-delete an employee record (is_active = false)
// @route   DELETE /api/employees/:id
// @access  Admin / HR (employees.manage)
const deleteEmployeeRecord = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const employee = await employeeService.deleteEmployee(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Employee record deleted", data: employee });
});

// @desc    Restore a soft-deleted employee record (is_active = true)
// @route   POST /api/employees/:id/restore
// @access  Admin / HR (employees.manage)
const restoreEmployeeRecord = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const employee = await employeeService.restoreEmployee(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Employee record restored", data: employee });
});

module.exports = {
  getEmployees,
  getSelfEmployee,
  getEmployeeById,
  getDirectReports,
  createEmployee,
  updateEmployee,
  terminateEmployee,
  deleteEmployee: deleteEmployeeRecord,
  restoreEmployee: restoreEmployeeRecord,
};