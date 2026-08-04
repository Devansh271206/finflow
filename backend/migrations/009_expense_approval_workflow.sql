-- ============================================================================
-- Migration 009: Expense Approval Workflow
-- ------------------------------------------------------------------------
-- Sprint 4.
--
-- BREAKING CHANGE, confirmed with product owner before writing this:
-- transactions.approval_status is widened from the narrower 3-value set
-- (pending/approved/rejected) that transactionService.js has shipped
-- with since Sprint 1, to the PRD §15.5 state machine:
--   draft -> submitted -> under_review -> approved -> reimbursed
--   (rejected is a terminal branch, reachable from submitted or
--   under_review)
-- Nothing live depended on the narrower set — transactionService.js's
-- assertApprovableTransition() has had no caller since it was written,
-- flagged as dead scaffolding back in Sprint 1 — so this is safe to
-- widen now rather than needing a second migration later.
--
-- `approvals` and `attachments`: PRD §11.8 lists both as "specified but
-- not yet built (adopt as-is)" with no column list given anywhere in
-- this PRD document — genuinely unspecified, not an oversight on my
-- part. Designed below as reasonable, standard shapes:
--   - approvals: one row per DECISION EVENT (not per transaction), so
--     the full "Submit -> dept lead review -> finance approve ->
--     history" trail the module summary asks for is actually a history,
--     not a single overwritten row.
--   - attachments: multiple files per transaction, replacing the
--     old idea that transactions.receipt_url was the only attachment
--     mechanism. transactions.attachment_count already existed as a
--     column before this migration (visible in transactionRepository's
--     SELECT_COLUMNS) — strong evidence a real attachments table was
--     always intended; this migration is what actually backs it, kept
--     in sync via trigger rather than application code so it can't
--     drift from a missed decrement/increment somewhere.
--
-- NOT decided by me, flagged as an open gap: PRD's RBAC row says Dept
-- Lead can approve "own dept, within limit" but no numeric limit is
-- specified anywhere in this PRD. This migration does NOT add an
-- approval-limit column — inventing a number would be a fabrication,
-- not a spec. Dept Lead scoping below is enforced by department only
-- (a real, well-defined rule); the amount-threshold half of "within
-- limit" is left unenforced and called out again in
-- approvalService.js.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: Widen transactions.approval_status
-- ----------------------------------------------------------------------------
-- Backfill: 'pending' has no equivalent single state in the new machine
-- — it meant "awaiting a decision", which in the new machine could be
-- either 'submitted' (awaiting Dept Lead) or 'under_review' (awaiting
-- Finance). There's no way to recover which from the old data alone.
-- Mapping to 'submitted' (the earlier of the two) is the safer
-- default — it re-enters the workflow one step earlier rather than
-- skipping Dept Lead review entirely. 'approved'/'rejected' are valid
-- in both the old and new enum, so those rows pass through unchanged.
-- Any workspace relying on the old 'pending' meaning specifically
-- should double check these rows after migrating.

UPDATE transactions
SET approval_status = 'submitted'
WHERE approval_status = 'pending';

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_approval_status_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_approval_status_check
  CHECK (approval_status IS NULL OR approval_status IN (
    'draft', 'submitted', 'under_review', 'approved', 'rejected', 'reimbursed'
  ));

ALTER TABLE transactions
  ALTER COLUMN approval_status SET DEFAULT 'draft';


-- ----------------------------------------------------------------------------
-- Step 2: approvals — one row per decision event
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  step text NOT NULL CHECK (step IN ('dept_lead', 'finance')),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_by uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_transaction
  ON approvals (transaction_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- Step 3: attachments — multiple files per transaction
-- ----------------------------------------------------------------------------
-- storage_path (not a URL), same signed-URL-on-read pattern established
-- for employee_documents in Sprint 2 — expense attachments (invoices,
-- receipts) are exactly the kind of thing that shouldn't sit behind a
-- permanent public link either.

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_transaction
  ON attachments (transaction_id);


-- ----------------------------------------------------------------------------
-- Step 4: Trigger — keep transactions.attachment_count in sync
-- ----------------------------------------------------------------------------
-- Application code never writes attachment_count directly — this
-- trigger is the only writer, so the count can't drift from a missed
-- increment/decrement in some code path.

CREATE OR REPLACE FUNCTION attachments_count_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE transactions
    SET attachment_count = COALESCE(attachment_count, 0) + 1
    WHERE id = NEW.transaction_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE transactions
    SET attachment_count = GREATEST(COALESCE(attachment_count, 1) - 1, 0)
    WHERE id = OLD.transaction_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attachments_count ON attachments;
CREATE TRIGGER trg_attachments_count
  AFTER INSERT OR DELETE ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION attachments_count_trigger();


-- ----------------------------------------------------------------------------
-- Manual verification notes (same caveat as migration 007 — no live
-- Postgres connection available in the authoring environment):
--
-- 1. Confirm the backfill: SELECT approval_status, count(*) FROM
--    transactions GROUP BY approval_status; — no 'pending' rows should
--    remain.
-- 2. Insert an attachment row, confirm the parent transaction's
--    attachment_count increments by exactly 1.
-- 3. Delete that attachment row, confirm attachment_count decrements
--    back down (and never goes negative — GREATEST(...,0) guards this).
-- ----------------------------------------------------------------------------
