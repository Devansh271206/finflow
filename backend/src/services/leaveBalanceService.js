/**
 * Leave Balance Service
 * ------------------------------------------------------------------
 * Sprint 9: Leave Management module. Owns:
 *   - lazy creation of a balance row the first time it's needed
 *     (seeded from the leave type's default_annual_days, since
 *     leave_policies/accrual is out of Sprint 9 scope — see migration
 *     014's header)
 *   - the read-modify-write + validation around used_days that
 *     leaveRequestService.js calls into on approve/cancel (kept here,
 *     not duplicated in leaveRequestService.js, so "how a balance is
 *     safely adjusted" has exactly one implementation)
 *   - employee-wise and department-wise leave summaries
 *
 * Follows routes -> controllers -> services -> repositories (PRD §14).
 */

const ApiError = require("../utils/ApiError");
const leaveBalanceRepository = require("../repositories/leaveBalanceRepository");
const leaveTypeRepository = require("../repositories/leaveTypeRepository");
const employeeRepository = require("../repositories/employeeRepository");
const departmentRepository = require("../repositories/departmentRepository");
const auditLogRepository = require("../repositories/auditLogRepository");

const CURRENT_POLICY_PERIOD = String(new Date().getFullYear());

/**
 * Fetch a balance row for employee/type/period, creating it (seeded
 * from the leave type's default_annual_days) if this is the first
 * time that combination has ever needed a row. Not exposed directly
 * as a route — used internally by getEmployeeBalances() and by
 * leaveRequestService.js's validation/approval flow.
 */
async function getOrCreateBalance(employeeId, leaveTypeId, policyPeriod = CURRENT_POLICY_PERIOD) {
  const existing = await leaveBalanceRepository.findByEmployeeAndType(
    employeeId,
    leaveTypeId,
    policyPeriod
  );
  if (existing) return existing;

  const leaveType = await leaveTypeRepository.findById(leaveTypeId);
  if (!leaveType) throw new ApiError(404, "Leave type not found");

  return leaveBalanceRepository.create({
    employee_id: employeeId,
    leave_type_id: leaveTypeId,
    policy_period: policyPeriod,
    allocated_days: leaveType.default_annual_days,
    used_days: 0,
    carried_forward_days: 0,
  });
}

/**
 * List every balance row for an employee (optionally filtered to one
 * policy_period), each annotated with a computed `remaining_days` so
 * the frontend never has to reimplement the arithmetic. Validates the
 * employee belongs to the resolved workspace before returning
 * anything (defense-in-depth alongside RLS, same convention as
 * departmentService.js).
 */
async function getEmployeeBalances(employeeId, workspaceId, { policyPeriod } = {}) {
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found in this workspace");

  const balances = await leaveBalanceRepository.findByEmployee(employeeId, { policyPeriod });
  return balances.map((balance) => ({
    ...balance,
    remaining_days: computeRemaining(balance),
  }));
}

/**
 * HR/Admin correction of allocated_days / carried_forward_days for an
 * existing balance row (or a not-yet-created one, via
 * getOrCreateBalance). used_days is deliberately NOT editable through
 * this path — it only ever changes via applyUsageDelta(), driven by
 * the leave request lifecycle, so "days used" always traces back to
 * an actual request.
 */
async function adjustAllocation(
  employeeId,
  workspaceId,
  { leave_type_id, policy_period, allocated_days, carried_forward_days },
  actorUserId
) {
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found in this workspace");

  if (!leave_type_id) throw new ApiError(400, "leave_type_id is required");
  const period = policy_period ? String(policy_period) : CURRENT_POLICY_PERIOD;

  const balance = await getOrCreateBalance(employeeId, leave_type_id, period);

  const payload = {};
  if (allocated_days !== undefined) {
    const parsed = Number(allocated_days);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new ApiError(400, "allocated_days must be a non-negative number");
    }
    payload.allocated_days = parsed;
  }
  if (carried_forward_days !== undefined) {
    const parsed = Number(carried_forward_days);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new ApiError(400, "carried_forward_days must be a non-negative number");
    }
    payload.carried_forward_days = parsed;
  }

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  const newAllocated = payload.allocated_days ?? balance.allocated_days;
  const newCarried = payload.carried_forward_days ?? balance.carried_forward_days;
  if (balance.used_days > newAllocated + newCarried) {
    throw new ApiError(
      400,
      "Cannot reduce allocation below the days already used for this period"
    );
  }

  const updated = await leaveBalanceRepository.update(balance.id, payload);

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "leave_balance.adjust_allocation",
      resourceType: "leave_balance",
      resourceId: balance.id,
      metadata: { employeeId, leaveTypeId: leave_type_id, policyPeriod: period, changes: payload },
    });
  } catch (auditError) {
    console.error(
      "[auditLogRepository] Failed to record leave_balance.adjust_allocation:",
      auditError.message
    );
  }

  return updated;
}

