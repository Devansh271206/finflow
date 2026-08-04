-- ============================================================================
-- Migration 006: transactions workspace_id cutover
-- ------------------------------------------------------------------------
-- Sprint 1 — Finance Foundation Completion
--
-- Context: transactions.workspace_id has been nullable since the Phase 1
-- multi-tenant bridging period (see migrations/001_phase1_multitenant.sql,
-- referenced in backend/src/repositories/transactionRepository.js but not
-- present in this repo export — this migration assumes that column
-- already exists and is simply nullable). The application code
-- (transactionRepository.js, dashboardService.js, analyticsService.js)
-- was updated this sprint to require workspace_id unconditionally on
-- every read/write. This migration closes the loop on the database side:
-- backfill, verify, then enforce with a NOT NULL constraint.
--
-- IMPORTANT — this repo has no migrations/ folder and no seed data
-- checked in (001/002/005 are referenced in code comments but not
-- present in this export). Confirm whether that's an export gap or
-- whether migrations have only ever been applied directly against
-- Supabase — either way, this is a reasonable point to start actually
-- tracking migrations in source control going forward.
--
-- Run this against a staging copy first. Review the "rows needing
-- manual review" query below BEFORE running the NOT NULL step — if it
-- returns any rows, STOP and resolve them by hand; do not guess.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: Backfill.
-- ----------------------------------------------------------------------------
-- For every transaction with a null workspace_id, assign the owning
-- user's earliest active workspace membership — the same rule the app
-- already uses today when no X-Workspace-Id header is sent (see
-- membershipRepository.findFirstActiveMembership: ORDER BY joined_at ASC
-- LIMIT 1). This keeps the backfilled data consistent with how these
-- transactions were already being scoped implicitly before this cutover,
-- for the common case of a user with exactly one workspace.
--
-- Users who belong to MULTIPLE active workspaces are backfilled to their
-- oldest membership too, same as the app's existing fallback behavior —
-- but this is exactly the ambiguous case worth spot-checking after the
-- fact (see the review query in Step 2), since a transaction could in
-- theory belong to a different one of their workspaces.

WITH first_active_membership AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    workspace_id
  FROM memberships
  WHERE status = 'active'
  ORDER BY user_id, joined_at ASC
)
UPDATE transactions t
SET workspace_id = fam.workspace_id
FROM first_active_membership fam
WHERE t.user_id = fam.user_id
  AND t.workspace_id IS NULL;


-- ----------------------------------------------------------------------------
-- Step 2: Verification — review BEFORE running Step 3.
-- ----------------------------------------------------------------------------
-- Any rows returned here belong to a user with no active membership in
-- any workspace at all (an orphaned account, or a user who was removed/
-- suspended from their only workspace). These need a manual decision —
-- reassign to a workspace by hand, or confirm it's acceptable to leave
-- them out of scope — not an automatic default.

SELECT
  t.id AS transaction_id,
  t.user_id,
  t.merchant,
  t.amount,
  t.transaction_date
FROM transactions t
WHERE t.workspace_id IS NULL
ORDER BY t.transaction_date DESC;

-- If the query above returns zero rows, proceed to Step 3.
-- If it returns any rows, resolve them first — Step 3 will fail loudly
-- (Postgres rejects SET NOT NULL while nulls remain) rather than
-- silently, but it's better to know why before you get there.


-- ----------------------------------------------------------------------------
-- Step 3: Enforce.
-- ----------------------------------------------------------------------------

ALTER TABLE transactions
  ALTER COLUMN workspace_id SET NOT NULL;


-- ----------------------------------------------------------------------------
-- Step 4: Supporting index.
-- ----------------------------------------------------------------------------
-- budgetRepository.js's attachSpendData() joins budget rows to
-- transactions by (workspace_id, category_id) to compute amount_spent.
-- budgets/categories were already migrated to this scoping in an earlier
-- phase; transactions is only catching up now, so this index didn't
-- make sense to add until this point.

CREATE INDEX IF NOT EXISTS idx_transactions_workspace_category
  ON transactions (workspace_id, category_id);
