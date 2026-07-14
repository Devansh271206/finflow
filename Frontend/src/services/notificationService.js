import { apiGet, apiPut } from "../lib/apiClient";

export async function getNotifications() {
  try {
    const { data, error } = await apiGet("/notifications");
    return { data: Array.isArray(data) ? data : [], error };
  } catch (error) {
    return { data: [], error };
  }
}

export async function markNotificationAsRead(id) {
  try {
    return apiPut(`/notifications/${id}`, { isRead: true });
  } catch (error) {
    return { data: null, error };
  }
}
