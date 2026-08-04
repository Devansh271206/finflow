import { apiPost } from "../lib/apiClient";

/**
 * Frontend API client for /api/onboarding/complete
 * (backend/src/routes/onboardingRoutes.js).
 *
 * Deliberately does NOT wrap Step 2 (Administrator Account) here. The
 * existing AppContext.register() (see context/AppContext.jsx) already
 * calls Supabase's signUp() directly and establishes a client-side
 * session — apiClient's getAuthHeader() reads that same Supabase
 * session automatically, so by the time OnboardingWizard.jsx calls
 * completeOnboarding() below (after Step 2 has run), the request is
 * already authenticated with no extra plumbing needed. This mirrors
 * the backend's own split: auth owns account creation, onboarding owns
 * workspace creation.
 *
 * payload shape (Steps 1 + 3 combined):
 * {
 *   organization_name, industry, company_size, country, currency,
 *   time_zone, financial_year,
 *   working_days, office_hours, weekend_config,
 *   default_leave_policy, default_expense_policy,
 * }
 *
 * Returns { data, error } per apiClient's standard contract. `data` on
 * success is { company, workspace, departments, teamsSeeded,
 * leaveTypesSeeded, categoriesSeeded, organizationSetup } — see
 * onboardingController.js for the exact response shape, including the
 * organizationSetup.persisted: false flag WorkspaceInitStep.jsx should
 * surface to the admin (Step 3 fields are accepted but not yet
 * persisted to a workspace column — see that controller's note).
 */
export async function completeOnboarding(payload) {
  return apiPost("/onboarding/complete", payload);
}
