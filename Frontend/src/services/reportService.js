import { apiGet } from "../lib/apiClient";
import { supabase } from "../lib/supabase";

// Same localStorage key WorkspaceContext.jsx uses to persist the active
// workspace id and feed it to apiClient's setActiveWorkspaceId(). Read
// directly here (rather than importing a getter that doesn't exist on
// apiClient.js) since CSV export needs to build its own fetch call —
// apiGet can't be reused for it, see this file's header note.
const ACTIVE_WORKSPACE_STORAGE_KEY = "finflow_active_workspace_id";

/**
 * GET /api/reports — list reports the current role/workspace can view.
 * Returns [{ id, label, module }, ...].
 */
export async function getAvailableReports() {
  try {
    return await apiGet("/reports");
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * GET /api/reports/:reportId — filtered/sorted/paginated report data.
 * `params` maps directly onto the query string the backend
 * reportService.getReportData() reads (search, <filterKey>,
 * <filterKey>From/To for date ranges, sortBy, sortOrder, page, pageSize).
 * Returns { reportId, label, columns, filters, chart, summary, rows,
 * total, page, pageSize }.
 */
export async function getReportData(reportId, params = {}) {
  try {
    return await apiGet(`/reports/${reportId}`, params);
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * GET /api/reports/:reportId/export — downloads the CSV export for the
 * current filter set. Triggers a browser save-as via an in-memory blob
 * link (no apiClient reuse — that helper always parses the response
 * body as JSON, which would break on a CSV payload).
 *
 * Returns { error: null } on success (nothing meaningful to hand back
 * — the browser is already downloading the file) or { error } if the
 * request failed, so callers can show a toast either way without
 * needing the raw blob.
 */
export async function exportReportCsv(reportId, params = {}) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const baseUrl = import.meta.env.VITE_API_URL || "";
    const url = new URL(`${baseUrl}/reports/${reportId}/export`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.append(key, String(value));
    });

    const workspaceId = localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
      },
    });

    if (!response.ok) {
      let message = "Export failed";
      try {
        const payload = await response.json();
        message = payload?.message || message;
      } catch {
        // Response wasn't JSON (e.g. plain-text error) — fall back to
        // the generic message above rather than throwing on a second
        // parse failure.
      }
      return { error: { message, status: response.status } };
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] || `${reportId}-report.csv`;

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    return { error: null };
  } catch (error) {
    return { error: { message: error?.message || "Export failed" } };
  }
}
