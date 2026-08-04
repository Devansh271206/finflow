/**
 * Leave Request Controller
 * ------------------------------------------------------------------
 * Table: leave_requests (see leaveRequestRepository.js for full column
 * list). Status values: pending, dept_approved, approved, rejected,
 * cancelled.
 *
 * Route protection (see leaveRequestRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.LEAVE_*)
 *
 * PRD §15.16 RBAC: Employee — own leave only (submit/view/cancel while
 * pending). Department Lead — approve/reject for own department
 * (first-stage). HR — approval override, full CRUD. Organization Admin
 * — full authority. Same roleKey convention as approvalService.js
 * (ADMIN / FINANCE / DEPARTMENT_LEAD) is used here to decide whether an
 * approve action is a Dept Lead's first-stage approval or an HR/Admin
 * final approval — authorize(PERMISSIONS.LEAVE_APPROVE) only confirms
 * SOME approval authority exists, same gap noted in approvalService.js
 * for expense approvals.
 *
 * Same "own employee_id resolution" gap flagged in
 * leaveBalanceController.js applies here: employee-scoped endpoints
 * (submit/edit/cancel/history) take employee_id explicitly rather than
 * deriving it from req.user, since this codebase has no existing
 * membership -> employee_id mapping to lean on.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const leaveRequestService = require("../services/leaveRequestService");
const employeeRepository = require("../repositories/employeeRepository");

/**
 * decided_by (leave_requests) and created_by (leave_events) are foreign
 * keys to employees(id) — NOT to auth.users(id) — per migration 014.
 * req.user.id is always the Supabase auth user id, so every caller
 * that needs to write one of those columns must first resolve the
 * acting employees row via employees.user_id. Returns null (never
 * throws) if the acting user has no employee record in this workspace
 * yet — callers treat that as "leave the FK null" rather than failing
 * the whole request over a missing audit attribution.
 */
async function resolveActorEmployeeId(userId, workspaceId) {
  if (!userId || !workspaceId) return null;
  const employee = await employeeRepository.findByUserIdInWorkspace(userId, workspaceId);
  return employee?.id || null;
}

// Role keys with full ("Admin/HR override") approval authority. Matched
// case-insensitively, and includes OWNER/FOUNDER as synonyms for ADMIN —
// the person who created the workspace is commonly seeded with one of
// those role keys rather than literally "ADMIN", and this file previously
// only recognized an exact "ADMIN" match, silently locking that person out
// of leave approvals with a 403.
const FULL_APPROVER_ROLE_KEYS = new Set(["ADMIN", "OWNER", "FOUNDER"]);

function isFullApprover(roleKey) {
  return FULL_APPROVER_ROLE_KEYS.has(String(roleKey || "").toUpperCase());
}

// @desc    List leave requests (Manager Leave Dashboard when filtered by
//          department_id, Employee Leave History when filtered by
//          employee_id, or full search/filter/pagination for HR/Admin)
// @route   GET /api/leave-requests?employee_id=&department_id=&leave_type_id=
//              &status=&start_date_from=&start_date_to=&search=&sort_by=
//              &sort_order=&page=&page_size=
// @access  Member (leave.read)
const getLeaveRequests = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const result = await leaveRequestService.listLeaveRequests(req.workspace.id, {
    ...req.query,
    page: req.query.page,
    limit: req.query.page_size,
  });

  const data = Array.isArray(result)
    ? result
    : { items: result.data, total: result.total, page: result.page, pageSize: result.limit };

  return sendSuccess(res, { message: "Leave requests fetched", data });
});

// @desc    Get a single leave request
// @route   GET /api/leave-requests/:id
// @access  Member (leave.read)
const getLeaveRequestById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const request = await leaveRequestService.getLeaveRequest(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Leave request fetched", data: request });
});

// @desc    Submit a new leave request for an employee
// @route   POST /api/leave-requests
// @access  Member (leave.manage) — submitting for oneself
const createLeaveRequest = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employee_id, leave_type_id, start_date, end_date, is_half_day, half_day_period, reason } =
    req.body;

  if (!employee_id) throw new ApiError(400, "employee_id is required");

  const actorEmployeeId = await resolveActorEmployeeId(req.user?.id, req.workspace.id);

  const request = await leaveRequestService.submitLeaveRequest(
    req.workspace.id,
    employee_id,
    { leave_type_id, start_date, end_date, is_half_day, half_day_period, reason },
    req.user?.id,
    actorEmployeeId
  );

  return sendSuccess(res, { statusCode: 201, message: "Leave request submitted", data: request });
});

