-- ============================================================================
-- Migration 022: Secure token storage (hashed) + password reset tokens
-- ------------------------------------------------------------------------
-- Sprint: Auth & multi-tenant hardening.
--
-- 1. invitations.token is currently stored RAW (migration 021). Per the
--    security rule "never store raw invitation/reset tokens", this drops
--    the raw column and stores only a SHA-256 hash (token_hash). The raw
--    token exists only in the email link and the in-memory service call
--    that builds that link — it can never be recovered from the DB.
--    `digest()` comes from pgcrypto, which is enabled by default on
--    Supabase projects.
--
-- 2. New table: password_reset_tokens — same single-use hashed-token
--    model for the forgot/reset-password flow (PRD Section 30.3).
--    RLS is ENABLED with no policies: the backend uses the service-role
--    client (bypasses RLS); anon/authenticated keys can never read or
--    mutate these rows directly.
--
-- Depends on: migrations 021 (invitations table) and existing auth.users.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. invitations: raw token -> hashed token
-- ----------------------------------------------------------------------------

ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Backfill any rows created before this migration (raw -> SHA-256 hash).
-- Guarded so the migration is idempotent: if `token` is already gone
-- (e.g. 022 was partially applied before, or the table never had the
-- column), the backfill is skipped instead of failing on a missing
-- column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'invitations'
       AND column_name = 'token'
  ) THEN
    UPDATE public.invitations
       SET token_hash = encode(digest(token, 'sha256'), 'hex')
     WHERE token_hash IS NULL
       AND token IS NOT NULL;
  END IF;
END $$;

-- Only enforce NOT NULL once every row actually has a hash. If some
-- legacy rows can't be backfilled (no token column to read from), the
-- constraint is skipped rather than failing the whole migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.invitations WHERE token_hash IS NULL
  ) THEN
    ALTER TABLE public.invitations ALTER COLUMN token_hash SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token_hash
  ON public.invitations (token_hash);

DROP INDEX IF EXISTS idx_invitations_token;
ALTER TABLE public.invitations DROP COLUMN IF EXISTS token;

COMMENT ON COLUMN public.invitations.token_hash IS
  'SHA-256 hash of the single-use invitation token. The raw token is never stored — it exists only in the emailed link.';


-- ----------------------------------------------------------------------------
-- 2. password_reset_tokens table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON public.password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
  ON public.password_reset_tokens (expires_at);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.password_reset_tokens IS
  'Single-use password reset tokens (PRD Section 30.3). Only the SHA-256 hash of the token is stored; the raw token lives only in the emailed link. A row is marked used after a successful reset and rejected once past expires_at.';
COMMENT ON COLUMN public.password_reset_tokens.token_hash IS
  'SHA-256 hash of the single-use reset token — never the raw token.';
