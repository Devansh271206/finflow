import { apiGet } from "../lib/apiClient";

/**
 * Sprint 10 — Role-Based Dashboard System.
 *
 * Thin wrapper around GET /api/dashboard/role-summary. Deliberately does
 * NOT reshape or rename anything from the response — roleDashboardService.js
 * (backend) already returns data keyed exactly the way each dashboard
 * page component expects it (organizationOverview, budgetUtilization,
 * leaveBalance, etc.), the same "backend owns the shape" convention
 * leaveService.js already follows for this codebase.
 *
 * `data.role` in the response is the single source of truth for which
 * dashboard variant to render — see Dashboard.jsx, which reads it back
 * from here rather than re-deriving a role from permissions itself.
 */
export async function getRoleDashboard() {
  try {
    const { data, error } = await apiGet("/dashboard/role-summary");

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
