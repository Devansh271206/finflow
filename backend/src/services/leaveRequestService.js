/**
 * Leave Request Service
 * ------------------------------------------------------------------
 * Sprint 9: Leave Management module. Owns the leave request lifecycle
 * state machine:
 *
 *   pending --(Dept Lead approves)--> dept_approved --(HR approves)--> approved
 *   pending --(HR approves, override)-------------------------------> approved
 *   pending / dept_approved --(reject)--> rejected
 *   pending / dept_approved / approved --(cancel)--> cancelled
 *
 * Balance is only ever consumed (leaveBalanceService.applyUsageDelta,
 * positive delta) the moment a request reaches 'approved', and only
 * ever reversed (negative delta) when an 'approved' request is
 * cancelled. Rejecting a pending/dept_approved request never touches
 * balance, since it was never consumed.
 *
 * Every transition is logged to leave_events via leaveEventRepository
 * (PRD §15.16 "Leave Audit Trail").
 *
 * Follows routes -> controllers -> services -> repositories (PRD §14).
 */

const ApiError = require("../utils/ApiError");
const leaveRequestRepository = require("../repositories/leaveRequestRepository");
const leaveTypeRepository = require("../repositories/leaveTypeRepository");
const leaveEventRepository = require("../repositories/leaveEventRepository");
const employeeRepository = require("../repositories/employeeRepository");
const membershipRepository = require("../repositories/membershipRepository");
const eventBusService = require("./eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");

// Sprint 14: role keys treated as leave approvers for LEAVE_SUBMITTED
// notification fan-out — matches leaveRequestController.js's own
// FULL_APPROVER_ROLE_KEYS set plus DEPARTMENT_LEAD (who also has a
// first-approval-stage role in this state machine, per this file's
// own header comment on the pending -> dept_approved -> approved flow).
const LEAVE_APPROVER_ROLE_KEYS = new Set(["ADMIN", "OWNER", "FOUNDER", "HR", "DEPARTMENT_LEAD"]);

