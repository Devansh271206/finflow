-- ============================================================================
-- Migration 021: Workspace invitations & join-by-link
-- ------------------------------------------------------------------------
-- Sprint: Workspace joining fix (PRD Section 30 "Invitation Management").
--
-- Implements the previously-missing `invitations` table that the PRD has
-- specified since v2.4 but that was never created. Flow:
--   admin creates invitation (email + role + optional department)
--   -> row stored here with a secret token + 7-day expiry
--   -> email delivered via Supabase Auth (admin.inviteUserByEmail) with
--      redirectTo = <frontend>/invite?token=<token>
--   -> invitee opens the link, signs in, POSTs the token to accept
--   -> invitationService.acceptInvitation() creates the `memberships` row
--      and marks this row `accepted`.
--
-- Deliberately mirrors the shape of `memberships` (workspace_id, role_id,
-- department_id, status) so accept is a mechanical insert + status flip.
-- RLS is ENABLED with no policies: the backend exclusively uses the
-- service-role client (which bypasses RLS), so no policy is needed for the
-- API to function — RLS just guarantees the anon/authenticated keys can
-- never read or mutate invitations directly.
--
-- Depends on: workspaces, roles, departments, auth.users (all pre-existing).
-- ============================================================================


CREATE TABLE IF NOT EXISTS public.invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role_id       UUID NOT NULL REFERENCES public.roles(id),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  invited_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled','expired')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspace_email
  ON public.invitations (workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON public.invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_status_expiry
  ON public.invitations (status, expires_at);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.invitations IS
  'Workspace join invitations (PRD Section 30). token is a secret bearer for the join link; accept requires being authenticated as the invited email.';
COMMENT ON COLUMN public.invitations.token IS
  'Cryptographically random bearer token embedded in the invitation link — never logged.';
COMMENT ON COLUMN public.invitations.status IS
  $$'pending' until accepted or expired; 'expired' is set lazily on validation of an overdue token.$$;
COMMENT ON COLUMN public.invitations.expires_at IS
  'Default 7 days from sent_at (invitationService). Expired invitations cannot be accepted.';
