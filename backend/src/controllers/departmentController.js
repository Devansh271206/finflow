/**
 * Department Controller
 * ------------------------------------------------------------------
 * Table: departments
 * Columns: id, workspace_id, name, is_active, department_head_employee_id,
 *          created_at
 *
 * Route protection (see departmentRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.DEPARTMENTS_*)
 *
 * PRD §5.2 / §4 RBAC matrix:
 *   - Read (own department + list): Admin, Finance/Ops, Dept Lead, Employee
 *   - Create/Edit/Deactivate/Assign Head: Admin, Finance/Ops only
 *   - Never hard-delete a department with transaction history — only
 *     soft-delete via is_active. No deleteDepartment/DELETE route exists.
 *
 * Sprint 8: now routes through departmentService.js (routes -> controllers
 * -> services -> repositories, PRD §14) instead of calling
 * departmentRepository.js directly, same layering as employeeController.js.
 * getDepartments also now reads search/sort_by/sort_order/page/page_size
 * from the querystring, same convention as employeeController.js's
 * getEmployees, and adds assignDepartmentHead.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const departmentService = require("../services/departmentService");

// @desc    List all departments in the resolved workspace (active + inactive;
//          frontend distinguishes via is_active badge)
// @route   GET /api/departments?search=&status=&sort_by=&sort_order=&page=&page_size=
// @access  Member (departments.read)
const getDepartments = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { search, status, sort_by, sort_order, page, page_size } = req.query;

  const result = await departmentService.listDepartments(req.workspace.id, {
    search,
    status,
    sortBy: sort_by,
    sortOrder: sort_order,
    page,
    limit: page_size,
  });

  // No pagination requested -> result is a plain array (unchanged
  // contract, same as before Sprint 8). Pagination requested -> shape
  // it the same way employeeController.js's getEmployees does
  // ({ items, total, page, pageSize }) so the frontend can reuse the
  // same pagination component/pattern.
  const data = Array.isArray(result)
    ? result
    : { items: result.data, total: result.total, page: result.page, pageSize: result.limit };

  return sendSuccess(res, { message: "Departments fetched", data });
});

// @desc    Get a single department (must belong to the resolved workspace)
// @route   GET /api/departments/:id
// @access  Member (departments.read)
const getDepartmentById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const department = await departmentService.getDepartment(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Department fetched", data: department });
});

// @desc    Create a department in the resolved workspace
// @route   POST /api/departments
// @access  Admin / Finance-Ops (departments.manage)
const createDepartment = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const department = await departmentService.createDepartment(
    req.workspace.id,
    { name: req.body.name },
    req.user?.id
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Department created",
    data: department,
  });
});

// @desc    Rename and/or activate/deactivate a department. Soft-delete
//          only — there is no hard-delete path (PRD §5.2).
// @route   PATCH /api/departments/:id
// @access  Admin / Finance-Ops (departments.manage)
const updateDepartment = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const updated = await departmentService.updateDepartment(
    req.params.id,
    req.workspace.id,
    { name: req.body.name, is_active: req.body.is_active },
    req.user?.id
  );

  return sendSuccess(res, { message: "Department updated", data: updated });
});

// @desc    Assign (or clear, with employee_id: null) the Department Head
// @route   PATCH /api/departments/:id/head
// @access  Admin / Finance-Ops (departments.manage)
const assignDepartmentHead = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const updated = await departmentService.assignHead(
    req.params.id,
    req.workspace.id,
    req.body.employee_id,
    req.user?.id
  );

  return sendSuccess(res, { message: "Department head updated", data: updated });
});

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  assignDepartmentHead,
};