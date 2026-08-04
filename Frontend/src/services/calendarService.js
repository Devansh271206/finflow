import { apiGet } from "../lib/apiClient";

/**
 * Frontend API client for /api/calendar/events
 * (backend/src/routes/calendarRoutes.js -> calendarAggregationService.js).
 *
 * Read-only, matching the backend's "pure aggregation layer" framing
 * (PRD §15.17) — there is no create/update/delete here, every event's
 * source module (leave, holidays) owns its own write path via
 * leaveService.js / holidayService.js respectively.
 */

/**
 * params: { start, end, include } — include is optional, comma-separated
 * subset of "leave,holidays,weekends" (omit for all three).
 * Returns { data, error }; data is a flat array of
 * { id, type, date, title, color, ... } event objects.
 */
export async function getCalendarEvents(params) {
  return apiGet("/calendar/events", params);
}
