/**
 * Membership Permission Grant Service
 * ------------------------------------------------------------------
 * Business logic for membership_permission_grants. Enforces which
 * permission keys are actually eligible for this per-membership
 * override mechanism (see migration 007 / repository header) — it is
 * NOT a general "grant any permission to any membership" bypass of
 * role_permissions, only for the specific keys documented as
 * "not implied by role".
 *
 * Who is ALLOWED to call grant()/revoke() is enforced at the route
 * layer via authorize(PERMISSIONS.PERMISSION_GRANTS_MANAGE) — this
 * service does not re-check role, consistent with how every other
 * service in this codebase (budgetService, employeeService) leaves
 * "can this caller reach this endpoint" entirely to authorize().
 */

const membershipPermissionGrantRepository = require("../repositories/membershipPermissionGrantRepository");
const membershipRepository = require("../repositories/membershipRepository");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const ApiError = require("../utils/ApiError");

// Only these keys may be granted per-membership. Currently just
// salary.read_department (PRD §13.3). Deliberately a short allowlist,
// not "any key in PERMISSIONS" — most permissions are role-implied by
// design, and this mechanism exists specifically for the documented
// exceptions to that rule.
const GRANTABLE_PERMISSION_KEYS = Object.freeze([PERMISSIONS.SALARY_READ_DEPARTMENT]);

function assertGrantablePermission(permissionKey) {
  if (!GRANTABLE_PERMISSION_KEYS.includes(permissionKey)) {
    throw new ApiError(
      400,
      `"${permissionKey}" is not a permission that can be granted per-membership. ` +
        `Grantable keys: ${GRANTABLE_PERMISSION_KEYS.join(", ")}`
    );
  }
}

/**
 * Confirms this permission key has an active grant for this membership.
 * This is the function permission-gated code (salaryHistoryService)
 * calls — it deliberately takes membershipId, not userId, since a grant
 * is scoped to one specific membership (one person's access within one
 * specific workspace), matching how role assignment already works here.
 */
async function hasActiveGrant(membershipId, permissionKey) {
  if (!membershipId) return false;
  const grant = await membershipPermissionGrantRepository.findActiveGrant(
    membershipId,
    permissionKey
  );
  return Boolean(grant);
}

async function listGrantsForMembership(membershipId, workspaceId) {
  const membership = await membershipRepository.findByIdInWorkspace(membershipId, workspaceId);
  if (!membership) throw new ApiError(404, "Membership not found in this workspace");

  return membershipPermissionGrantRepository.listActiveForMembership(membershipId);
}

async function grant(workspaceId, { membershipId, permissionKey, grantedBy }) {
  assertGrantablePermission(permissionKey);

  const membership = await membershipRepository.findByIdInWorkspace(membershipId, workspaceId);
  if (!membership) throw new ApiError(404, "Membership not found in this workspace");

  const existing = await membershipPermissionGrantRepository.findActiveGrant(
    membershipId,
    permissionKey
  );
  if (existing) {
    throw new ApiError(409, "This membership already has an active grant for this permission");
  }

  return membershipPermissionGrantRepository.create({ membershipId, permissionKey, grantedBy });
}

async function revoke(id, workspaceId, revokedBy) {
  const existingGrant = await membershipPermissionGrantRepository.findById(id);
  if (!existingGrant) throw new ApiError(404, "Grant not found");

  const membership = await membershipRepository.findByIdInWorkspace(
    existingGrant.membership_id,
    workspaceId
  );
  if (!membership) throw new ApiError(404, "Grant not found");

  if (existingGrant.revoked_at) {
    throw new ApiError(400, "This grant has already been revoked");
  }

  return membershipPermissionGrantRepository.revoke(id, revokedBy);
}

module.exports = {
  GRANTABLE_PERMISSION_KEYS,
  hasActiveGrant,
  listGrantsForMembership,
  grant,
  revoke,
};
