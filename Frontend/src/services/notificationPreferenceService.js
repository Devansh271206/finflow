import { apiGet, apiPut } from "../lib/apiClient";

/**
 * Frontend API client for /api/notifications/preferences
 * (backend/src/routes/notificationPreferenceRoutes.js).
 */

/**
 * Returns { data, error } where data is an array of
 * { eventType, label, isEnabled } covering all 17 event types
 * (server always returns the full set — see
 * notificationPreferenceController.js's getPreferences).
 */
export async function getNotificationPreferences() {
  try {
    return await apiGet("/notifications/preferences");
  } catch (error) {
    return { data: [], error };
  }
}

export async function updateNotificationPreference(eventType, isEnabled) {
  try {
    return await apiPut(`/notifications/preferences/${eventType}`, { isEnabled });
  } catch (error) {
    return { data: null, error };
  }
}
