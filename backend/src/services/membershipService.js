/**
 * Membership Service
 * ------------------------------------------------------------------
 * Business logic for resolving which workspace a request applies to and
 * the caller's membership within it, plus admin-facing team management
 * operations (list/view/add/update-role/update-department/update-status/
 * remove). Kept framework-agnostic per PRD §10.1 layering.
 *
 * Phase 2.1.1 additions:
 *   - addMember(): attach an existing registered user to a workspace by
 *     email (no invitations, no new-user creation — see PRD scope note).
 *   - Actor-role guards: the existing `TEAM_MANAGE` permission is shared
 *     by both Admin and Finance/Ops (see 001_phase1_multitenant.sql,
 *     finance_ops is granted every permission except workspace.transfer),
 *     so the "Finance/Ops cannot touch Admins" rule from the RBAC matrix
 *     can't be expressed at the permission-key level — it's enforced here
 *     instead, the same way assertNotLastActiveAdmin already is.
 */

const membershipRepository = require("../repositories/membershipRepository");
const workspaceRepository = require("../repositories/workspaceRepository");
const roleRepository = require("../repositories/roleRepository");
const ApiError = require("../utils/ApiError");

const ADMIN_ROLE_KEY = "admin";
const FINANCE_OPS_ROLE_KEY = "finance_ops";

/**
 * Resolves the effective workspace + membership for a request.
 * (Unchanged from Phase 1 — used by resolveWorkspace middleware.)
 */
async function resolveForRequest(userId, requestedWorkspaceId) {
  if (requestedWorkspaceId) {
    const membership = await membershipRepository.findActiveMembership(
      userId,
      requestedWorkspaceId
    );
    if (!membership) {
      throw new ApiError(
        403,
        "You do not have access to the requested workspace."
      );
    }
    const workspace = await workspaceRepository.findById(requestedWorkspaceId);
    return { workspace, membership };
  }

  const fallbackWorkspaceId = await membershipRepository.findFirstActiveMembership(
    userId
  );
  if (!fallbackWorkspaceId) {
    return { workspace: null, membership: null };
  }

  const membership = await membershipRepository.findActiveMembership(
    userId,
    fallbackWorkspaceId
  );
  const workspace = await workspaceRepository.findById(fallbackWorkspaceId);
  return { workspace, membership };
}

// ------------------------------------------------------------------
// Team Management
// ------------------------------------------------------------------

/**
 * List members of a workspace, with optional search/role/department/
 * status filters, for the Team Management admin page.
 */
async function listMembers(workspaceId, filters) {
  return membershipRepository.listByWorkspaceDetailed(workspaceId, filters);
}

async function getMember(id, workspaceId) {
  const member = await membershipRepository.findByIdInWorkspace(id, workspaceId);
  if (!member) throw new ApiError(404, "Member not found");
  return member;
}

/**
 * Guard: refuse an update that would leave the workspace with zero
 * active admins (e.g. demoting the sole admin, or suspending/removing
 * them). Only checked when the *target* membership is currently an
 * active admin and the change would take it out of that state.
 */
async function assertNotLastActiveAdmin(existingMember, willRemainAdminActive) {
  if (willRemainAdminActive) return;
  if (existingMember.roles?.key !== ADMIN_ROLE_KEY || existingMember.status !== "active") {
    return;
  }

  const adminRole = await roleRepository.findRoleByKey(ADMIN_ROLE_KEY);
  const activeAdminCount = await membershipRepository.countActiveAdmins(
    existingMember.workspace_id,
    adminRole.id
  );

  if (activeAdminCount <= 1) {
    throw new ApiError(
      400,
      "This is the only active admin in the workspace. Assign another admin before changing this membership."
    );
  }
}

/**
 * Guard: Finance/Ops may manage members but not Admins (RBAC matrix —
 * "Finance/Ops: Manage members except Admins"). Admin actors bypass this
 * entirely. Any other actor role reaching this point already failed the
 * TEAM_MANAGE permission check upstream, so it's treated as Admin-only
 * by default (fail closed) rather than assumed to be Finance/Ops.
 */
function assertActorMayTargetMember(actorRoleKey, targetRoleKey) {
  if (actorRoleKey === ADMIN_ROLE_KEY) return;
  if (actorRoleKey === FINANCE_OPS_ROLE_KEY && targetRoleKey !== ADMIN_ROLE_KEY) return;

  throw new ApiError(
    403,
    "Finance/Ops cannot manage Admin members. An Admin must make this change."
  );
}

