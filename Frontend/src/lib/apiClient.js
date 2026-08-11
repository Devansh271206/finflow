import { supabase } from "./supabase";

// Phase 1: the current workspace id is set by WorkspaceContext on login /
// workspace switch. Read via a getter (not a React hook) so this plain
// module can inject the header without depending on React context.
let currentWorkspaceId = null;
export function setActiveWorkspaceId(workspaceId) {
  currentWorkspaceId = workspaceId || null;
}


function buildUrl(path, params) {
  // Prefer the configured API base (VITE_API_URL — must be the deployed
  // backend URL in production, e.g. https://<backend>.vercel.app/api).
  // Fall back to the current origin so an unset variable can never
  // silently route production traffic to localhost.
  const configuredBase = import.meta.env.VITE_API_URL || "";
  const baseUrl = configuredBase || window.location.origin;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.append(key, String(value));
  });

  return url;
}

async function getAuthHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {};
  }

  return { Authorization: `Bearer ${session.access_token}` };
}

async function requestJson(path, { method = "GET", body, params, headers = {}, isUpload = false } = {}) {
  try {
    const authHeaders = await getAuthHeader();
    const url = buildUrl(path, params);

    const options = {
      method,
      headers: {
        Accept: "application/json",
        ...authHeaders,
        ...(currentWorkspaceId ? { "X-Workspace-Id": currentWorkspaceId } : {}),
        ...headers,
      },
    };

    if (body !== undefined) {
      if (isUpload) {
        options.body = body;
      } else {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, options);
    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch (error) {
      payload = null;
    }

    if (!response.ok || !payload?.success) {
      return {
        data: null,
        error: {
          message: payload?.message || "Request failed",
          ...(payload?.error || {}),
          status: response.status,
        },
      };
    }

    return {
      data: payload?.data ?? null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        message: error?.message || "Network error",
      },
    };
  }
}

export async function apiGet(path, params) {
  return requestJson(path, { method: "GET", params });
}

export async function apiPost(path, body) {
  return requestJson(path, { method: "POST", body });
}

export async function apiPut(path, body) {
  return requestJson(path, { method: "PUT", body });
}

export async function apiPatch(path, body) {
  return requestJson(path, { method: "PATCH", body });
}

export async function apiDelete(path) {
  return requestJson(path, { method: "DELETE" });
}

export async function apiUpload(path, formData, method = "POST") {
  return requestJson(path, {
    method,
    body: formData,
    isUpload: true,
    headers: {},
  });
}
