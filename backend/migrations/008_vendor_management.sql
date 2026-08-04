-- ============================================================================
-- Migration 008: Vendor & Subscription Management
-- ------------------------------------------------------------------------
-- Sprint 3.
--
-- IMPORTANT: PRD §11.7 says "Adopt the existing vendors schema... plus one
-- addition: owner_department_id" — phrased as if a `vendors` table
-- already exists. It does NOT exist anywhere in this repo: no prior
-- migration file defines it, and vendorRepository.js/vendorRoutes.js
-- were both empty stub files before this sprint (vendorController.js was
-- written against a table that was never actually created). This is
-- therefore CREATE TABLE, not ALTER TABLE — building the full shape the
-- PRD describes in one step rather than pretending to extend something
-- that isn't there.
--
-- Column set is exactly what's named across the PRD: is_subscription,
-- billing_cycle, auto_renew, license_count/license_used, last_used_at,
-- functional_tag (§11.7) + owner_department_id (§11.7) + next_billing_date
-- and status (§15's KPI table: "Vendors with next_billing_date within 30
-- days and status not yet reviewed").
--
-- JUDGMENT CALL (not spec'd anywhere): the PRD never enumerates status's
-- valid values, just implies a "reviewed vs not yet reviewed" state.
-- Using ('pending_review', 'reviewed') as the two values — reasonable
-- given the KPI wording, but not something to treat as gospel if a
-- richer workflow turns out to be wanted later.
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  tax_id text,
  is_active boolean NOT NULL DEFAULT true,

  -- Subscription / renewal / ownership fields (PRD §11.7)
  is_subscription boolean NOT NULL DEFAULT false,
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual', 'one_time')),
  auto_renew boolean NOT NULL DEFAULT false,
  license_count integer CHECK (license_count IS NULL OR license_count >= 0),
  license_used integer CHECK (license_used IS NULL OR license_used >= 0),
  last_used_at timestamptz,
  functional_tag text,
  owner_department_id uuid REFERENCES departments(id),
  next_billing_date date,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'reviewed')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Matches vendorController.js's existing findByNameInWorkspace() call —
-- case-insensitive uniqueness per workspace (the controller already does
-- a case-insensitive duplicate check in JS; this index backs it at the
-- DB level too, same defense-in-depth pattern as departments/categories).
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_workspace_name
  ON vendors (workspace_id, lower(name));

-- Supports the Subscriptions filtered view (PRD §15.7: "not a separate
-- table") and the Renewal Risk KPI (next_billing_date within 30 days).
CREATE INDEX IF NOT EXISTS idx_vendors_workspace_subscription
  ON vendors (workspace_id, is_subscription)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_vendors_workspace_next_billing
  ON vendors (workspace_id, next_billing_date)
  WHERE is_active = true AND next_billing_date IS NOT NULL;
