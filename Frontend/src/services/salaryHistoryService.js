import { apiGet, apiPost } from "../lib/apiClient";

/**
 * List salary revisions for an employee. Requires the caller's
 * membership to hold an active salary.read_department grant — a
 * caller without it will get a 403 from the backend even if they can
 * otherwise view the employee (see PRD §13.3 / permissionGrantService.js).
 */
export async function listSalaryHistory(employeeId) {
  return apiGet(`/employees/${employeeId}/salary-history`);
}

/**
 * Record a new salary revision (Admin/HR only).
 * @param {string} employeeId
 * @param {Object} payload - effectiveDate, ctcAnnual, baseSalary,
 *   allowances, bonusAmount, revisionReason
 */
export async function createSalaryRevision(employeeId, payload) {
  return apiPost(`/employees/${employeeId}/salary-history`, payload);
}
