import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/apiClient";

/**
 * List teams in the active workspace (X-Workspace-Id header attached
 * automatically by apiClient — see WorkspaceContext).
 * @param {Object} params - department_id, search, status, sort_by,
 *   sort_order, page, page_size — all optional; omit page/page_size to
 *   get the full unpaginated array (mirrors departmentService.js /
 *   employeeService.js's convention).
 */
export async function listTeams(params = {}) {
  return apiGet("/teams", params);
}

/**
 * Get a single team, including its member roster (backend returns
 * { ...team, members: [...] } in one call for the Team Details page).
 */
export async function getTeam(id) {
  return apiGet(`/teams/${id}`);
}

export async function createTeam(payload) {
  // payload: { department_id, name, description? }
  return apiPost("/teams", payload);
}

/**
 * Partial update — pass { name } and/or { description } to edit, or
 * { is_active } to deactivate/reactivate. No deleteTeam export: teams
 * are never hard-deleted, only soft-deactivated (same convention as
 * departmentService.js).
 */
export async function updateTeam(id, payload) {
  return apiPatch(`/teams/${id}`, payload);
}

export async function deactivateTeam(id) {
  return apiPatch(`/teams/${id}`, { is_active: false });
}

export async function reactivateTeam(id) {
  return apiPatch(`/teams/${id}`, { is_active: true });
}

/**
 * Assign the Team Lead. Pass employeeId = null to clear the lead.
 */
export async function assignTeamLead(id, employeeId) {
  return apiPatch(`/teams/${id}/lead`, { employee_id: employeeId });
}

export async function addTeamMember(id, employeeId) {
  return apiPost(`/teams/${id}/members`, { employee_id: employeeId });
}

export async function removeTeamMember(id, employeeId) {
  return apiDelete(`/teams/${id}/members/${employeeId}`);
}