// @desc    Edit a pending leave request's dates/type/reason
// @route   PATCH /api/leave-requests/:id
// @access  Member (leave.manage) — own request only, while pending
const updateLeaveRequest = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employee_id, leave_type_id, start_date, end_date, is_half_day, half_day_period, reason } =
    req.body;

  if (!employee_id) throw new ApiError(400, "employee_id is required");

  const actorEmployeeId = await resolveActorEmployeeId(req.user?.id, req.workspace.id);

  const updated = await leaveRequestService.editLeaveRequest(
    req.params.id,
    req.workspace.id,
    employee_id,
    { leave_type_id, start_date, end_date, is_half_day, half_day_period, reason },
    req.user?.id,
    actorEmployeeId
  );

  return sendSuccess(res, { message: "Leave request updated", data: updated });
});

// @desc    Approve a leave request. Dept Lead approval moves
//          pending -> dept_approved; HR/Admin approval moves
//          pending or dept_approved -> approved (balance consumed).
// @route   POST /api/leave-requests/:id/approve
// @access  Department Lead (own department, first stage) / HR / Admin
//          (leave.approve)
const approveLeaveRequest = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }
  if (!req.membership) {
    throw new ApiError(403, "No membership resolved for this workspace");
  }

  const isAdmin = isFullApprover(req.membership.roleKey);
  const isHR = String(req.membership.roleKey || "").toUpperCase() === "HR";
  const isDeptLead = String(req.membership.roleKey || "").toUpperCase() === "DEPARTMENT_LEAD";

  if (isDeptLead) {
    const request = await leaveRequestService.getLeaveRequest(req.params.id, req.workspace.id);
    if (request.employee?.department_id !== req.membership.departmentId) {
      throw new ApiError(
        403,
        "Only the requesting employee's own department lead (or HR/Admin) can approve this request"
      );
    }
  } else if (!isAdmin && !isHR) {
    throw new ApiError(403, "Only a Department Lead, HR, or Admin can approve leave requests");
  }

  // Admin/HR approval is treated as the final (override) approval —
  // per PRD §15.16 "HR — approval override" — while a Dept Lead's
  // approval is always the first stage only.
  const asFinalApprover = isAdmin || isHR;

  const actorEmployeeId = await resolveActorEmployeeId(req.user?.id, req.workspace.id);

  const updated = await leaveRequestService.approveLeaveRequest(
    req.params.id,
    req.workspace.id,
    req.user?.id,
    { asFinalApprover },
    actorEmployeeId
  );

  return sendSuccess(res, { message: "Leave request approved", data: updated });
});

// @desc    Reject a pending or dept_approved leave request
// @route   POST /api/leave-requests/:id/reject
// @access  Department Lead (own department) / HR / Admin (leave.approve)
const rejectLeaveRequest = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }
  if (!req.membership) {
    throw new ApiError(403, "No membership resolved for this workspace");
  }

  const isAdmin = isFullApprover(req.membership.roleKey);
  const isHR = String(req.membership.roleKey || "").toUpperCase() === "HR";
  const isDeptLead = String(req.membership.roleKey || "").toUpperCase() === "DEPARTMENT_LEAD";

  if (isDeptLead) {
    const request = await leaveRequestService.getLeaveRequest(req.params.id, req.workspace.id);
    if (request.employee?.department_id !== req.membership.departmentId) {
      throw new ApiError(
        403,
        "Only the requesting employee's own department lead (or HR/Admin) can reject this request"
      );
    }
  } else if (!isAdmin && !isHR) {
    throw new ApiError(403, "Only a Department Lead, HR, or Admin can reject leave requests");
  }

  const updated = await leaveRequestService.rejectLeaveRequest(
    req.params.id,
    req.workspace.id,
    req.user?.id,
    req.body.reason,
    await resolveActorEmployeeId(req.user?.id, req.workspace.id)
  );

  return sendSuccess(res, { message: "Leave request rejected", data: updated });
});

// @desc    Cancel a leave request (pending, dept_approved, or approved
//          — reverses balance if it had been approved)
// @route   POST /api/leave-requests/:id/cancel
// @access  Member (leave.manage) — own request; HR/Admin may cancel any
const cancelLeaveRequest = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const updated = await leaveRequestService.cancelLeaveRequest(
    req.params.id,
    req.workspace.id,
    req.user?.id,
    await resolveActorEmployeeId(req.user?.id, req.workspace.id)
  );

  return sendSuccess(res, { message: "Leave request cancelled", data: updated });
});

// @desc    Full leave history for one employee (Sprint 9 "Leave History")
// @route   GET /api/leave-requests/history/:employeeId
// @access  Member (leave.read)
const getLeaveHistory = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const history = await leaveRequestService.getLeaveHistory(req.params.employeeId, req.workspace.id);
  return sendSuccess(res, { message: "Leave history fetched", data: history });
});

module.exports = {
  getLeaveRequests,
  getLeaveRequestById,
  createLeaveRequest,
  updateLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveHistory,
};