/**
 * Guard: Finance/Ops cannot promote (or add) a member into the Admin
 * role. Admin actors bypass this entirely.
 */
function assertActorMayAssignRole(actorRoleKey, newRoleKey) {
  if (actorRoleKey === ADMIN_ROLE_KEY) return;
  if (actorRoleKey === FINANCE_OPS_ROLE_KEY && newRoleKey !== ADMIN_ROLE_KEY) return;

  throw new ApiError(
    403,
    "Finance/Ops cannot assign the Admin role. An Admin must make this change."
  );
}

/**
 * Add an existing, already-registered user to a workspace by email.
 * Does NOT create a new auth user and does NOT send an invitation —
 * out of scope for this phase (see PRD). If no profile matches the
 * email, the caller should register first.
 */
async function addMember(workspaceId, { email, roleId, departmentId }, actorRoleKey) {
  const profile = await membershipRepository.findProfileByEmail(email);
  if (!profile) {
    throw new ApiError(
      404,
      "No registered user found with that email. This phase only supports adding existing users."
    );
  }

  const existing = await membershipRepository.findActiveMembership(profile.id, workspaceId);
  if (existing) {
    throw new ApiError(400, "This user is already an active member of the workspace.");
  }

  const roles = await roleRepository.listRoles();
  const targetRole = roles.find((r) => r.id === roleId);
  if (!targetRole) throw new ApiError(400, "Invalid role");

  assertActorMayAssignRole(actorRoleKey, targetRole.key);

  const created = await membershipRepository.create({
    workspace_id: workspaceId,
    user_id: profile.id,
    role_id: roleId,
    department_id: departmentId || null,
    status: "active",
  });

  return membershipRepository.findByIdInWorkspace(created.id, workspaceId);
}

/**
 * Change a member's role. Validates the roleId exists. Guards against
 * demoting the last active admin, Finance/Ops touching an Admin target,
 * and Finance/Ops promoting anyone to Admin.
 */
async function updateMemberRole(id, workspaceId, roleId, actorRoleKey) {
  const existing = await membershipRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Member not found");

  const roles = await roleRepository.listRoles();
  const targetRole = roles.find((r) => r.id === roleId);
  if (!targetRole) throw new ApiError(400, "Invalid role");

  assertActorMayTargetMember(actorRoleKey, existing.roles?.key);
  assertActorMayAssignRole(actorRoleKey, targetRole.key);
  await assertNotLastActiveAdmin(existing, targetRole.key === ADMIN_ROLE_KEY);

  return membershipRepository.update(id, { role_id: roleId });
}

/**
 * Change a member's department. departmentId may be null (unassigned).
 * Department existence/workspace-scoping is validated by the controller
 * via departmentRepository before calling this, keeping this service
 * focused on the membership row itself.
 */
async function updateMemberDepartment(id, workspaceId, departmentId, actorRoleKey) {
  const existing = await membershipRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Member not found");

  assertActorMayTargetMember(actorRoleKey, existing.roles?.key);

  return membershipRepository.update(id, { department_id: departmentId });
}

/**
 * Activate / deactivate (suspend) a member. Guards against suspending
 * the last active admin, and against Finance/Ops touching an Admin
 * target.
 */
async function updateMemberStatus(id, workspaceId, status, actorRoleKey) {
  const existing = await membershipRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Member not found");

  assertActorMayTargetMember(actorRoleKey, existing.roles?.key);
  await assertNotLastActiveAdmin(existing, status === "active");

  return membershipRepository.update(id, { status });
}

/**
 * Remove a member from the workspace. Soft-remove: sets status to
 * "suspended" rather than hard-deleting the row, since memberships has
 * no dedicated "removed" state and deleting would orphan any historical
 * references. Guards against removing the last active admin, and
 * against Finance/Ops removing an Admin.
 */
async function removeMember(id, workspaceId, actorRoleKey) {
  const existing = await membershipRepository.findByIdInWorkspace(id, workspaceId);
  if (!existing) throw new ApiError(404, "Member not found");

  assertActorMayTargetMember(actorRoleKey, existing.roles?.key);
  await assertNotLastActiveAdmin(existing, false);

  return membershipRepository.update(id, { status: "suspended" });
}

module.exports = {
  resolveForRequest,
  listMembers,
  getMember,
  addMember,
  updateMemberRole,
  updateMemberDepartment,
  updateMemberStatus,
  removeMember,
};