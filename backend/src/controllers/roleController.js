/**
 * Role Controller
 * ------------------------------------------------------------------
 * Phase 1: read-only. Roles are system-seeded (admin/finance_ops/
 * dept_lead/employee) via migration 001; custom/editable roles are a
 * later-phase concern. This exposes roles + permissions + the caller's
 * own resolved permission set for the frontend PermissionContext.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const roleRepository = require("../repositories/roleRepository");
const permissionService = require("../services/permissionService");

// @desc    List all system roles
// @route   GET /api/roles
// @access  Member
const getRoles = asyncHandler(async (req, res) => {
  const roles = await roleRepository.listRoles();
  return sendSuccess(res, { message: "Roles fetched", data: roles });
});

// @desc    List all permission keys
// @route   GET /api/roles/permissions
// @access  Member
const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await roleRepository.listPermissions();
  return sendSuccess(res, { message: "Permissions fetched", data: permissions });
});

// @desc    Get the authenticated user's permission keys for the resolved
//          workspace (req.membership, set by resolveWorkspace)
// @route   GET /api/roles/me
// @access  Member
const getMyPermissions = asyncHandler(async (req, res) => {
  if (!req.membership) {
    return sendSuccess(res, {
      message: "No active workspace membership",
      data: { role: null, permissions: [] },
    });
  }

  const permissions = await permissionService.getPermissionKeysForRole(
    req.membership.roleId
  );

  return sendSuccess(res, {
    message: "Permissions fetched",
    data: {
      role: { key: req.membership.roleKey, name: req.membership.roleName },
      departmentId: req.membership.departmentId,
      permissions,
    },
  });
});

module.exports = { getRoles, getPermissions, getMyPermissions };
