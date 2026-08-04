import { apiGet } from "../lib/apiClient";

/**
 * List timeline events for an employee. Read-only — these rows are
 * generated entirely by database triggers (profile changes, salary
 * revisions), never written directly by the application.
 */
export async function listEmployeeTimeline(employeeId) {
  return apiGet(`/employees/${employeeId}/timeline`);
}