/**
 * Validate (without writing) whether `days` more of usage would fit
 * within an employee's remaining balance for a leave type/period.
 * Called by leaveRequestService.js before allowing a submission or an
 * approval to proceed — kept side-effect-free so it can be called
 * speculatively without committing anything.
 */
async function assertSufficientBalance(employeeId, leaveTypeId, policyPeriod, days) {
  const balance = await getOrCreateBalance(employeeId, leaveTypeId, policyPeriod);
  const remaining = computeRemaining(balance);
  if (days > remaining) {
    throw new ApiError(
      400,
      `Insufficient leave balance: requested ${days} day(s), ${remaining} day(s) remaining`
    );
  }
  return balance;
}

/**
 * Apply a signed delta to used_days (positive when a request is
 * approved/consumes balance, negative when a request is
 * cancelled/rejected-after-approval and balance is reversed). The
 * only place in this module that actually mutates used_days — every
 * caller (leaveRequestService.js) goes through here so the invariant
 * (never negative, never exceeding allocation) is checked exactly
 * once.
 */
async function applyUsageDelta(employeeId, leaveTypeId, policyPeriod, deltaDays) {
  const balance = await getOrCreateBalance(employeeId, leaveTypeId, policyPeriod);
  const newUsedDays = Number(balance.used_days) + Number(deltaDays);

  if (newUsedDays < 0) {
    throw new ApiError(400, "Balance reversal would take used days below zero");
  }
  if (newUsedDays > Number(balance.allocated_days) + Number(balance.carried_forward_days)) {
    throw new ApiError(400, "Insufficient leave balance for this request");
  }

  return leaveBalanceRepository.update(balance.id, { used_days: newUsedDays });
}

/**
 * Employee-wise leave summary — every balance row for the employee,
 * with remaining_days computed. Thin wrapper over getEmployeeBalances()
 * kept as its own named export so leaveRequestController.js's
 * "Employee-wise Leave Summary" endpoint (PRD Sprint 9 feature list)
 * has a self-describing entry point.
 */
async function getEmployeeSummary(employeeId, workspaceId, options) {
  return getEmployeeBalances(employeeId, workspaceId, options);
}

/**
 * Department-wise leave summary — aggregates used/allocated days per
 * leave type across every employee in the department, for a given
 * policy period (defaults to the current year).
 */
async function getDepartmentSummary(departmentId, workspaceId, { policyPeriod } = {}) {
  const department = await departmentRepository.findByIdInWorkspace(departmentId, workspaceId);
  if (!department) throw new ApiError(404, "Department not found");

  const period = policyPeriod ? String(policyPeriod) : CURRENT_POLICY_PERIOD;
  const balances = await leaveBalanceRepository.findByDepartment(departmentId, period);

  const byLeaveType = new Map();
  for (const balance of balances) {
    const key = balance.leave_type_id;
    if (!byLeaveType.has(key)) {
      byLeaveType.set(key, {
        leave_type_id: key,
        leave_type_name: balance.leave_type?.name ?? "Unknown",
        allocated_days: 0,
        used_days: 0,
        carried_forward_days: 0,
        employee_count: 0,
      });
    }
    const entry = byLeaveType.get(key);
    entry.allocated_days += Number(balance.allocated_days);
    entry.used_days += Number(balance.used_days);
    entry.carried_forward_days += Number(balance.carried_forward_days);
    entry.employee_count += 1;
  }

  return {
    department_id: departmentId,
    policy_period: period,
    leave_types: Array.from(byLeaveType.values()),
  };
}

function computeRemaining(balance) {
  return (
    Number(balance.allocated_days) +
    Number(balance.carried_forward_days) -
    Number(balance.used_days)
  );
}

module.exports = {
  CURRENT_POLICY_PERIOD,
  getOrCreateBalance,
  getEmployeeBalances,
  adjustAllocation,
  assertSufficientBalance,
  applyUsageDelta,
  getEmployeeSummary,
  getDepartmentSummary,
};