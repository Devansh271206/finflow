import { apiGet } from "../lib/apiClient";

/**
 * Frontend API client for /api/activity
 * (backend/src/routes/activityRoutes.js -> activityService.js).
 * Role-scoped server-side (Admin=all, Manager=dept/team, Employee=own)
 * — this client just passes through whatever params the page provides.
 */

/**
 * params (all optional): { page, limit, search, module }
 * Returns { data, error, meta } — meta.total is the full count.
 */
export async function getActivity(params = {}) {
  try {
    const { data, error, meta } = await apiGet("/activity", params);
    return { data: Array.isArray(data) ? data : [], error, meta };
  } catch (error) {
    return { data: [], error, meta: null };
  }
}
