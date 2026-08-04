/**
 * Role Dashboard Controller
 * ------------------------------------------------------------------
 * Sprint 10 — Role-Based Dashboard System.
 *
 * GET /api/dashboard/role-summary
 *
 * Additive endpoint — does not replace or modify the existing
 * GET /api/dashboard (personal-finance summary), which stays exactly
 * as-is for backward compatibility (dashboardController.js/
 * dashboardService.js untouched).
 *
 * All RBAC here reuses what already exists: authenticate + resolveWorkspace
 * (mounted the same way every other route file does) resolve req.user and
 * req.membership before this controller ever runs; dashboardRoleMap.js's
 * resolveDashboardRole() then turns req.membership.roleKey into exactly
 * one of the six dashboard variants, and this controller just dispatches
 * to the matching roleDashboardService function — it does not re-implement
 * any permission logic of its own.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const roleDashboardService = require("../services/roleDashboardService");
const employeeRepository = require("../repositories/employeeRepository");
const { resolveDashboardRole, DASHBOARD_ROLES } = require("../utils/dashboardRoleMap");

// @desc    Role-aware dashboard summary — widgets/KPIs vary by the
//          caller's resolved dashboard role (executive/finance/hr/
//          operations/dept_lead/employee)
// @route   GET /api/dashboard/role-summary
// @access  Private
const getRoleDashboard = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }
  if (!req.membership) {
    throw new ApiError(403, "No active membership resolved for this workspace");
  }

  const role = resolveDashboardRole(req.membership.roleKey);
  const workspaceId = req.workspace.id;

  let data;

  switch (role) {
    case DASHBOARD_ROLES.EXECUTIVE:
      data = await roleDashboardService.getExecutiveDashboard(workspaceId);
      break;

    case DASHBOARD_ROLES.FINANCE:
      data = await roleDashboardService.getFinanceDashboard(workspaceId);
      break;

    case DASHBOARD_ROLES.HR:
      data = await roleDashboardService.getHRDashboard(workspaceId);
      break;

    case DASHBOARD_ROLES.OPERATIONS:
      data = await roleDashboardService.getOperationsDashboard(workspaceId);
      break;

    case DASHBOARD_ROLES.DEPT_LEAD:
      data = await roleDashboardService.getDeptLeadDashboard(workspaceId, req.membership.departmentId);
      break;

    case DASHBOARD_ROLES.EMPLOYEE:
    default: {
      // employees.id is a different id space from req.user.id (the auth
      // user id) — same resolution leaveRequestController.js already
      // needed for decided_by/created_by. findByUserIdInWorkspace()
      // returns null (not a throw) if this auth user has no employee
      // record yet, which getEmployeeDashboard() already handles by
      // degrading to empty widgets rather than erroring.
      const employee = await employeeRepository.findByUserIdInWorkspace(req.user?.id, workspaceId);
      data = await roleDashboardService.getEmployeeDashboard(workspaceId, employee?.id || null, req.user?.id);
      break;
    }
  }

  return sendSuccess(res, {
    message: "Dashboard summary fetched successfully",
    data: { role, ...data },
  });
});

module.exports = { getRoleDashboard };
