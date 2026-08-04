import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/apiClient";

/**
 * Frontend API client for /api/holidays (backend/src/routes/holidayRoutes.js).
 * Mirrors departmentService.js's shape — thin passthroughs to apiClient,
 * every call resolves to { data, error } and never throws (apiClient's
 * own contract), so callers handle errors explicitly rather than via
 * try/catch.
 */

/**
 * List holidays for the active workspace (admin management view —
 * unbounded by date, includes past years). Optional { search, type,
 * sort_by, sort_order }.
 */
export async function listHolidays(params = {}) {
  return apiGet("/holidays", params);
}

export async function getHoliday(id) {
  return apiGet(`/holidays/${id}`);
}

/**
 * Holiday occurrences (recurring rows already projected onto concrete
 * dates) within [start, end] — the feed the enterprise calendar itself
 * should call for holiday rendering, distinct from listHolidays() which
 * is for the admin management screen.
 */
export async function getHolidaysInRange(start, end) {
  return apiGet("/holidays/range", { start, end });
}

/**
 * payload: { name, date, type ('public'|'organization'), description,
 * is_recurring_annual }
 */
export async function createHoliday(payload) {
  return apiPost("/holidays", payload);
}

export async function updateHoliday(id, payload) {
  return apiPatch(`/holidays/${id}`, payload);
}

export async function deleteHoliday(id) {
  return apiDelete(`/holidays/${id}`);
}
