/**
 * Department Service
 * ------------------------------------------------------------------
 * Sprint 8: introduces the service layer for the Department module,
 * which previously had the controller call departmentRepository.js
 * directly (see departmentController.js's pre-Sprint-8 history). Every
 * other module in this project (employees, budgets, categories, ...)
 * already follows routes -> controllers -> services -> repositories
 * (PRD §14); this brings Departments in line without changing any of
 * its existing externally-visible behavior.
 *
 * Owns the one piece of cross-entity business logic Sprint 8 adds to
 * this module: validating that a proposed Department Head is an
 * active employee of the same workspace (and, since departments are
 * single-level per PRD §49.1, ideally of that department itself —
 * enforced as a soft check below, see assignHead()).
 */

const ApiError = require("../utils/ApiError");
const departmentRepository = require("../repositories/departmentRepository");
const employeeRepository = require("../repositories/employeeRepository");
const auditLogRepository = require("../repositories/auditLogRepository");
const membershipRepository = require("../repositories/membershipRepository");
const eventBusService = require("./eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * List departments for a workspace with optional search/filter/sort/
 * pagination. Thin pass-through today, but centralizing it here means
 * future cross-module enrichment (e.g. team counts per department)
 * has one place to live instead of the controller reaching back into
 * multiple repositories directly.
 */
async function listDepartments(workspaceId, query = {}) {
  const { search, status, sortBy, sortOrder, page, limit } = query;

  const options = {
    search: search ? String(search).trim() : undefined,
    sortBy,
    sortOrder,
  };

  if (status === "active") options.activeOnly = true;
  // status === "inactive" is a display-side filter today (frontend
  // already receives both and badges them, per departmentRepository.js's
  // header note) — no repository-level "inactiveOnly" exists because
  // no caller has needed it yet; left as a TODO if a future sprint
  // needs it.

  if (page !== undefined || limit !== undefined) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE)
    );
    options.page = parsedPage;
    options.limit = parsedLimit;
  }

  return departmentRepository.listByWorkspace(workspaceId, options);
}

async function getDepartment(id, workspaceId) {
  const department = await departmentRepository.findByIdInWorkspace(id, workspaceId);
  if (!department) throw new ApiError(404, "Department not found");
  return department;
}

async function createDepartment(workspaceId, { name }, actorUserId) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new ApiError(400, "Department name is required");
  }

  const existing = await departmentRepository.findByNameInWorkspace(workspaceId, trimmedName);
  if (existing) {
    throw new ApiError(409, "A department with this name already exists");
  }

  const department = await departmentRepository.create({
    workspace_id: workspaceId,
    name: trimmedName,
    is_active: true,
  });

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "department.create",
      resourceType: "department",
      resourceId: department.id,
      metadata: { name: trimmedName },
    });
  } catch (auditError) {
    console.error("[auditLogRepository] Failed to record department.create:", auditError.message);
  }

  membershipRepository
    .listByWorkspace(workspaceId)
    .then((members) => {
      const recipientUserIds = (members || [])
        .filter((m) => m.status === "active" && ["ADMIN", "OWNER", "FOUNDER", "HR"].includes(String(m.roles?.key || "").toUpperCase()))
        .map((m) => m.user_id)
        .filter(Boolean);

      eventBusService.publish(EVENT_TYPES.DEPARTMENT_CREATED, {
        workspaceId,
        actorUserId,
        recipientUserIds,
        module: "Department",
        resourceType: "department",
        resourceId: department.id,
        title: `Department "${trimmedName}" was created`,
        actionUrl: `/departments?id=${department.id}`,
        metadata: { name: trimmedName },
      });
    })
    .catch((err) => console.error("[departmentService] Failed to resolve recipients for DEPARTMENT_CREATED event:", err.message));

  return department;
}

async function updateDepartment(id, workspaceId, { name, is_active }, actorUserId) {
  const existing = await departmentRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Department not found");

  const payload = {};

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      throw new ApiError(400, "Department name cannot be empty");
    }
    if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await departmentRepository.findByNameInWorkspace(
        workspaceId,
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

  const updated = await departmentRepository.update(id, payload);

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "department.update",
      resourceType: "department",
      resourceId: id,
      metadata: { changes: payload, previousName: existing.name },
    });
  } catch (auditError) {
    console.error("[auditLogRepository] Failed to record department.update:", auditError.message);
  }

  return updated;
}

/**
 * Assign or clear (employeeId = null/undefined) a department's head.
 * Validates the employee exists in the same workspace and, when
 * already assigned to a department, that it's this one — a Department
 * Head should be a member of the department they lead. An employee
 * with no department assigned yet is allowed through (common during
 * initial org setup, PRD §5B Step 4/5 ordering isn't guaranteed).
 */
async function assignHead(id, workspaceId, employeeId, actorUserId) {
  const department = await departmentRepository.findByIdInWorkspace(id, workspaceId);
  if (!department) throw new ApiError(404, "Department not found");

  let result;
  if (employeeId === null || employeeId === undefined) {
    result = await departmentRepository.assignHead(id, null);
  } else {
    const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
    if (!employee) {
      throw new ApiError(404, "Employee not found in this workspace");
    }
    if (employee.department_id && employee.department_id !== id) {
      throw new ApiError(
        400,
        "This employee belongs to a different department and cannot be its head"
      );
    }
    result = await departmentRepository.assignHead(id, employeeId);
  }

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "department.assign_head",
      resourceType: "department",
      resourceId: id,
      metadata: { previousHeadId: department.department_head_employee_id, newHeadId: employeeId },
    });
  } catch (auditError) {
    console.error("[auditLogRepository] Failed to record department.assign_head:", auditError.message);
  }

  return result;
}

module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  assignHead,
};