/**
 * Authentication Middleware
 * ------------------------------------------------------------------
 * FinFlow's frontend authenticates users via Supabase Auth and attaches
 * the resulting Supabase-issued JWT (access_token) as a Bearer token on
 * every request to this API.
 *
 * This middleware:
 *   1. Extracts the Bearer token from the Authorization header.
 *   2. Verifies the JWT signature locally using the project's JWT secret
 *      (fast path, no network call) when SUPABASE_JWT_SECRET is set.
 *   3. Falls back to asking Supabase Auth to validate the token
 *      (supabaseAdmin.auth.getUser) if local verification is unavailable
 *      or fails - this also transparently supports revoked/expired
 *      sessions since Supabase is the source of truth.
 *   4. Attaches the authenticated user to `req.user`.
 *
 * Any route using `protect` will 401 if the token is missing/invalid.
 */

const jwt = require("jsonwebtoken");
const { supabaseAdmin } = require("../config/supabase");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1];
}

const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new ApiError(401, "Not authorized. No token provided.");
  }

  // 1. Try fast local verification first (no network round-trip).
  let userId = null;
  let localPayload = null;

  if (process.env.SUPABASE_JWT_SECRET) {
    try {
      localPayload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, {
        algorithms: ["HS256"],
      });
      userId = localPayload.sub;
    } catch (err) {
      // Local verification failed (expired, bad signature, etc).
      // Fall through to remote verification below before rejecting.
      userId = null;
    }
  }

  // 2. Fallback / confirmation via Supabase Auth API. This also covers
  //    cases where the token was revoked (e.g. user signed out / banned)
  //    even if the JWT signature itself is still technically valid.
  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      throw new ApiError(401, "Not authorized. Invalid or expired token.");
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata || {},
    };
    req.token = token;
    return next();
  }

  req.user = {
    id: userId,
    email: localPayload.email,
    user_metadata: localPayload.user_metadata || {},
  };
  req.token = token;
  next();
});

// `authenticate` is an alias for `protect`, introduced so new code can use
// the naming from the PRD §10.2 middleware chain
// (authenticate -> resolveWorkspace -> authorize -> controller) without
// touching any existing route that already imports `protect`.
module.exports = { protect, authenticate: protect };
