/**
 * Platform Admin Controller
 * ------------------------------------------------------------------
 * Thin HTTP layer over platformAdminService.js. Every route here sits
 * behind requirePlatformAdmin (wired in platformAdminRoutes.js), so
 * there's no per-endpoint permission check the way reportController.js
 * needs — platform-admin access is all-or-nothing for v1 (PRD gives no
 * indication of finer-grained platform roles yet).
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const platformAdminService = require("../services/platformAdminService");

// @desc    List organizations (optionally filtered by status)
// @route   GET /api/platform/organizations
// @access  Platform Admin
const listOrganizations = asyncHandler(async (req, res) => {
  const organizations = await platformAdminService.listOrganizations({
    status: req.query.status,
  });
  return sendSuccess(res, { message: "Organizations fetched successfully", data: organizations });
});

// @desc    Get one organization's detail + stats
// @route   GET /api/platform/organizations/:id
// @access  Platform Admin
const getOrganization = asyncHandler(async (req, res) => {
  const organization = await platformAdminService.getOrganizationById(req.params.id);
  return sendSuccess(res, { message: "Organization fetched successfully", data: organization });
});

// @desc    Activate a suspended organization
// @route   POST /api/platform/organizations/:id/activate
// @access  Platform Admin
const activateOrganization = asyncHandler(async (req, res) => {
  const organization = await platformAdminService.activateOrganization(req.params.id);
  return sendSuccess(res, { message: "Organization activated.", data: organization });
});

// @desc    Suspend an active organization
// @route   POST /api/platform/organizations/:id/suspend
// @access  Platform Admin
const suspendOrganization = asyncHandler(async (req, res) => {
  const organization = await platformAdminService.suspendOrganization(req.params.id);
  return sendSuccess(res, { message: "Organization suspended.", data: organization });
});

// @desc    Soft-delete an organization
// @route   DELETE /api/platform/organizations/:id
// @access  Platform Admin
const deleteOrganization = asyncHandler(async (req, res) => {
  await platformAdminService.deleteOrganization(req.params.id);
  return sendSuccess(res, { message: "Organization deleted.", data: null });
});

// @desc    Platform dashboard summary (org counts, recent growth)
// @route   GET /api/platform/dashboard
// @access  Platform Admin
const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await platformAdminService.getPlatformDashboard();
  return sendSuccess(res, { message: "Platform dashboard fetched successfully", data: dashboard });
});

// @desc    Platform-wide analytics (org growth over a longer window)
// @route   GET /api/platform/analytics
// @access  Platform Admin
const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await platformAdminService.getPlatformAnalytics();
  return sendSuccess(res, { message: "Platform analytics fetched successfully", data: analytics });
});

module.exports = {
  listOrganizations,
  getOrganization,
  activateOrganization,
  suspendOrganization,
  deleteOrganization,
  getDashboard,
  getAnalytics,
};
