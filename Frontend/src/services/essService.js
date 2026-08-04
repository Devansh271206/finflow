import { apiGet } from "../lib/apiClient";

/**
 * Employee Self-Service (ESS) Portal — frontend service.
 * Sprint 13.
 *
 * getMyOverview() hits the new aggregator endpoint for the Overview
 * tab. Every other tab (Leave, Payroll, Expenses, Documents,
 * Notifications, Account Settings) reuses the existing, already-built
 * service modules directly — deliberately NOT re-wrapped here, to
 * avoid a second source of truth for those calls:
 *
 *   - My Leave        -> services/leaveService.js
 *   - My Payroll       -> services/payrollService.js
 *   - My Expenses      -> services/transactionService.js
 *   - My Documents     -> services/employeeDocumentService.js
 *   - Notifications     -> services/notificationService.js
 *   - Account Settings -> services/profileService.js
 *
 * Portal pages should import those directly alongside this module.
 */

/**
 * Fetches the composed Overview payload: profile/employment summary,
 * leave balances + pending request count, latest payslip, and a
 * notification preview. Backed by GET /api/ess/overview.
 *
 * Returns { data, error } like every other service in this app —
 * `data` is null and `error` is populated (e.g. "no employee record
 * linked") if the request fails, so callers can render an empty/error
 * state instead of throwing.
 */
export async function getMyOverview() {
  try {
    const { data, error } = await apiGet("/ess/overview");
    return { data: data ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
}
