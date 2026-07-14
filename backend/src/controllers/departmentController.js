/**
 * Department Controller
 * ------------------------------------------------------------------
 * Table: departments
 * Columns: id, workspace_id, name, is_active, created_at
 *
 * Route protection (see departmentRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.DEPARTMENTS_*)
 *
 * PRD §5.2 / §4 RBAC matrix:
 *   - Read (own department + list): Admin, Finance/Ops, Dept Lead, Employee
 *   - Create/Edit/Deactivate: Admin, Finance/Ops only
 *   - Never hard-delete a department with transaction history — only
 *     soft-delete via is_active. No deleteDepartment/DELETE route exists.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const departmentRepository = require("../repositories/departmentRepository");

// @desc    List all departments in the resolved workspace (active + inactive;
//          frontend distinguishes via is_active badge)
// @route   GET /api/departments
// @access  Member (departments.read)
const getDepartments = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const departments = await departmentRepository.listByWorkspace(req.workspace.id);
  return sendSuccess(res, { message: "Departments fetched", data: departments });
});

// @desc    Get a single department (must belong to the resolved workspace)
// @route   GET /api/departments/:id
// @access  Member (departments.read)
const getDepartmentById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const department = await departmentRepository.findByIdInWorkspace(
    req.params.id,
    req.workspace.id
  );
  if (!department) throw new ApiError(404, "Department not found");

  return sendSuccess(res, { message: "Department fetched", data: department });
});

// @desc    Create a department in the resolved workspace
// @route   POST /api/departments
// @access  Admin / Finance-Ops (departments.manage)
const createDepartment = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { name } = req.body;
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Department name is required");
  }

  const existing = await departmentRepository.findByNameInWorkspace(
    req.workspace.id,
    trimmedName
  );
  if (existing) {
    throw new ApiError(409, "A department with this name already exists");
  }

  const department = await departmentRepository.create({
    workspace_id: req.workspace.id,
    name: trimmedName,
    is_active: true,
  });

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

  const existing = await departmentRepository.findByIdInWorkspace(
    req.params.id,
    req.workspace.id
  );
  if (!existing) throw new ApiError(404, "Department not found");

  const { name, is_active } = req.body;
  const payload = {};

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      throw new ApiError(400, "Department name cannot be empty");
    }
    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await departmentRepository.findByNameInWorkspace(
        req.workspace.id,
        trimmedName
      );
      if (duplicate) {
        throw new ApiError(409, "A department with this name already exists");
      }
    }
    payload.name = trimmedName;
  }

  if (is_active !== undefined) {
    payload.is_active = Boolean(is_active);
  }

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  const updated = await departmentRepository.update(req.params.id, payload);
  return sendSuccess(res, { message: "Department updated", data: updated });
});

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
};