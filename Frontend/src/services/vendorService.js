import { apiGet, apiPost, apiPatch } from "../lib/apiClient";

/**
 * List vendors in the active workspace. Returns both active and
 * inactive vendors; callers filter/badge as needed (same convention as
 * departmentService.listDepartments()).
 */
export async function listVendors() {
  return apiGet("/vendors");
}

export async function getVendor(id) {
  return apiGet(`/vendors/${id}`);
}

/**
 * Subscriptions is a filtered view of vendors (is_subscription = true),
 * not a separate resource — PRD §15.7.
 */
export async function listSubscriptions() {
  return apiGet("/vendors/subscriptions");
}

/**
 * Lightweight vendor KPIs — vendor concentration, top-5 spend, upcoming
 * renewal risks. Scoped to what vendors+transactions alone can answer;
 * the fuller Executive/Finance dashboards land separately.
 */
export async function getVendorAnalytics() {
  return apiGet("/vendors/analytics");
}

export async function createVendor(payload) {
  return apiPost("/vendors", payload);
}

/**
 * Partial update — pass any subset of vendor fields, or
 * { is_active: false } to deactivate. There is no deleteVendor export:
 * vendors are never hard-deleted, only soft-deactivated (same rule as
 * departments/employees).
 */
export async function updateVendor(id, payload) {
  return apiPatch(`/vendors/${id}`, payload);
}

export async function deactivateVendor(id) {
  return apiPatch(`/vendors/${id}`, { is_active: false });
}

export async function reactivateVendor(id) {
  return apiPatch(`/vendors/${id}`, { is_active: true });
}
