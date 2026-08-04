import { apiGet, apiPost, apiUpload } from "../lib/apiClient";

/**
 * Row-level payroll records for one employee. Requires the caller's
 * membership to hold an active salary.read_department grant — same
 * gate as salaryHistoryService.js, a caller without it gets a 403 even
 * if they can otherwise view the employee.
 */
export async function listPayrollForEmployee(employeeId) {
  return apiGet(`/employees/${employeeId}/payroll`);
}

/**
 * Creates a new payroll record (Admin/HR only). Returns
 * { data: { record, warnings }, error } — warnings is always an array
 * (possibly empty); it never blocks the save, per PRD §18.2.
 */
export async function createPayrollRecord(employeeId, payload) {
  return apiPost(`/employees/${employeeId}/payroll`, payload);
}

export async function uploadPayslip(employeeId, recordId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload(`/employees/${employeeId}/payroll/${recordId}/payslip`, formData);
}

export async function getPayslipUrl(employeeId, recordId) {
  return apiGet(`/employees/${employeeId}/payroll/${recordId}/payslip`);
}

/**
 * Aggregate-only workspace payroll summary (Finance's visibility level
 * — no employee-level rows, no salary.read_department grant needed).
 */
export async function getPayrollSummary({ month, year } = {}) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (year) params.set("year", year);
  const qs = params.toString();
  return apiGet(`/payroll/summary${qs ? `?${qs}` : ""}`);
}

/**
 * Bulk CSV import (Admin/HR only). Returns a per-row success/failure
 * report — a bad row doesn't abort the whole file.
 */
export async function importPayrollCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload("/payroll/import", formData);
}
