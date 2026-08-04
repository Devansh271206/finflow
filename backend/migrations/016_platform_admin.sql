-- ============================================================================
-- Migration 016: Platform Administration
-- ------------------------------------------------------------------------
-- Adds the two columns Platform Admin v1 needs and nothing else, per this
-- sprint's "essential functionality only, don't over-engineer future
-- releases" instruction:
--
--   1. profiles.is_platform_admin — a Platform Admin is explicitly NOT an
--      employee of any organization and has no workspace membership (see
--      requirePlatformAdminMiddleware.js's header comment for why this
--      can't be modeled as just another role in roles/role_permissions —
--      that whole system is exercised through a workspace membership,
--      which a Platform Admin by definition doesn't have). A single boolean
--      on the existing per-user `profiles` table (already the mirror of
--      auth.users used everywhere else in this codebase — see
--      authController.js's signup upsert) is the minimal correct model for
--      v1. Defaults to false; there is no self-service way to become a
--      Platform Admin — it must be flipped directly in the database by
--      whoever operates this instance, which is the intended v1 workflow
--      (no in-app "grant platform admin" UI is being built this sprint).
--
--   2. companies.status / companies.deleted_at — Platform Admin's
--      Activate/Suspend/Delete organization actions need somewhere to
--      live. `status` drives suspension (companyRepository.js's existing
--      queries, and every workspace/company-scoped read in this codebase,
--      must start filtering on this — see companyRepository.js modify
--      notes). `deleted_at` is a soft delete: PRD-adjacent modules
--      (transactions, payroll, audit trails) reference company_id
--      throughout, so a hard DELETE would cascade destructively or violate
--      FKs; soft delete preserves history while removing the org from
--      every active listing.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.is_platform_admin IS
  'Platform-level administrator of the FinFlow SaaS itself (not an org employee). Set manually by the instance operator — no in-app self-service grant exists in v1.';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE companies
  ADD CONSTRAINT companies_status_check CHECK (status IN ('active', 'suspended'));

COMMENT ON COLUMN companies.status IS
  'active | suspended. Suspended orgs are blocked at resolveWorkspace (their members cannot log into any workspace) but retain all data.';
COMMENT ON COLUMN companies.deleted_at IS
  'Soft-delete timestamp set by Platform Admin. NULL = not deleted. Existing company queries must add a "deleted_at IS NULL" filter — see companyRepository.js modify notes in this sprint.';

-- Fast lookups: Organizations list page filters/sorts by status, and
-- requirePlatformAdminMiddleware.js does a profiles.is_platform_admin
-- point lookup on every platform-admin request.
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_platform_admin ON profiles (id) WHERE is_platform_admin = true;
