/**
 * Supabase Client Configuration
 * ------------------------------------------------------------------
 * Exposes two Supabase clients:
 *
 *  - supabaseAdmin: initialized with the SERVICE ROLE key. This key
 *    bypasses Row Level Security (RLS) and must NEVER be exposed to
 *    the client / frontend. It is used by the backend for all data
 *    operations after we have already authenticated + authorized the
 *    request via our own middleware (see middleware/authMiddleware.js).
 *
 *  - supabaseAuthClient: initialized with the public ANON key. This is
 *    only used for auth-related helper calls (e.g. verifying a user's
 *    access token via supabase.auth.getUser(token)) which work with
 *    either key, but we keep them separated for clarity of intent.
 * ------------------------------------------------------------------
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Fail fast: the backend cannot function without these.
  // eslint-disable-next-line no-console
  console.error(
    "[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
      "Check your .env file against .env.example."
  );
  process.exit(1);
}

// Admin client - used for all database reads/writes performed by the backend.
// Bypasses RLS, so every query in this codebase MUST manually filter by
// the authenticated user's id (req.user.id) to enforce data isolation.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Lightweight client used only to validate incoming JWTs against Supabase Auth.
const supabaseAuthClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// JWT signing secret used only by authMiddleware.js for fast local token
// verification. Optional (falls back to remote Supabase Auth verification
// when unset), so it is not part of the fail-fast check above.
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || null;

module.exports = { supabaseAdmin, supabaseAuthClient, SUPABASE_JWT_SECRET };