async function resolveLeaveApproverUserIds(workspaceId) {
  const members = await membershipRepository.listByWorkspace(workspaceId);
  return (members || [])
    .filter((m) => m.status === "active" && LEAVE_APPROVER_ROLE_KEYS.has(String(m.roles?.key || "").toUpperCase()))
    .map((m) => m.user_id)
    .filter(Boolean);
}
const leaveBalanceService = require("../services/leaveBalanceService");
const auditLogRepository = require("../repositories/auditLogRepository");

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of leave days a request represents. Half-day requests are
 * always single-date (enforced at the DB layer, migration 014) and
 * count as 0.5. Otherwise it's the inclusive calendar-day span.
 * Holiday-calendar / working-day exclusion is out of Sprint 9 scope
 * (holiday_calendar table isn't built yet) — TODO for a future sprint.
 */
function computeDayCount(startDate, endDate, isHalfDay) {
  if (isHalfDay) return 0.5;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

function policyPeriodForDate(dateStr) {
  return String(new Date(`${dateStr}T00:00:00Z`).getUTCFullYear());
}

async function listLeaveRequests(workspaceId, query = {}) {
  const {
    employee_id,
    department_id,
    leave_type_id,
    status,
    start_date_from,
    start_date_to,
    search,
    sort_by,
    sort_order,
    page,
    limit,
  } = query;

  const options = {
    employeeId: employee_id,
    departmentId: department_id,
    leaveTypeId: leave_type_id,
    status,
    startDateFrom: start_date_from,
    startDateTo: start_date_to,
    search: search ? String(search).trim() : undefined,
    sortBy: sort_by,
    sortOrder: sort_order,
  };

  if (page !== undefined || limit !== undefined) {
    options.page = Math.max(1, parseInt(page, 10) || 1);
    options.limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
  }

  return leaveRequestRepository.listByWorkspace(workspaceId, options);
}

async function getLeaveRequest(id, workspaceId) {
  const request = await leaveRequestRepository.findByIdInWorkspace(id, workspaceId);
  if (!request) throw new ApiError(404, "Leave request not found");
  return request;
}

/**
 * Shared validation for both submit and edit: leave type is active,
 * date range is sane, no conflicting active request, and (soft check
 * only — not committed) sufficient balance exists.
 */
async function validateRequestFields(
  workspaceId,
  employeeId,
  { leaveTypeId, startDate, endDate, isHalfDay, halfDayPeriod },
  excludeRequestId
) {
  if (!startDate || !endDate) {
    throw new ApiError(400, "start_date and end_date are required");
  }
  if (new Date(endDate) < new Date(startDate)) {
    throw new ApiError(400, "end_date cannot be before start_date");
  }
  // Server-side guard against backdated requests — the calendar UI also
  // disables past dates, but that's a UX convenience only; the real
  // enforcement has to live here since the API can be called directly.
  const todayStr = new Date().toISOString().split("T")[0];
  if (startDate < todayStr) {
    throw new ApiError(400, "Cannot submit a leave request with a start date in the past");
  }
  if (isHalfDay && startDate !== endDate) {
    throw new ApiError(400, "Half-day leave requests must have the same start and end date");
  }
  if (isHalfDay && !["AM", "PM"].includes(halfDayPeriod)) {
    throw new ApiError(400, "half_day_period must be 'AM' or 'PM' for half-day requests");
  }

  const leaveType = await leaveTypeRepository.findByIdInWorkspace(leaveTypeId, workspaceId);
  if (!leaveType) throw new ApiError(404, "Leave type not found in this workspace");
  if (!leaveType.is_active) {
    throw new ApiError(400, "This leave type is no longer active");
  }

  const conflicts = await leaveRequestRepository.findOverlapping(employeeId, startDate, endDate, {
    excludeRequestId,
  });
  if (conflicts.length > 0) {
    throw new ApiError(
      409,
      "This employee already has an active leave request overlapping these dates"
    );
  }

  const dayCount = computeDayCount(startDate, endDate, isHalfDay);
  const policyPeriod = policyPeriodForDate(startDate);
  await leaveBalanceService.assertSufficientBalance(employeeId, leaveTypeId, policyPeriod, dayCount);

  return { leaveType, dayCount, policyPeriod };
}

/**
 * Submit a new leave request. Balance is validated but NOT consumed
 * here — consumption happens only at approval (see approveLeaveRequest)
 * so a pending/rejected request never locks up balance a different
 * request could use.
 */
async function submitLeaveRequest(
  workspaceId,
  employeeId,
  { leave_type_id, start_date, end_date, is_half_day, half_day_period, reason },
  actorUserId,
  actorEmployeeId = null
) {
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found in this workspace");

  const isHalfDay = Boolean(is_half_day);

  await validateRequestFields(
    workspaceId,
    employeeId,
    { leaveTypeId: leave_type_id, startDate: start_date, endDate: end_date, isHalfDay, halfDayPeriod: half_day_period },
    null
  );

  const request = await leaveRequestRepository.create({
    workspace_id: workspaceId,
    employee_id: employeeId,
    leave_type_id,
    start_date,
    end_date,
    is_half_day: isHalfDay,
    half_day_period: isHalfDay ? half_day_period : null,
    reason: reason ? String(reason).trim() : null,
    status: "pending",
  });

  await logEvent(request.id, "submitted", { leave_type_id, start_date, end_date }, actorEmployeeId);

  await recordAudit(workspaceId, actorUserId, "leave_request.submit", request.id, {
    employeeId,
    leave_type_id,
    start_date,
    end_date,
  });

  // Sprint 14: fire-and-forget, never awaited for correctness (see
  // eventBusService.js's documented call pattern) — a notification
  // failure must never fail the leave submission itself.
  resolveLeaveApproverUserIds(workspaceId)
    .then((recipientUserIds) => {
      eventBusService.publish(EVENT_TYPES.LEAVE_SUBMITTED, {
        workspaceId,
        actorUserId,
        recipientUserIds,
        module: "Leave",
        resourceType: "leave_request",
        resourceId: request.id,
        title: `${employee.full_name} submitted a leave request`,
        message: `${start_date} to ${end_date}`,
        actionUrl: `/leave-approvals?id=${request.id}`,
        metadata: { employeeId, start_date, end_date },
      });
    })
    .catch((err) => console.error("[leaveRequestService] Failed to resolve leave approvers for event:", err.message));

  return request;
}

/**
 * Edit a request's dates/type/reason while it is still 'pending'.
 * Re-runs full validation (conflict + balance) against the new values,
 * excluding this request itself from the conflict check.
 */
async function editLeaveRequest(
  id,
  workspaceId,
  employeeId,
  { leave_type_id, start_date, end_date, is_half_day, half_day_period, reason },
  actorUserId,
  actorEmployeeId = null
) {
  const existing = await leaveRequestRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Leave request not found");
  if (existing.employee_id !== employeeId) {
    throw new ApiError(403, "You can only edit your own leave requests");
  }
  if (existing.status !== "pending") {
    throw new ApiError(400, "Only pending leave requests can be edited");
  }

  const nextLeaveTypeId = leave_type_id ?? existing.leave_type_id;
  const nextStartDate = start_date ?? existing.start_date;
  const nextEndDate = end_date ?? existing.end_date;
  const nextIsHalfDay = is_half_day !== undefined ? Boolean(is_half_day) : existing.is_half_day;
  const nextHalfDayPeriod = nextIsHalfDay ? half_day_period ?? existing.half_day_period : null;

  await validateRequestFields(
    workspaceId,
    employeeId,
    {
      leaveTypeId: nextLeaveTypeId,
      startDate: nextStartDate,
      endDate: nextEndDate,
      isHalfDay: nextIsHalfDay,
      halfDayPeriod: nextHalfDayPeriod,
    },
    id
  );

  const updated = await leaveRequestRepository.update(id, {
    leave_type_id: nextLeaveTypeId,
    start_date: nextStartDate,
    end_date: nextEndDate,
    is_half_day: nextIsHalfDay,
    half_day_period: nextHalfDayPeriod,
    reason: reason !== undefined ? (reason ? String(reason).trim() : null) : existing.reason,
  });

  await logEvent(id, "edited", { start_date: nextStartDate, end_date: nextEndDate }, actorEmployeeId);

  return updated;
}

/**
 * Department Lead first-stage approval (pending -> dept_approved) or
 * HR/Admin approval (pending or dept_approved -> approved). Balance is
 * consumed ONLY when the request reaches 'approved' — a dept_approved
 * transition does not touch balance yet.
 *
 * `asFinalApprover` distinguishes an HR/Admin override (may approve
 * directly from 'pending', skipping the department stage) from a
 * Department Lead's first-stage approval — the caller (controller)
 * decides which based on the acting membership's role, since role-key
 * resolution lives at that layer already (authorize() middleware).
 */
async function approveLeaveRequest(id, workspaceId, actorUserId, { asFinalApprover }, actorEmployeeId = null) {
  const request = await leaveRequestRepository.findByIdInWorkspace(id, workspaceId);
  if (!request) throw new ApiError(404, "Leave request not found");

  if (!["pending", "dept_approved"].includes(request.status)) {
    throw new ApiError(400, `Cannot approve a request with status '${request.status}'`);
  }

  let nextStatus;
  if (asFinalApprover) {
    nextStatus = "approved";
  } else {
    if (request.status !== "pending") {
      throw new ApiError(400, "This request has already passed department-level approval");
    }
    nextStatus = "dept_approved";
  }

  if (nextStatus === "approved") {
    // Re-validate balance at the moment of consumption — time may have
    // passed since submission and another request could have consumed
    // the balance in the interim.
    const dayCount = computeDayCount(request.start_date, request.end_date, request.is_half_day);
    const policyPeriod = policyPeriodForDate(request.start_date);
    await leaveBalanceService.assertSufficientBalance(
      request.employee_id,
      request.leave_type_id,
      policyPeriod,
      dayCount
    );
    await leaveBalanceService.applyUsageDelta(
      request.employee_id,
      request.leave_type_id,
      policyPeriod,
      dayCount
    );
  }

  const updated = await leaveRequestRepository.update(id, {
    status: nextStatus,
    decided_at: nextStatus === "approved" ? new Date().toISOString() : request.decided_at,
    decided_by: nextStatus === "approved" ? actorEmployeeId : request.decided_by,
  });

  await logEvent(id, nextStatus === "approved" ? "approved" : "dept_approved", {}, actorEmployeeId);

  await recordAudit(workspaceId, actorUserId, `leave_request.${nextStatus}`, id, {
    employeeId: request.employee_id,
  });

  if (nextStatus === "approved") {
    employeeRepository
      .findById(request.employee_id)
      .then((employee) => {
        if (!employee?.user_id) return;
        eventBusService.publish(EVENT_TYPES.LEAVE_APPROVED, {
          workspaceId,
          actorUserId,
          recipientUserIds: [employee.user_id],
          module: "Leave",
          resourceType: "leave_request",
          resourceId: id,
          title: "Your leave request was approved",
          message: `${request.start_date} to ${request.end_date}`,
          actionUrl: `/leave-requests?id=${id}`,
          metadata: { employeeId: request.employee_id },
        });
      })
      .catch((err) => console.error("[leaveRequestService] Failed to resolve employee for LEAVE_APPROVED event:", err.message));
  }

  return updated;
}

/**
 * Reject a request that hasn't reached 'approved' yet (pending or
 * dept_approved). Never touches balance — nothing was consumed.
 * Rejecting an already-'approved' request is not a valid transition;
 * cancellation is the correct path once balance has been consumed.
 */
async function rejectLeaveRequest(id, workspaceId, actorUserId, reason, actorEmployeeId = null) {
  const request = await leaveRequestRepository.findByIdInWorkspace(id, workspaceId);
  if (!request) throw new ApiError(404, "Leave request not found");

  if (!["pending", "dept_approved"].includes(request.status)) {
    throw new ApiError(400, `Cannot reject a request with status '${request.status}'`);
  }

  const updated = await leaveRequestRepository.update(id, {
    status: "rejected",
    decided_at: new Date().toISOString(),
    decided_by: actorEmployeeId,
  });

  await logEvent(id, "rejected", { reason: reason || null }, actorEmployeeId);

  await recordAudit(workspaceId, actorUserId, "leave_request.reject", id, {
    employeeId: request.employee_id,
    reason,
  });

  employeeRepository
    .findById(request.employee_id)
    .then((employee) => {
      if (!employee?.user_id) return;
      eventBusService.publish(EVENT_TYPES.LEAVE_REJECTED, {
        workspaceId,
        actorUserId,
        recipientUserIds: [employee.user_id],
        module: "Leave",
        resourceType: "leave_request",
        resourceId: id,
        title: "Your leave request was rejected",
        message: reason || null,
        actionUrl: `/leave-requests?id=${id}`,
        metadata: { employeeId: request.employee_id, reason: reason || null },
      });
    })
    .catch((err) => console.error("[leaveRequestService] Failed to resolve employee for LEAVE_REJECTED event:", err.message));

  return updated;
}

/**
 * Cancel a request in any non-terminal status. If it had already been
 * fully 'approved' (balance consumed), the balance is reversed here.
 * A 'pending'/'dept_approved' cancellation never touched balance, so
 * nothing is reversed for those.
 */
async function cancelLeaveRequest(id, workspaceId, actorUserId, actorEmployeeId = null) {
  const request = await leaveRequestRepository.findByIdInWorkspace(id, workspaceId);
  if (!request) throw new ApiError(404, "Leave request not found");

  if (!["pending", "dept_approved", "approved"].includes(request.status)) {
    throw new ApiError(400, `Cannot cancel a request with status '${request.status}'`);
  }

  if (request.status === "approved") {
    const dayCount = computeDayCount(request.start_date, request.end_date, request.is_half_day);
    const policyPeriod = policyPeriodForDate(request.start_date);
    await leaveBalanceService.applyUsageDelta(
      request.employee_id,
      request.leave_type_id,
      policyPeriod,
      -dayCount
    );
  }

  const updated = await leaveRequestRepository.update(id, {
    status: "cancelled",
    decided_at: new Date().toISOString(),
    decided_by: actorEmployeeId,
  });

  await logEvent(id, "cancelled", { previousStatus: request.status }, actorEmployeeId);

  await recordAudit(workspaceId, actorUserId, "leave_request.cancel", id, {
    employeeId: request.employee_id,
    previousStatus: request.status,
  });

  return updated;
}

async function getLeaveHistory(employeeId, workspaceId) {
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found in this workspace");

  return leaveRequestRepository.listByWorkspace(workspaceId, {
    employeeId,
    sortBy: "start_date",
    sortOrder: "desc",
  });
}

async function logEvent(leaveRequestId, eventType, metadata, actorUserId) {
  try {
    await leaveEventRepository.create({
      leaveRequestId,
      eventType,
      metadata,
      createdBy: actorUserId,
    });
  } catch (eventError) {
    console.error(`[leaveEventRepository] Failed to record ${eventType}:`, eventError.message);
  }
}

async function recordAudit(workspaceId, actorUserId, action, resourceId, metadata) {
  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action,
      resourceType: "leave_request",
      resourceId,
      metadata,
    });
  } catch (auditError) {
    console.error(`[auditLogRepository] Failed to record ${action}:`, auditError.message);
  }
}

module.exports = {
  listLeaveRequests,
  getLeaveRequest,
  submitLeaveRequest,
  editLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveHistory,
  computeDayCount,
};