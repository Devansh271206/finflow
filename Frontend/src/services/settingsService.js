import { supabase } from "../lib/supabase";
import { apiGet, apiPut } from "../lib/apiClient";

export async function getProfileSettings() {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: authError || new Error("Not authenticated") };
    }

    return {
      data: {
        id: user.id,
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
        avatar: user.user_metadata?.avatar_url || user.user_metadata?.avatar || "",
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateProfileSettings(payload) {
  try {
    return supabase.auth.updateUser({
      data: {
        full_name: payload.name,
        avatar_url: payload.avatar,
      },
    });
  } catch (error) {
    return { data: null, error };
  }
}

export async function getSettings() {
  try {
    const { data, error } = await apiGet("/profile");

    if (error || !data) {
      return {
        data: {
          theme: "dark",
          currency: "₹",
          language: "English",
          privacyMode: false,
        },
        error: error || null,
      };
    }

    return {
      data: {
        theme: data.theme || "dark",
        currency: data.currency || "₹",
        language: data.language || "English",
        privacyMode: data.privacy_mode || false,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateSettings(settings) {
  try {
    const payload = {
      theme: settings.theme,
      currency: settings.currency,
      language: settings.language,
      privacyMode: settings.privacyMode,
    };

    return apiPut("/profile", payload);
  } catch (error) {
    return { data: null, error };
  }
}
