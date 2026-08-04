import { apiGet, apiPost, apiDelete } from "../lib/apiClient";

/**
 * Per-membership permission override grants (currently only
 * salary.read_department — see PRD §13.3). Distinct from role
 * management: these are exceptions granted to one specific person's
 * membership, not role-wide changes.
 */
export async function listPermissionGrants(membershipId) {
  return apiGet(`/memberships/${membershipId}/permission-grants`);
}

export async function grantPermission(membershipId, permissionKey) {
  return apiPost(`/memberships/${membershipId}/permission-grants`, { permissionKey });
}

export async function revokePermissionGrant(membershipId, grantId) {
  return apiDelete(`/memberships/${membershipId}/permission-grants/${grantId}`);
}
