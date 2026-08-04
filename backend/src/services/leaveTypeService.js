/**
 * Leave Type Service
 * ------------------------------------------------------------------
 * Sprint 9: Leave Management module. Follows the same
 * routes -> controllers -> services -> repositories layering (PRD §14)
 * introduced for Departments in Sprint 8 (see departmentService.js).
 *
 * Owns validation (name required/unique per workspace) and audit
 * logging for leave type CRUD. No cross-entity business logic lives
 * here yet — that starts with leaveBalanceService.js /
 * leaveRequestService.js.
 */

const ApiError = require("../utils/ApiError");
const leaveTypeRepository = require("../repositories/leaveTypeRepository");
const auditLogRepository = require("../repositories/auditLogRepository");

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * List leave types for a workspace with optional search/filter/sort/
 * pagination. Mirrors departmentService.js's listDepartments().
 */
async function listLeaveTypes(workspaceId, query = {}) {
  const { search, status, sortBy, sortOrder, page, limit } = query;

  const options = {
    search: search ? String(search).trim() : undefined,
    sortBy,
    sortOrder,
  };

  if (status === "active") options.activeOnly = true;

  if (page !== undefined || limit !== undefined) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE)
    );
    options.page = parsedPage;
    options.limit = parsedLimit;
  }

  return leaveTypeRepository.listByWorkspace(workspaceId, options);
}

async function getLeaveType(id, workspaceId) {
  const leaveType = await leaveTypeRepository.findByIdInWorkspace(id, workspaceId);
  if (!leaveType) throw new ApiError(404, "Leave type not found");
  return leaveType;
}

async function createLeaveType(
  workspaceId,
  { name, is_paid, default_annual_days },
  actorUserId
) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Leave type name is required");
  }

  const parsedDefaultDays =
    default_annual_days === undefined || default_annual_days === null
      ? 0
      : Number(default_annual_days);
  if (Number.isNaN(parsedDefaultDays) || parsedDefaultDays < 0) {
    throw new ApiError(400, "Default annual days must be a non-negative number");
  }

  const existing = await leaveTypeRepository.findByNameInWorkspace(workspaceId, trimmedName);
  if (existing) {
    throw new ApiError(409, "A leave type with this name already exists");
  }

  const leaveType = await leaveTypeRepository.create({
    workspace_id: workspaceId,
    name: trimmedName,
    is_paid: is_paid === undefined ? true : Boolean(is_paid),
    default_annual_days: parsedDefaultDays,
    is_active: true,
  });

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "leave_type.create",
      resourceType: "leave_type",
      resourceId: leaveType.id,
      metadata: { name: trimmedName },
    });
  } catch (auditError) {
    console.error("[auditLogRepository] Failed to record leave_type.create:", auditError.message);
  }

  return leaveType;
}

async function updateLeaveType(
  id,
  workspaceId,
  { name, is_paid, default_annual_days, is_active },
  actorUserId
) {
  const existing = await leaveTypeRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Leave type not found");

  const payload = {};

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      throw new ApiError(400, "Leave type name cannot be empty");
    }
    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await leaveTypeRepository.findByNameInWorkspace(
        workspaceId,
        trimmedName
      );
      if (duplicate) {
        throw new ApiError(409, "A leave type with this name already exists");
      }
    }
    payload.name = trimmedName;
  }

  if (is_paid !== undefined) {
    payload.is_paid = Boolean(is_paid);
  }

  if (default_annual_days !== undefined) {
    const parsedDefaultDays = Number(default_annual_days);
    if (Number.isNaN(parsedDefaultDays) || parsedDefaultDays < 0) {
      throw new ApiError(400, "Default annual days must be a non-negative number");
    }
    payload.default_annual_days = parsedDefaultDays;
  }

  if (is_active !== undefined) {
    payload.is_active = Boolean(is_active);
  }

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  const updated = await leaveTypeRepository.update(id, payload);

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "leave_type.update",
      resourceType: "leave_type",
      resourceId: id,
      metadata: { changes: payload, previousName: existing.name },
    });
  } catch (auditError) {
    console.error("[auditLogRepository] Failed to record leave_type.update:", auditError.message);
  }

  return updated;
}

module.exports = {
  listLeaveTypes,
  getLeaveType,
  createLeaveType,
  updateLeaveType,
};