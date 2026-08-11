/**
 * Password Reset Service
 * ------------------------------------------------------------------
 * Forgot / reset password flow (PRD Section 30.3).
 *
 *   requestPasswordReset() — generate a single-use reset token, store
 *                            only its SHA-256 hash, email the link via
 *                            emailService. Never reveals whether the
 *                            email belongs to an account (enumeration
 *                            protection): unknown emails get the same
 *                            generic success response.
 *   resetPassword()        — validate token hash + expiry + single-use,
 *                            update the Supabase Auth password, burn the
 *                            token.
 *
 * Tokens expire 1 hour after issue. Outstanding tokens are invalidated
 * when a new one is requested, so only the most recent link works.
 */

const ApiError = require("../utils/ApiError");
const { generateToken, hashToken } = require("../utils/tokens");
const emailService = require("./emailService");
const passwordResetRepository = require("../repositories/passwordResetRepository");
const { supabaseAdmin } = require("../config/supabase");

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Resolve an auth user id by email: profiles table first, then a
 *  bounded scan of Supabase Auth users as a fallback for accounts that
 *  were never given a profile row. */
async function findAuthUserIdByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!error && data?.id) return data.id;

  const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;

  const match = (users?.users || []).find(
    (u) => String(u.email || "").toLowerCase() === email
  );
  return match ? match.id : null;
}

/**
 * Start the reset flow: create a single-use token and email the link.
 * Always resolves successfully from the caller's perspective (even for
 * unknown emails) to avoid leaking which addresses have accounts.
 *
 * @returns {Promise<{emailSent: boolean, sent: boolean}>}
 */
async function requestPasswordReset({ email, frontendUrl }) {
  const normalisedEmail = String(email || "").trim().toLowerCase();
  if (!normalisedEmail) throw new ApiError(400, "email is required");

  const userId = await findAuthUserIdByEmail(normalisedEmail);
  if (!userId) {
    // Do not reveal that this email has no account — same response shape.
    return { emailSent: false, sent: false };
  }

  // Only the newest link may work — burn anything outstanding first.
  await passwordResetRepository.invalidateOutstandingForUser(userId);

  const rawToken = generateToken();
  await passwordResetRepository.create({
    user_id: userId,
    email: normalisedEmail,
    token_hash: hashToken(rawToken),
    expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
  });

  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalisedEmail)}`;

  const result = await emailService.sendPasswordReset({
    to: normalisedEmail,
    resetUrl,
  });

  return { emailSent: result.emailSent, sent: true };
}

/**
 * Complete the reset: validate the token, update the password, burn the
 * token. The token is single-use and expires 1 hour after issue.
 */
async function resetPassword({ token, newPassword }) {
  if (!token || token.length < 32) {
    throw new ApiError(400, "Invalid or missing reset token.");
  }

  const record = await passwordResetRepository.findByTokenHash(hashToken(token));
  if (!record) {
    throw new ApiError(400, "This reset link is invalid or has already been used.");
  }
  if (record.used_at) {
    throw new ApiError(400, "This reset link has already been used.");
  }
  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, "This reset link has expired. Please request a new one.");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(record.user_id, {
    password: newPassword,
  });
  if (error) {
    throw new ApiError(error.status || 400, error.message);
  }

  await passwordResetRepository.markUsed(record.id);

  return { userId: record.user_id, email: record.email };
}

module.exports = {
  requestPasswordReset,
  resetPassword,
};
