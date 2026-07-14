import { apiGet, apiPost, apiPatch } from "../lib/apiClient";

/**
 * List departments in the active workspace (X-Workspace-Id header is
 * attached automatically by apiClient — see WorkspaceContext). Returns
 * both active and inactive departments; callers filter/badge as needed.
 */
export async function listDepartments() {
  return apiGet("/departments");
}

export async function getDepartment(id) {
  return apiGet(`/departments/${id}`);
}

export async function createDepartment(name) {
  return apiPost("/departments", { name });
}

/**
 * Partial update — pass { name } to rename, { is_active } to
 * deactivate/reactivate, or both. There is no deleteDepartment export:
 * departments are never hard-deleted, only soft-deactivated.
 */
export async function updateDepartment(id, payload) {
  return apiPatch(`/departments/${id}`, payload);
}

export async function deactivateDepartment(id) {
  return apiPatch(`/departments/${id}`, { is_active: false });
}

export async function reactivateDepartment(id) {
  return apiPatch(`/departments/${id}`, { is_active: true });
}