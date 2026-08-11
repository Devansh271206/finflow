import { apiGet, apiPost, apiPatch } from "../lib/apiClient";

/**
 * List every workspace (with parent company + role) the current user
 * belongs to. Backs the workspace switcher.
 */
export async function listWorkspaces() {
  return apiGet("/workspaces");
}

export async function createWorkspace({ companyId, name }) {
  return apiPost("/workspaces", {
    // company_id is optional: the backend reuses the caller's sole
    // company or auto-creates one so any user can bootstrap a workspace.
    ...(companyId ? { company_id: companyId } : {}),
    name,
  });
}

export async function getWorkspace(id) {
  return apiGet(`/workspaces/${id}`);
}

export async function updateWorkspace(id, payload) {
  return apiPatch(`/workspaces/${id}`, payload);
}