import { apiGet, apiPost, apiPut } from "../lib/apiClient";

/**
 * List employees in the active workspace.
 * @param {Object} params - Query parameters (e.g., department_id, employment_status)
 */
export async function listEmployees(params = {}) {
  return apiGet("/employees", params);
}

/**
 * Get the employee profile for the currently authenticated user.
 */
export async function getSelfEmployee() {
  return apiGet("/employees/me");
}

/**
 * Get a specific employee by ID.
 */
export async function getEmployee(id) {
  return apiGet(`/employees/${id}`);
}

/**
 * Get direct reports for a given employee (manager).
 */
export async function getDirectReports(id) {
  return apiGet(`/employees/${id}/reports`);
}

/**
 * Create a new employee.
 * @param {Object} payload - employeeCode, fullName, designation, departmentId, etc.
 */
export async function createEmployee(payload) {
  return apiPost("/employees", payload);
}

/**
 * Update an existing employee.
 * @param {string} id - Employee ID
 * @param {Object} payload - Fields to update
 */
export async function updateEmployee(id, payload) {
  return apiPut(`/employees/${id}`, payload);
}

/**
 * Terminate an employee (soft-delete equivalent).
 * @param {string} id - Employee ID
 * @param {Object} payload - Optional { dateOfExit }
 */
export async function terminateEmployee(id, payload = {}) {
  return apiPost(`/employees/${id}/terminate`, payload);
}
