/**
 * Auth Controller
 * ------------------------------------------------------------------
 * FinFlow uses Supabase Auth as its identity provider. Rather than
 * reinventing password hashing / JWT signing, this controller proxies
 * sign up / sign in through Supabase Auth (which issues a standard JWT
 * access token), and exposes a `me` endpoint that relies on our own
 * `protect` middleware to resolve the currently authenticated user.
 *
 * The frontend stores the returned `access_token` and sends it as
 * `Authorization: Bearer <token>` on all subsequent requests.
 */

const { supabaseAdmin, supabaseAuthClient } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const passwordResetService = require("../services/passwordResetService");

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { email, password, fullName } = req.body;

  const { data, error } = await supabaseAuthClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || "" },
      // Ensure the confirmation link in the verification email points at
      // the deployed frontend (env.FRONTEND_URL), not localhost, in
      // production. The origin must be in Supabase's Redirect URLs list.
      emailRedirectTo: `${env.FRONTEND_URL}/login?confirmed=true`,
    },
  });

  if (error) {
    throw new ApiError(error.status || 400, error.message);
  }

  // When the email is ALREADY registered, Supabase returns no session
  // AND no identities, and does NOT send another verification email.
  // Surface that instead of pretending a new email was sent.
  const existingAccount =
    !data?.user || !Array.isArray(data.user.identities) || data.user.identities.length === 0;
  if (existingAccount) {
    throw new ApiError(
      409,
      "An account with this email already exists. Please log in instead."
    );
  }

  // Create a matching profile row so the rest of the API can rely on it existing.
  // email is stored here so membership lookups (findProfileByEmail fallback via
  // profiles table) and the member list UI display have it without an extra auth call.
  if (data?.user) {
    await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      email: data.user.email,
      full_name: fullName || email.split("@")[0],
      currency: "₹",
      theme: "dark",
    });
  }

  return sendSuccess(res, {
    statusCode: 201,
    message:
      data?.session
        ? "Registration successful."
        : "Registration successful. Please check your email to confirm your account.",
    data: {
      user: data?.user || null,
      session: data?.session || null,
    },
  });
});

// @desc    Log in an existing user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new ApiError(401, error.message);
  }

  return sendSuccess(res, {
    message: "Login successful",
    data: {
      user: data.user,
      session: data.session, // contains access_token / refresh_token
    },
  });
});

// @desc    Log out current user (revokes the token on Supabase's side)
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  await supabaseAdmin.auth.admin.signOut(req.token).catch(() => null);
  return sendSuccess(res, { message: "Logged out successfully" });
});

// @desc    Get the currently authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: "Current user fetched successfully",
    data: { user: req.user },
  });
});

// @desc    Refresh an access token using a refresh token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    throw new ApiError(400, "refresh_token is required");
  }

  const { data, error } = await supabaseAuthClient.auth.refreshSession({
    refresh_token,
  });

  if (error) {
    throw new ApiError(401, error.message);
  }

  return sendSuccess(res, {
    message: "Token refreshed successfully",
    data: { session: data.session },
  });
});

// @desc    Request a password reset link (emailed via emailService)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Always returns the same generic message (also for unknown emails)
  // to avoid leaking which addresses have accounts.
  const result = await passwordResetService.requestPasswordReset({
    email,
    frontendUrl: env.FRONTEND_URL,
  });

  return sendSuccess(res, {
    message: "If an account exists for that email, a password reset link has been sent.",
    data: { emailSent: result.emailSent },
  });
});

// @desc    Complete a password reset using a single-use emailed token
// @route   POST /api/auth/reset-password
// @access  Public (token is the secret)
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const result = await passwordResetService.resetPassword({
    token,
    newPassword: password,
  });

  return sendSuccess(res, {
    message: "Your password has been reset. You can now sign in.",
    data: { email: result.email },
  });
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  refreshToken,
  forgotPassword,
  resetPassword,
};
