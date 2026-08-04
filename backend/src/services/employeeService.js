/**
 * Employee Service
 * ------------------------------------------------------------------
 * Business logic for employees: create/update with department and
 * reporting-manager validation, employee_code/email uniqueness
 * enforcement, status-transition handling (active -> on_leave ->
 * terminated), and soft-delete/restore. Framework-agnostic per PRD
 * §10.1 layering.
 *
 * Two independent "employee is gone" axes exist on this table, by
 * deliberate design decision:
 *   - employment_status = 'terminated' (+ date_of_exit) — the person
 *     left the company. Set via terminateEmployee(). Does NOT affect
 *     is_active.
 *   - is_active = false (+ deleted_at) — the RECORD is soft-deleted
 *     (e.g. added by mistake), independent of employment status. Set
 *     via deleteEmployee() / restoreEmployee(). Does NOT affect
 *     employment_status.
 * A soft-deleted employee is excluded from listByWorkspace() by
 * default but still resolvable via getEmployee()/restoreEmployee(), so
 * restore has something to find.
 *
 * VALID employment_status values enforced here (DB column has no CHECK
 * constraint applied in the migration, so this is the only guardrail):
 * 'active' | 'on_leave' | 'terminated'
 *
 * Sprint 7: phone, address, emergencyContactName, emergencyContactPhone,
 * notes added (011_employee_contact_fields.sql). These are ordinary
 * profile fields — no uniqueness or cross-entity validation needed,
 * unlike employeeCode/email/departmentId/reportingManagerId above.
 */

const employeeRepository = require("../repositories/employeeRepository");
const departmentRepository = require("../repositories/departmentRepository");
const membershipRepository = require("../repositories/membershipRepository");
const ApiError = require("../utils/ApiError");
const eventBusService = require("./eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");

/**
 * Sprint 14: employeeService's createEmployee/updateEmployee don't
 * receive an actorUserId (confirmed — neither function's signature
 * threads one through from employeeController.js today, and adding
 * one would ripple into that controller's call sites, out of scope
 * for this sprint's file list). Recipients are therefore resolved as
 * every Admin/HR member (the roles with org-wide employee visibility),
 * not "notify the specific person who acted" — actorUserId is
 * published as null, which notificationService.js/activityService.js
 * both handle gracefully (activity feed shows no actor, which is
 * honest given the data available, rather than guessing).
 */
async function resolveAdminHRUserIds(workspaceId) {
  const members = await membershipRepository.listByWorkspace(workspaceId);
  return (members || [])
    .filter((m) => m.status === "active" && ["ADMIN", "OWNER", "FOUNDER", "HR"].includes(String(m.roles?.key || "").toUpperCase()))
    .map((m) => m.user_id)
    .filter(Boolean);
}

const VALID_STATUSES = ["active", "on_leave", "terminated"];
const VALID_EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"];

async function assertDepartmentInWorkspace(departmentId, workspaceId) {
  const department = await departmentRepository.findByIdInWorkspace(departmentId, workspaceId);
  if (!department) throw new ApiError(404, "Department not found");
}

async function assertManagerInWorkspace(managerId, workspaceId, selfId = null) {
  if (!managerId) return;
  if (selfId && managerId === selfId) {
    throw new ApiError(400, "An employee cannot report to themselves");
  }
  const manager = await employeeRepository.findByIdInWorkspace(managerId, workspaceId);
  if (!manager) throw new ApiError(404, "Reporting manager not found");
}

async function assertCodeAvailable(workspaceId, employeeCode, excludeId = null) {
  const existing = await employeeRepository.findByCodeInWorkspace(workspaceId, employeeCode);
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Employee code "${employeeCode}" is already in use in this workspace`);
  }
}

async function assertEmailAvailable(workspaceId, email, excludeId = null) {
  if (!email) return;
  const existing = await employeeRepository.findByEmailInWorkspace(workspaceId, email);
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Email "${email}" is already in use in this workspace`);
  }
}

function normalizeEmployee(employee) {
  return {
    id: employee.id,
    workspace_id: employee.workspace_id,
    user_id: employee.user_id,
    employee_code: employee.employee_code,
    full_name: employee.full_name,
    email: employee.email,
    phone: employee.phone,
    address: employee.address,
    designation: employee.designation,
    department_id: employee.department_id,
    department: employee.departments?.name || null,
    reporting_manager_id: employee.reporting_manager_id,
    reporting_manager_name: employee.reporting_manager?.full_name || null,
    employment_status: employee.employment_status,
    employment_type: employee.employment_type,
    date_of_joining: employee.date_of_joining,
    date_of_exit: employee.date_of_exit,
    emergency_contact_name: employee.emergency_contact_name,
    emergency_contact_phone: employee.emergency_contact_phone,
    notes: employee.notes,
    is_active: employee.is_active,
    deleted_at: employee.deleted_at,
    created_at: employee.created_at,
    updated_at: employee.updated_at,
  };
}

