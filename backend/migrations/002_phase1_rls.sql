-- ============================================================================
-- Migration 002: Phase 1 — Row Level Security (defense-in-depth)
-- ------------------------------------------------------------------------
-- The Express backend uses the Supabase SERVICE ROLE key, which bypasses
-- RLS, and is the PRIMARY enforcement point via authenticate/resolveWorkspace/
-- authorize middleware. These policies are the backstop described in PRD §8:
-- if a query is ever issued without the correct workspace_id filter (bug,
-- future direct-client-access path, etc.), RLS still prevents cross-tenant
-- reads/writes.
--
-- IMPORTANT — bridging clause: existing tables (transactions, budgets,
-- categories, goals, notifications) have `workspace_id` as NULLABLE in
-- Phase 1 (see 001 migration comments). Policies below use
-- `workspace_id is null OR workspace_id in (...)` so that:
--   (a) any row not yet backfilled (shouldn't exist after 001's backfill,
--       but guards against a partial/interrupted migration run), and
--   (b) any legacy code path still filtering by user_id only,
-- do not get locked out mid-migration. Remove the `is null` clause in the
-- Phase 2 cutover migration once workspace_id is NOT NULL everywhere.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------------------
alter table companies enable row level security;

create policy companies_select on companies
for select
using (
  id in (
    select w.company_id from workspaces w
    join memberships m on m.workspace_id = w.id
    where m.user_id = auth.uid() and m.status = 'active'
  )
);

create policy companies_update on companies
for update
using (owner_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- workspaces
-- ----------------------------------------------------------------------------
alter table workspaces enable row level security;

create policy workspaces_select on workspaces
for select
using (
  id in (
    select workspace_id from memberships
    where user_id = auth.uid() and status = 'active'
  )
);

create policy workspaces_insert on workspaces
for insert
with check (
  company_id in (select id from companies where owner_user_id = auth.uid())
);

create policy workspaces_update on workspaces
for update
using (
  id in (
    select m.workspace_id from memberships m
    join roles r on r.id = m.role_id
    where m.user_id = auth.uid() and m.status = 'active' and r.key = 'admin'
  )
);

-- ----------------------------------------------------------------------------
-- departments
-- ----------------------------------------------------------------------------
alter table departments enable row level security;

create policy departments_tenant_isolation on departments
for all
using (
  workspace_id in (
    select workspace_id from memberships
    where user_id = auth.uid() and status = 'active'
  )
);

-- ----------------------------------------------------------------------------
-- memberships
-- ----------------------------------------------------------------------------
alter table memberships enable row level security;

create policy memberships_select on memberships
for select
using (
  workspace_id in (
    select workspace_id from memberships m2
    where m2.user_id = auth.uid() and m2.status = 'active'
  )
);

-- ----------------------------------------------------------------------------
-- roles / permissions / role_permissions — global reference data, readable
-- by any authenticated user, writable by nobody via the client (service
-- role only, i.e. no policy grants insert/update/delete).
-- ----------------------------------------------------------------------------
alter table roles enable row level security;
create policy roles_select on roles for select using (auth.uid() is not null);

alter table permissions enable row level security;
create policy permissions_select on permissions for select using (auth.uid() is not null);

alter table role_permissions enable row level security;
create policy role_permissions_select on role_permissions for select using (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- transactions (bridging policy — see header note)
-- ----------------------------------------------------------------------------
alter table transactions enable row level security;

create policy transactions_tenant_isolation on transactions
for all
using (
  workspace_id is null
  or workspace_id in (
    select workspace_id from memberships
    where user_id = auth.uid() and status = 'active'
  )
);

-- ----------------------------------------------------------------------------
-- budgets
-- ----------------------------------------------------------------------------
alter table budgets enable row level security;

create policy budgets_tenant_isolation on budgets
for all
using (
  workspace_id is null
  or workspace_id in (
    select workspace_id from memberships
    where user_id = auth.uid() and status = 'active'
  )
);

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
alter table categories enable row level security;

create policy categories_tenant_isolation on categories
for all
using (
  workspace_id is null
  or workspace_id in (
    select workspace_id from memberships
    where user_id = auth.uid() and status = 'active'
  )
);

-- ----------------------------------------------------------------------------
-- goals
-- ----------------------------------------------------------------------------
alter table goals enable row level security;

create policy goals_tenant_isolation on goals
for all
using (
  workspace_id is null
  or workspace_id in (
    select workspace_id from memberships
    where user_id = auth.uid() and status = 'active'
  )
);

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
alter table notifications enable row level security;

create policy notifications_tenant_isolation on notifications
for all
using (
  workspace_id is null
  or workspace_id in (
    select workspace_id from memberships
    where user_id = auth.uid() and status = 'active'
  )
);

-- ============================================================================
-- End of Phase 1 RLS. Vendors/Approvals/Revenue/Cost Revamp/Audit tables and
-- their policies are out of scope for this phase per instruction and will
-- ship with their own migrations in a later phase.
-- ============================================================================
