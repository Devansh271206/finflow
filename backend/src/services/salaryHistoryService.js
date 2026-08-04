/**
 * Salary History Service
 * ------------------------------------------------------------------
 * Business logic for salary_history. Two things make this different
 * from every other employee-adjacent service in this codebase:
 *
 * 1. Reads are gated by an ADDITIONAL check beyond the normal
 *    authorize() role check — PRD §13.3 requires
 *    salary.read_department to be "separately-grantable... not implied
 *    by role", so even an Admin/HR role membership must also hold an
 *    ACTIVE membership_permission_grants row for this specific
 *    permission key. The route only checks EMPLOYEES_READ (confirming
 *    the caller can see employees at all); this service is what
 *    actually enforces the salary-specific gate.
 *
 * 2. Every successful read is audit-logged (PRD §13.3: "all reads of
 *    salary_history... are audit-logged regardless of role"). Logging
 *    failure does not block the read itself — see the try/catch below
 *    — but is never silent; it's logged to console so an operator can
 *    notice a broken audit pipeline.
 */

const salaryHistoryRepository = require("../repositories/salaryHistoryRepository");
const employeeRepository = require("../repositories/employeeRepository");
const membershipPermissionGrantService = require("../services/membershipPermissionGrantService");
const auditLogRepository = require("../repositories/auditLogRepository");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const ApiError = require("../utils/ApiError");

async function assertEmployeeInWorkspace(employeeId, workspaceId) {
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found");
  return employee;
}

/**
 * Confirms the caller's membership holds an active
 * salary.read_department grant. Throws 403 (not 404) — the caller is
 * allowed to know salary history exists for this employee, just not
 * that they lack permission to view it, consistent with how
 * authorize() itself responds to a denied permission.
 */
async function assertSalaryReadGranted(membershipId) {
  const granted = await membershipPermissionGrantService.hasActiveGrant(
    membershipId,
    PERMISSIONS.SALARY_READ_DEPARTMENT
  );
  if (!granted) {
    throw new ApiError(
      403,
      "Viewing salary history requires an active salary.read_department grant, which is not implied by your role."
    );
  }
}

/**
 * Lists salary history for an employee. workspaceId + membershipId
 * both required — workspaceId to confirm the employee is in-scope,
 * membershipId to check the per-membership grant.
 */
async function listForEmployee(employeeId, workspaceId, membershipId, actorUserId) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);
  await assertSalaryReadGranted(membershipId);

  const rows = await salaryHistoryRepository.listByEmployee(employeeId);

  // PRD §13.3: log the read itself, not just mutations. Best-effort —
  // a broken audit pipeline should not be able to take down salary
  // visibility for HR, but it also should never fail completely
  // silently.
  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "salary_history.read",
      resourceType: "employee",
      resourceId: employeeId,
      metadata: { rowCount: rows.length },
    });
  } catch (auditError) {
    // eslint-disable-next-line no-console
    console.error("[auditLogRepository] Failed to record salary_history.read:", auditError.message);
  }

  return rows;
}

/**
 * Creates a new salary revision. Create/edit is Admin/HR-only per PRD
 * §13.2 — enforced at the route via EMPLOYEES_MANAGE (mirroring how
 * employee create/update is already gated), NOT the salary.read_department
 * grant, since granting someone read access to salary data should not
 * also silently let them create revisions.
 */
async function createRevision(employeeId, workspaceId, payload, createdBy) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);

  const { effectiveDate, ctcAnnual, baseSalary, allowances, bonusAmount, revisionReason } =
    payload;

  if (!effectiveDate) throw new ApiError(400, "effectiveDate is required");
  if (ctcAnnual === undefined || ctcAnnual === null || Number(ctcAnnual) < 0) {
    throw new ApiError(400, "ctcAnnual is required and must be a non-negative number");
  }
  if (baseSalary === undefined || baseSalary === null || Number(baseSalary) < 0) {
    throw new ApiError(400, "baseSalary is required and must be a non-negative number");
  }
  if (bonusAmount !== undefined && bonusAmount !== null && Number(bonusAmount) < 0) {
    throw new ApiError(400, "bonusAmount cannot be negative");
  }

  return salaryHistoryRepository.create({
    employee_id: employeeId,
    effective_date: effectiveDate,
    ctc_annual: ctcAnnual,
    base_salary: baseSalary,
    allowances: allowances || {},
    bonus_amount: bonusAmount || 0,
    revision_reason: revisionReason || null,
    created_by: createdBy,
  });
}

module.exports = { listForEmployee, createRevision };
