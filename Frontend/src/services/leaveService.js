import { apiGet, apiPost, apiPatch } from "../lib/apiClient";

/**
 * Sprint 9: Leave Management. Thin wrappers over the leave-types,
 * leave-balances, and leave-requests endpoints — mirrors
 * departmentService.js's shape (X-Workspace-Id header attached
 * automatically by apiClient).
 */

// ---------------------------------------------------------------------------
// Leave Types
// ---------------------------------------------------------------------------

export async function listLeaveTypes(params = {}) {
  return apiGet("/leave-types", params);
}

export async function getLeaveType(id) {
  return apiGet(`/leave-types/${id}`);
}

export async function createLeaveType(payload) {
  return apiPost("/leave-types", payload);
}

export async function updateLeaveType(id, payload) {
  return apiPatch(`/leave-types/${id}`, payload);
}

export async function deactivateLeaveType(id) {
  return apiPatch(`/leave-types/${id}`, { is_active: false });
}

export async function reactivateLeaveType(id) {
  return apiPatch(`/leave-types/${id}`, { is_active: true });
}

// ---------------------------------------------------------------------------
// Leave Balances
// ---------------------------------------------------------------------------

export async function getEmployeeBalances(employeeId, params = {}) {
  return apiGet("/leave-balances", { employee_id: employeeId, ...params });
}

export async function adjustLeaveBalance(employeeId, payload) {
  return apiPost(`/leave-balances/${employeeId}/adjust`, payload);
}

export async function getEmployeeLeaveSummary(employeeId, params = {}) {
  return apiGet(`/leave-balances/summary/employee/${employeeId}`, params);
}

export async function getDepartmentLeaveSummary(departmentId, params = {}) {
  return apiGet(`/leave-balances/summary/department/${departmentId}`, params);
}

// ---------------------------------------------------------------------------
// Leave Requests
// ---------------------------------------------------------------------------

/**
 * List leave requests. Pass { employee_id } for an employee's own
 * requests, { department_id } for the Manager Leave Dashboard, or
 * neither (with leave.read at the broader HR/Admin level) for a full
 * workspace view. Supports status/date-range/search/sort/pagination —
 * omit page/page_size for the full unpaginated array.
 */
export async function listLeaveRequests(params = {}) {
  return apiGet("/leave-requests", params);
}

export async function getLeaveRequest(id) {
  return apiGet(`/leave-requests/${id}`);
}

export async function getLeaveHistory(employeeId) {
  return apiGet(`/leave-requests/history/${employeeId}`);
}

export async function submitLeaveRequest(payload) {
  return apiPost("/leave-requests", payload);
}

/**
 * Edit a still-pending leave request. payload must include
 * employee_id (ownership check happens server-side) plus whichever of
 * leave_type_id/start_date/end_date/is_half_day/half_day_period/reason
 * are changing.
 */
export async function updateLeaveRequest(id, payload) {
  return apiPatch(`/leave-requests/${id}`, payload);
}

export async function approveLeaveRequest(id) {
  return apiPost(`/leave-requests/${id}/approve`);
}

export async function rejectLeaveRequest(id, reason) {
  return apiPost(`/leave-requests/${id}/reject`, { reason });
}

export async function cancelLeaveRequest(id) {
  return apiPost(`/leave-requests/${id}/cancel`);
}