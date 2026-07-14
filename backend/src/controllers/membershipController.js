/**
 * Membership Controller
 * ------------------------------------------------------------------
 * Table: memberships (reused as-is — no new tables/columns)
 * Columns used: id, workspace_id, user_id, role_id, department_id,
 *               status, joined_at
 *
 * Route protection (see membershipRoutes.js):
 *   authenticate -> resolveWorkspace -> authorize(PERMISSIONS.TEAM_MANAGE)
 *   (createMember additionally accepts PERMISSIONS.TEAM_INVITE — see route)
 *
 * Scope: Team Management admin page for Workspace Admin + Finance/Ops.
 * Adding a member only attaches an *existing* registered user by email —
 * no email invitations, no new-user creation (out of scope this phase).
 *
 * Phase 2.1.1: every mutating action now passes req.membership.roleKey
 * through to the service as `actorRoleKey`, so membershipService can
 * enforce "Finance/Ops cannot manage/promote Admins" — a distinction the
 * shared TEAM_MANAGE permission can't express on its own.
 */

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const membershipService = require("../services/membershipService");
const departmentRepository = require("../repositories/departmentRepository");

// @desc    List all members of the resolved workspace, with optional
//          search/role/department/status filters
// @route   GET /api/memberships?search=&role=&department=&status=
// @access  Admin / Finance-Ops (team.manage)
const getMembers = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { search, role, department, status } = req.query;
  const members = await membershipService.listMembers(req.workspace.id, {
    search,
    role,
    department,
    status,
  });

  return sendSuccess(res, { message: "Members fetched", data: members });
});

// @desc    Get a single member's details
// @route   GET /api/memberships/:id
// @access  Admin / Finance-Ops (team.manage)
const getMemberById = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const member = await membershipService.getMember(req.params.id, req.workspace.id);
  return sendSuccess(res, { message: "Member fetched", data: member });
});

// @desc    Add an existing registered user to the workspace by email
// @route   POST /api/memberships
// @access  Admin / Finance-Ops (team.invite)
const createMember = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { email, role_id, department_id } = req.body;
  if (!email) throw new ApiError(400, "email is required");
  if (!role_id) throw new ApiError(400, "role_id is required");

  if (department_id) {
    const department = await departmentRepository.findByIdInWorkspace(
      department_id,
      req.workspace.id
    );
    if (!department) throw new ApiError(404, "Department not found");
  }

  const created = await membershipService.addMember(
    req.workspace.id,
    { email: email.trim().toLowerCase(), roleId: role_id, departmentId: department_id || null },
    req.membership?.roleKey
  );

  return sendSuccess(res, { message: "Member added to workspace", data: created });
});

// @desc    Change a member's role
// @route   PATCH /api/memberships/:id/role
// @access  Admin / Finance-Ops (team.manage)
const updateMemberRole = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { role_id } = req.body;
  if (!role_id) throw new ApiError(400, "role_id is required");

  const updated = await membershipService.updateMemberRole(
    req.params.id,
    req.workspace.id,
    role_id,
    req.membership?.roleKey
  );
  return sendSuccess(res, { message: "Member role updated", data: updated });
});

// @desc    Change a member's department (department_id may be null)
// @route   PATCH /api/memberships/:id/department
// @access  Admin / Finance-Ops (team.manage)
const updateMemberDepartment = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { department_id } = req.body;

  if (department_id) {
    const department = await departmentRepository.findByIdInWorkspace(
      department_id,
      req.workspace.id
    );
    if (!department) throw new ApiError(404, "Department not found");
  }

  const updated = await membershipService.updateMemberDepartment(
    req.params.id,
    req.workspace.id,
    department_id || null,
    req.membership?.roleKey
  );
  return sendSuccess(res, { message: "Member department updated", data: updated });
});

// @desc    Activate or deactivate (suspend) a member
// @route   PATCH /api/memberships/:id/status
// @access  Admin / Finance-Ops (team.manage)
const updateMemberStatus = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) {
    throw new ApiError(400, "status must be 'active' or 'suspended'");
  }

  const updated = await membershipService.updateMemberStatus(
    req.params.id,
    req.workspace.id,
    status,
    req.membership?.roleKey
  );
  return sendSuccess(res, { message: "Member status updated", data: updated });
});

// @desc    Remove a member from the workspace (soft-remove: sets status
//          to 'suspended' — memberships has no hard-delete path here,
//          consistent with the departments soft-delete pattern)
// @route   DELETE /api/memberships/:id
// @access  Admin / Finance-Ops (team.manage)
const removeMember = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const updated = await membershipService.removeMember(
    req.params.id,
    req.workspace.id,
    req.membership?.roleKey
  );
  return sendSuccess(res, { message: "Member removed from workspace", data: updated });
});

module.exports = {
  getMembers,
  getMemberById,
  createMember,
  updateMemberRole,
  updateMemberDepartment,
  updateMemberStatus,
  removeMember,
};