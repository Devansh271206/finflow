import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/apiClient";

export async function listMembers(filters = {}) {
  return apiGet("/memberships", filters);
}

export async function createMember({ email, roleId, departmentId }) {
  return apiPost("/memberships", { email, role_id: roleId, department_id: departmentId || null });
}

export async function getMember(id) {
  return apiGet(`/memberships/${id}`);
}

export async function updateMemberRole(id, roleId) {
  return apiPatch(`/memberships/${id}/role`, { role_id: roleId });
}

export async function updateMemberDepartment(id, departmentId) {
  return apiPatch(`/memberships/${id}/department`, { department_id: departmentId });
}

export async function activateMember(id) {
  return apiPatch(`/memberships/${id}/status`, { status: "active" });
}

export async function deactivateMember(id) {
  return apiPatch(`/memberships/${id}/status`, { status: "suspended" });
}

export async function removeMember(id) {
  return apiDelete(`/memberships/${id}`);
}