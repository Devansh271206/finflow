import { apiGet, apiPost } from "../lib/apiClient";

/**
 * Public lookup of an invitation by its secret token (join page).
 */
export async function getInvitation(token) {
  return apiGet(`/invitations/${token}`);
}

/**
 * Accept a workspace invitation as the currently signed-in user.
 */
export async function acceptInvitation(token) {
  return apiPost(`/invitations/${token}/accept`, {});
}

/**
 * Create + email a workspace invitation (admin / team.invite).
 */
export async function createInvitation({ email, roleId, departmentId }) {
  return apiPost("/invitations", {
    email,
    role_id: roleId,
    department_id: departmentId || null,
  });
}
