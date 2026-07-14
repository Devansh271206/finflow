import { apiGet, apiPut, apiUpload } from "../lib/apiClient";

function normalizeProfile(row) {
  return {
    ...row,
    full_name: row.full_name || row.fullName || row.name || "User",
    avatar_url: row.avatar_url || row.avatarUrl || "",
  };
}

export async function getProfile() {
  try {
    const { data, error } = await apiGet("/profile");

    if (error) {
      return { data: null, error };
    }

    return { data: data ? normalizeProfile(data) : null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateProfile(updates) {
  try {
    const hasFile = updates.avatar instanceof File;

    if (hasFile) {
      const formData = new FormData();
      formData.append("avatar", updates.avatar);
      if (updates.full_name !== undefined) formData.append("fullName", updates.full_name);
      if (updates.currency !== undefined) formData.append("currency", updates.currency);
      if (updates.theme !== undefined) formData.append("theme", updates.theme);
      if (updates.language !== undefined) formData.append("language", updates.language);
      if (updates.privacyMode !== undefined) formData.append("privacyMode", String(updates.privacyMode));

      const { data, error } = await apiUpload("/profile", formData, "PUT");
      return { data: data ? normalizeProfile(data) : null, error };
    }

    const payload = {
      fullName: updates.full_name,
      currency: updates.currency,
      theme: updates.theme,
      language: updates.language,
      privacyMode: updates.privacyMode,
    };

    const { data, error } = await apiPut("/profile", payload);
    return { data: data ? normalizeProfile(data) : null, error };
  } catch (error) {
    return { data: null, error };
  }
}
