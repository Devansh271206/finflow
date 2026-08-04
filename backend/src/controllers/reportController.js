/**
 * Report Controller
 * ------------------------------------------------------------------
 * Thin HTTP layer over reportService.js. Same three-endpoint shape for
 * every report in reportRegistry.js — no per-report controller
 * functions, matching this sprint's "generic and reusable, not one
 * implementation per report" goal.
 *
 * Routes (wired in reportRoutes.js):
 *   GET /api/reports                  -> list reports this role can view
 *   GET /api/reports/:reportId        -> filtered/sorted/paginated data
 *   GET /api/reports/:reportId/export -> CSV download
 *
 * RBAC: reportRoutes.js runs protect + resolveWorkspace first (same
 * chain as every other route file). Per-report view permission is
 * checked HERE (not via authorize() middleware) because the
 * permission key is dynamic — it depends on which :reportId was
 * requested, which authorize() can't know at route-registration time.
 * Export additionally requires the REPORTS_EXPORT permission on top of
 * the report's own view permission.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const reportService = require("../services/reportService");
const permissionService = require("../services/permissionService");
const { getReportConfig } = require("../config/reportRegistry");
const { PERMISSIONS } = require("../utils/permissionRegistry");

// Shared "does this membership's role have this permission" check.
// Phase 1 rollout convention (see authorize.js's header comment):
// no membership resolved yet (legacy caller) is treated as allowed,
// same as authorize()'s own `if (!req.membership) return next();`
// fallback, so reports behave consistently with every other RBAC'd
// endpoint during this rollout window.
async function checkPermission(req, permissionKey) {
  if (!req.membership) return true;
  return permissionService.hasPermission(req.membership.roleId, permissionKey);
}

async function assertCanViewReport(req, config) {
  const allowed = await checkPermission(req, config.permission);
  if (!allowed) {
    throw new ApiError(403, `You do not have permission to view the ${config.label}.`);
  }
}

// @desc    List reports the current role is permitted to view
// @route   GET /api/reports
// @access  Private
const listReports = asyncHandler(async (req, res) => {
  const reports = await reportService.listAvailableReports((permissionKey) =>
    checkPermission(req, permissionKey)
  );
  return sendSuccess(res, { message: "Reports fetched successfully", data: reports });
});

// @desc    Get filtered/sorted/paginated data for one report
// @route   GET /api/reports/:reportId
// @access  Private
const getReport = asyncHandler(async (req, res) => {
  const config = getReportConfig(req.params.reportId);
  if (!config) throw new ApiError(404, `Unknown report "${req.params.reportId}"`);

  await assertCanViewReport(req, config);

  const data = await reportService.getReportData(
    config.id,
    req.workspace?.id,
    req.query,
    req.membership?.id
  );

  return sendSuccess(res, {
    message: "Report fetched successfully",
    data,
    meta: { total: data.total, page: data.page, pageSize: data.pageSize },
  });
});

// @desc    Export a report as CSV
// @route   GET /api/reports/:reportId/export
// @access  Private
const exportReport = asyncHandler(async (req, res) => {
  const config = getReportConfig(req.params.reportId);
  if (!config) throw new ApiError(404, `Unknown report "${req.params.reportId}"`);

  await assertCanViewReport(req, config);

  const canExport = await checkPermission(req, PERMISSIONS.REPORTS_EXPORT);
  if (!canExport) {
    throw new ApiError(403, "You do not have permission to export reports.");
  }

  const { csv, filename } = await reportService.exportReportCsv(
    config.id,
    req.workspace?.id,
    req.query,
    req.membership?.id
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

module.exports = {
  listReports,
  getReport,
  exportReport,
};
