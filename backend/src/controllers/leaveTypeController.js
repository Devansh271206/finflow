/**
 * Leave Type Controller
 * ------------------------------------------------------------------
 * Table: leave_types
 * Columns: id, workspace_id, name, is_paid, default_annual_days,
 *          is_active, created_at, updated_at
 *
 * Route protection (see leaveTypeRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.LEAVE_*)
 *
 * PRD §15.16 RBAC:
 *   - Read (list + get): Employee, Department Lead, HR, Organization Admin
 *   - Create/Edit/Deactivate: HR, Organization Admin only
 *   - Never hard-delete a leave type with request history — only
 *     soft-delete via is_active. No deleteLeaveType/DELETE route exists
 *     (same convention as departmentController.js).
 *
 * Follows routes -> controllers -> services -> repositories (PRD §14),
 * same layering as departmentController.js/departmentService.js.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const leaveTypeService = require("../services/leaveTypeService");

// @desc    List all leave types in the resolved workspace (active + inactive;
//          frontend distinguishes via is_active badge)
// @route   GET /api/leave-types?search=&status=&sort_by=&sort_order=&page=&page_size=
// @access  Member (leave.read)
const getLeaveTypes = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { search, status, sort_by, sort_order, page, page_size } = req.query;

  let result = await leaveTypeService.listLeaveTypes(req.workspace.id, {
    search,
    status,
    sortBy: sort_by,
    sortOrder: sort_order,
    page,
    limit: page_size,
  });

  // Auto-seed default leave types if none exist (first access)
  const list = Array.isArray(result) ? result : result.data;
  if (!search && (!list || list.length === 0)) {
    const defaults = [
      { name: "Annual Leave", is_paid: true, default_annual_days: 18 },
      { name: "Sick Leave", is_paid: true, default_annual_days: 12 },
      { name: "Casual Leave", is_paid: true, default_annual_days: 10 },
      { name: "Personal Leave", is_paid: true, default_annual_days: 6 },
    ];
    for (const lt of defaults) {
      try {
        await leaveTypeService.createLeaveType(req.workspace.id, lt, req.user.id);
      } catch (_) { /* ignore duplicates */ }
    }
    result = await leaveTypeService.listLeaveTypes(req.workspace.id, {
      search,
      status,
      sortBy: sort_by,
      sortOrder: sort_order,
      page,
      limit: page_size,
    });
  }

  // No pagination requested -> result is a plain array. Pagination
  // requested -> shape it the same way departmentController.js's
  // getDepartments does ({ items, total, page, pageSize }) so the
  // frontend can reuse the same pagination component.
  const data = Array.isArray(result)
    ? result
    : { items: result.data, total: result.total, page: result.page, pageSize: result.limit };

  return sendSuccess(res, { message: "Leave types fetched", data });
});

// @desc    Get a single leave type (must belong to the resolved workspace)
// @route   GET /api/leave-types/:id
// @access  Member (leave.read)
const getLeaveTypeById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const leaveType = await leaveTypeService.getLeaveType(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Leave type fetched", data: leaveType });
});

// @desc    Create a leave type in the resolved workspace
// @route   POST /api/leave-types
// @access  HR / Organization Admin (leave.manage)
const createLeaveType = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const leaveType = await leaveTypeService.createLeaveType(
    req.workspace.id,
    {
      name: req.body.name,
      is_paid: req.body.is_paid,
      default_annual_days: req.body.default_annual_days,
    },
    req.user?.id
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Leave type created",
    data: leaveType,
  });
});

// @desc    Rename, adjust is_paid/default_annual_days, and/or activate/
//          deactivate a leave type. Soft-delete only — there is no
//          hard-delete path (leave_requests.leave_type_id is
//          ON DELETE RESTRICT, migration 014).
// @route   PATCH /api/leave-types/:id
// @access  HR / Organization Admin (leave.manage)
const updateLeaveType = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const updated = await leaveTypeService.updateLeaveType(
    req.params.id,
    req.workspace.id,
    {
      name: req.body.name,
      is_paid: req.body.is_paid,
      default_annual_days: req.body.default_annual_days,
      is_active: req.body.is_active,
    },
    req.user?.id
  );

  return sendSuccess(res, { message: "Leave type updated", data: updated });
});

module.exports = {
  getLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
};