const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const membershipPermissionGrantService = require("../services/membershipPermissionGrantService");

// @desc    List active permission grants for a membership
// @route   GET /api/memberships/:membershipId/permission-grants
// @access  Private (PERMISSION_GRANTS_MANAGE)
const listGrants = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { membershipId } = req.params;
  const data = await membershipPermissionGrantService.listGrantsForMembership(
    membershipId,
    req.workspace.id
  );

  return sendSuccess(res, { message: "Permission grants fetched successfully", data });
});

// @desc    Grant a per-membership permission override
// @route   POST /api/memberships/:membershipId/permission-grants
// @access  Private (PERMISSION_GRANTS_MANAGE)
const createGrant = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { membershipId } = req.params;
  const { permissionKey } = req.body;

  const data = await membershipPermissionGrantService.grant(req.workspace.id, {
    membershipId,
    permissionKey,
    grantedBy: req.user.id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Permission granted successfully",
    data,
  });
});

// @desc    Revoke a permission grant
// @route   DELETE /api/memberships/:membershipId/permission-grants/:grantId
// @access  Private (PERMISSION_GRANTS_MANAGE)
const revokeGrant = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { grantId } = req.params;
  const data = await membershipPermissionGrantService.revoke(
    grantId,
    req.workspace.id,
    req.user.id
  );

  return sendSuccess(res, { message: "Permission grant revoked successfully", data });
});

module.exports = { listGrants, createGrant, revokeGrant };