/**
 * Lists employees for a workspace with filtering, search, sorting, and
 * pagination pass-through to the repository. Returns
 * { items, total, page, pageSize } rather than a bare array, since
 * pagination requires reporting the total filtered count alongside the
 * current page.
 */
async function getEmployeesForWorkspace(workspaceId, filters = {}) {
  const {
    departmentId,
    status,
    employmentType,
    search,
    includeDeleted,
    sortBy,
    sortOrder,
    page = 1,
    pageSize = 25,
  } = filters;

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const offset = (safePage - 1) * safePageSize;

  const { rows, total } = await employeeRepository.listByWorkspace(workspaceId, {
    departmentId,
    status,
    employmentType,
    search,
    includeDeleted,
    sortBy,
    sortOrder,
    limit: safePageSize,
    offset,
  });

  return {
    items: rows.map(normalizeEmployee),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function getEmployee(id, workspaceId) {
  const employee = await employeeRepository.findByIdInWorkspace(id, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found");
  return normalizeEmployee(employee);
}

/**
 * Direct reports for a manager — used by org-chart / manager dashboard
 * views ahead of the Employee Timeline phase.
 */
async function getDirectReports(managerId, workspaceId) {
  const manager = await employeeRepository.findByIdInWorkspace(managerId, workspaceId);
  if (!manager) throw new ApiError(404, "Employee not found");

  const reports = await employeeRepository.findDirectReports(managerId, workspaceId);
  return reports.map(normalizeEmployee);
}

/**
 * Creates an employee. department_id and employee_code are required at
 * the DB level (NOT NULL), so both are validated here before insert
 * rather than relying on the DB to reject a bad payload. email is
 * optional but must be unique within the workspace when supplied.
 *
 * phone/address/emergencyContactName/emergencyContactPhone/notes
 * [Sprint 7] are all optional, free-form, and require no validation
 * beyond what the route-level express-validator chain already applies.
 */
async function createEmployee(workspaceId, payload) {
  const {
    employeeCode,
    fullName,
    email,
    phone,
    address,
    designation,
    departmentId,
    reportingManagerId,
    userId,
    employmentStatus,
    employmentType,
    dateOfJoining,
    emergencyContactName,
    emergencyContactPhone,
    notes,
  } = payload;

  if (!employeeCode || !employeeCode.trim()) {
    throw new ApiError(400, "employeeCode is required");
  }
  if (!fullName || !fullName.trim()) {
    throw new ApiError(400, "fullName is required");
  }
  if (!designation || !designation.trim()) {
    throw new ApiError(400, "designation is required");
  }
  if (!departmentId) {
    throw new ApiError(400, "departmentId is required");
  }
  if (!dateOfJoining) {
    throw new ApiError(400, "dateOfJoining is required");
  }
  if (employmentStatus && !VALID_STATUSES.includes(employmentStatus)) {
    throw new ApiError(400, `employmentStatus must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  if (employmentType && !VALID_EMPLOYMENT_TYPES.includes(employmentType)) {
    throw new ApiError(400, `employmentType must be one of: ${VALID_EMPLOYMENT_TYPES.join(", ")}`);
  }

  await assertDepartmentInWorkspace(departmentId, workspaceId);
  await assertManagerInWorkspace(reportingManagerId, workspaceId);
  await assertCodeAvailable(workspaceId, employeeCode);
  await assertEmailAvailable(workspaceId, email);

  const employee = await employeeRepository.create({
    workspace_id: workspaceId,
    user_id: userId || null,
    employee_code: employeeCode,
    full_name: fullName,
    email: email || null,
    phone: phone || null,
    address: address || null,
    designation,
    department_id: departmentId,
    reporting_manager_id: reportingManagerId || null,
    employment_status: employmentStatus || "active",
    employment_type: employmentType || "full_time",
    date_of_joining: dateOfJoining,
    date_of_exit: null,
    emergency_contact_name: emergencyContactName || null,
    emergency_contact_phone: emergencyContactPhone || null,
    notes: notes || null,
  });

  resolveAdminHRUserIds(workspaceId)
    .then((recipientUserIds) => {
      eventBusService.publish(EVENT_TYPES.EMPLOYEE_CREATED, {
        workspaceId,
        actorUserId: null,
        recipientUserIds,
        module: "Employee",
        resourceType: "employee",
        resourceId: employee.id,
        title: `${employee.full_name} joined as ${designation}`,
        actionUrl: `/employees?id=${employee.id}`,
        metadata: { departmentId },
      });
    })
    .catch((err) => console.error("[employeeService] Failed to resolve recipients for EMPLOYEE_CREATED event:", err.message));

  return normalizeEmployee(employee);
}

async function updateEmployee(id, workspaceId, payload) {
  const existing = await employeeRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Employee not found");

  const {
    employeeCode,
    fullName,
    email,
    phone,
    address,
    designation,
    departmentId,
    reportingManagerId,
    userId,
    employmentStatus,
    employmentType,
    dateOfJoining,
    dateOfExit,
    emergencyContactName,
    emergencyContactPhone,
    notes,
  } = payload;

  if (employeeCode !== undefined) {
    if (!employeeCode || !employeeCode.trim()) {
      throw new ApiError(400, "employeeCode cannot be empty");
    }
    await assertCodeAvailable(workspaceId, employeeCode, id);
  }
  if (email !== undefined) {
    await assertEmailAvailable(workspaceId, email, id);
  }
  if (departmentId !== undefined) {
    if (!departmentId) throw new ApiError(400, "departmentId cannot be empty");
    await assertDepartmentInWorkspace(departmentId, workspaceId);
  }
  if (reportingManagerId !== undefined) {
    await assertManagerInWorkspace(reportingManagerId, workspaceId, id);
  }
  if (employmentStatus !== undefined && !VALID_STATUSES.includes(employmentStatus)) {
    throw new ApiError(400, `employmentStatus must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  if (employmentType !== undefined && !VALID_EMPLOYMENT_TYPES.includes(employmentType)) {
    throw new ApiError(400, `employmentType must be one of: ${VALID_EMPLOYMENT_TYPES.join(", ")}`);
  }

  const updatePayload = {
    ...(employeeCode !== undefined && { employee_code: employeeCode }),
    ...(fullName !== undefined && { full_name: fullName }),
    ...(email !== undefined && { email: email || null }),
    ...(phone !== undefined && { phone: phone || null }),
    ...(address !== undefined && { address: address || null }),
    ...(designation !== undefined && { designation }),
    ...(departmentId !== undefined && { department_id: departmentId }),
    ...(reportingManagerId !== undefined && { reporting_manager_id: reportingManagerId || null }),
    ...(userId !== undefined && { user_id: userId || null }),
    ...(employmentStatus !== undefined && { employment_status: employmentStatus }),
    ...(employmentType !== undefined && { employment_type: employmentType }),
    ...(dateOfJoining !== undefined && { date_of_joining: dateOfJoining }),
    ...(dateOfExit !== undefined && { date_of_exit: dateOfExit || null }),
    ...(emergencyContactName !== undefined && { emergency_contact_name: emergencyContactName || null }),
    ...(emergencyContactPhone !== undefined && { emergency_contact_phone: emergencyContactPhone || null }),
    ...(notes !== undefined && { notes: notes || null }),
  };

  const updated = await employeeRepository.update(id, updatePayload);

  resolveAdminHRUserIds(workspaceId)
    .then((recipientUserIds) => {
      eventBusService.publish(EVENT_TYPES.EMPLOYEE_UPDATED, {
        workspaceId,
        actorUserId: null,
        recipientUserIds,
        module: "Employee",
        resourceType: "employee",
        resourceId: id,
        title: `${updated.full_name}'s profile was updated`,
        actionUrl: `/employees?id=${id}`,
        metadata: { changedFields: Object.keys(updatePayload) },
      });
    })
    .catch((err) => console.error("[employeeService] Failed to resolve recipients for EMPLOYEE_UPDATED event:", err.message));

  return normalizeEmployee(updated);
}

/**
 * Marks an employee as terminated (employment_status = 'terminated' +
 * date_of_exit). Independent of is_active/soft-delete — see file header.
 * No hard-delete function is exposed, on purpose: employees are likely
 * to have salary history / document references once those phases land.
 */
async function terminateEmployee(id, workspaceId, { dateOfExit } = {}) {
  const existing = await employeeRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Employee not found");

  if (existing.employment_status === "terminated") {
    throw new ApiError(400, "Employee is already terminated");
  }

  const updated = await employeeRepository.update(id, {
    employment_status: "terminated",
    date_of_exit: dateOfExit || new Date().toISOString().slice(0, 10),
  });

  return normalizeEmployee(updated);
}

/**
 * Soft-deletes an employee record (is_active = false + deleted_at).
 * Independent of employment_status — see file header. Re-deletion is
 * intentionally rejected (mirrors terminateEmployee's "already
 * terminated" guard) rather than silently no-op-ing.
 */
async function deleteEmployee(id, workspaceId) {
  const existing = await employeeRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Employee not found");

  if (existing.is_active === false) {
    throw new ApiError(400, "Employee is already deleted");
  }

  const updated = await employeeRepository.update(id, {
    is_active: false,
    deleted_at: new Date().toISOString(),
  });

  return normalizeEmployee(updated);
}

/**
 * Restores a previously soft-deleted employee record.
 */
async function restoreEmployee(id, workspaceId) {
  const existing = await employeeRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Employee not found");

  if (existing.is_active !== false) {
    throw new ApiError(400, "Employee is not deleted");
  }

  const updated = await employeeRepository.update(id, {
    is_active: true,
    deleted_at: null,
  });

  return normalizeEmployee(updated);
}

module.exports = {
  getEmployeesForWorkspace,
  getEmployee,
  getDirectReports,
  createEmployee,
  updateEmployee,
  terminateEmployee,
  deleteEmployee,
  restoreEmployee,
  VALID_STATUSES,
  VALID_EMPLOYMENT_TYPES,
};