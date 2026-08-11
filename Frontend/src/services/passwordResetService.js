import { apiPost } from "../lib/apiClient";

/**
 * Request a password reset link for an account.
 * Backend always returns the same generic message (unknown emails
 * included) to avoid leaking which addresses have accounts.
 */
export async function requestPasswordReset(email) {
  return apiPost("/auth/forgot-password", { email });
}

/**
 * Complete a password reset using the single-use emailed token.
 */
export async function resetPassword(token, password) {
  return apiPost("/auth/reset-password", { token, password });
}
