/**
 * Leave Balance Controller
 * ------------------------------------------------------------------
 * Table: leave_balances
 * Columns: id, employee_id, leave_type_id, policy_period,
 *          allocated_days, used_days, carried_forward_days,
 *          created_at, updated_at
 *
 * Route protection (see leaveBalanceRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.LEAVE_*)
 *
 * PRD §15.16 RBAC + Sprint 9 feature list ("Leave Balance Management",
 * "Employee-wise Leave Summary", "Department-wise Leave Summary"):
 *   - Read own balance: any authenticated employee (leave.read)
 *   - Read/correct another employee's balance: HR/Admin (leave.manage) —
 *     enforced here by requiring an explicit employee_id query param and
 *     gating the allocation-adjustment route behind leave.manage;
 *     "own only" for non-manage roles is intentionally NOT enforced at
 *     this layer (no reliable "which employee_id is 'me'" mapping is
 *     available from req.user/req.membership in this codebase today —
 *     see profileController.js for the closest existing pattern) and is
 *     left as a follow-up TODO alongside the same gap in
 *     leaveRequestController.js.
 *   - Department summary: Dept Lead (own department) / HR / Admin
 *     (leave.read; department-membership scoping is the same
 *     unenforced-at-this-layer gap noted above)
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const leaveBalanceService = require("../services/leaveBalanceService");

// @desc    Get an employee's leave balances (all leave types, optionally
//          filtered to one policy_period)
// @route   GET /api/leave-balances?employee_id=&policy_period=
// @access  Member (leave.read)
const getEmployeeBalances = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employee_id, policy_period } = req.query;
  if (!employee_id) {
    throw new ApiError(400, "employee_id query parameter is required");
  }

  const balances = await leaveBalanceService.getEmployeeBalances(employee_id, req.workspace.id, {
    policyPeriod: policy_period,
  });

  return sendSuccess(res, { message: "Leave balances fetched", data: balances });
});

// @desc    Adjust (create-if-missing) an employee's allocated_days /
//          carried_forward_days for a leave type + policy period.
//          used_days is never editable here — it only changes via the
//          leave request lifecycle (leaveRequestService.js).
// @route   POST /api/leave-balances/:employeeId/adjust
// @access  HR / Organization Admin (leave.manage)
const adjustBalance = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const updated = await leaveBalanceService.adjustAllocation(
    req.params.employeeId,
    req.workspace.id,
    {
      leave_type_id: req.body.leave_type_id,
      policy_period: req.body.policy_period,
      allocated_days: req.body.allocated_days,
      carried_forward_days: req.body.carried_forward_days,
    },
    req.user?.id
  );

  return sendSuccess(res, { message: "Leave balance adjusted", data: updated });
});

// @desc    Employee-wise leave summary (Sprint 9 feature list)
// @route   GET /api/leave-balances/summary/employee/:employeeId?policy_period=
// @access  Member (leave.read)
const getEmployeeSummary = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const summary = await leaveBalanceService.getEmployeeSummary(
    req.params.employeeId,
    req.workspace.id,
    { policyPeriod: req.query.policy_period }
  );

  return sendSuccess(res, { message: "Employee leave summary fetched", data: summary });
});

// @desc    Department-wise leave summary (Sprint 9 feature list)
// @route   GET /api/leave-balances/summary/department/:departmentId?policy_period=
// @access  Dept Lead / HR / Organization Admin (leave.read)
const getDepartmentSummary = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const summary = await leaveBalanceService.getDepartmentSummary(
    req.params.departmentId,
    req.workspace.id,
    { policyPeriod: req.query.policy_period }
  );

  return sendSuccess(res, { message: "Department leave summary fetched", data: summary });
});

module.exports = {
  getEmployeeBalances,
  adjustBalance,
  getEmployeeSummary,
  getDepartmentSummary,
};