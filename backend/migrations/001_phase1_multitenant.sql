-- ============================================================================
-- Migration 001: Phase 1 — Multi-tenant foundation
-- ------------------------------------------------------------------------
-- Additive only. Does NOT alter or drop any existing table's existing
-- columns. Existing single-tenant behavior keeps working unchanged
-- throughout and after this migration (new workspace_id columns are
-- nullable). Safe to run against a live database.
--
-- Run order: this file, then 002_phase1_rls.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. companies
-- ----------------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo text,
  industry text,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. workspaces
-- ----------------------------------------------------------------------------
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  unique (company_id, slug)
);

create index if not exists idx_workspaces_company_id on workspaces(company_id);

-- ----------------------------------------------------------------------------
-- 3. departments
-- ----------------------------------------------------------------------------
-- Created ahead of `memberships` (which references it) and ahead of the
-- Vendors/Approvals modules that come in a later phase, since RBAC scoping
-- for dept_lead/employee roles depends on it existing now (PRD §5.2).
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists idx_departments_workspace_id on departments(workspace_id);

-- ----------------------------------------------------------------------------
-- 4. permissions (seed data — resource.action keys)
-- ----------------------------------------------------------------------------
create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

insert into permissions (key, description) values
  ('workspace.read',        'Read workspace settings'),
  ('workspace.update',      'Update workspace settings'),
  ('workspace.transfer',    'Transfer workspace ownership'),
  ('company.manage',        'Manage company profile'),
  ('team.invite',           'Invite / revoke team members'),
  ('departments.manage',    'Create/edit/delete departments'),
  ('departments.read',      'Read department list'),
  ('categories.manage',     'Create/edit/delete categories'),
  ('categories.read',       'Read categories'),
  ('transactions.create',   'Create transactions'),
  ('transactions.read',     'Read transactions'),
  ('transactions.read_all', 'Read transactions across all departments'),
  ('transactions.edit',     'Edit transactions'),
  ('transactions.delete',   'Delete transactions'),
  ('budgets.manage',        'Create/edit budgets'),
  ('budgets.read',          'Read budgets'),
  ('budgets.approve',       'Approve budget requests'),
  ('vendors.manage',        'Create/edit/delete vendors'),
  ('vendors.read',          'Read vendors'),
  ('approvals.act',         'Approve/reject submissions'),
  ('approvals.submit',      'Submit for approval'),
  ('revenue.manage',        'Create/edit/read revenue'),
  ('dashboard.view',        'View dashboard'),
  ('analytics.view',        'View analytics / cost revamp'),
  ('audit.read',            'Read audit logs'),
  ('notifications.manage',  'Manage own notification settings'),
  ('reports.export',        'Export reports')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 5. roles (seed data — system roles)
-- ----------------------------------------------------------------------------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('admin', 'finance_ops', 'dept_lead', 'employee')),
  name text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

insert into roles (key, name) values
  ('admin',       'Founder / Admin'),
  ('finance_ops', 'Finance / Operations'),
  ('dept_lead',   'Department Lead'),
  ('employee',    'Employee')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 6. role_permissions (RBAC matrix — PRD §4)
-- ----------------------------------------------------------------------------
create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- admin: all permissions
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p where r.key = 'admin'
on conflict do nothing;

-- finance_ops: everything except workspace.transfer
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'finance_ops' and p.key <> 'workspace.transfer'
on conflict do nothing;

-- dept_lead: department-scoped set
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'dept_lead' and p.key in (
  'workspace.read', 'departments.read', 'categories.manage', 'categories.read',
  'transactions.create', 'transactions.read', 'transactions.edit', 'transactions.delete',
  'budgets.read', 'vendors.read', 'approvals.act', 'approvals.submit',
  'dashboard.view', 'notifications.manage'
)
on conflict do nothing;

-- employee: minimal set
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'employee' and p.key in (
  'workspace.read', 'departments.read', 'categories.read',
  'transactions.create', 'transactions.read', 'transactions.edit', 'transactions.delete',
  'approvals.submit', 'notifications.manage'
)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 7. memberships
-- ----------------------------------------------------------------------------
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references roles(id),
  department_id uuid references departments(id),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_memberships_workspace_user on memberships(workspace_id, user_id);
create index if not exists idx_memberships_department on memberships(department_id);

-- ----------------------------------------------------------------------------
-- 8. Backfill — "workspace of one" per existing user (PRD §14 step 1)
-- ----------------------------------------------------------------------------
-- Every distinct user_id currently present in transactions/budgets/categories/
-- goals/notifications gets: 1 company + 1 workspace + 1 admin membership.
-- Idempotent: re-running this block will not create duplicates because it
-- only inserts for users who don't already have a membership.
do $$
declare
  admin_role_id uuid;
  u record;
  new_company_id uuid;
  new_workspace_id uuid;
  user_email text;
  base_slug text;
  final_slug text;
  suffix int;
begin
  select id into admin_role_id from roles where key = 'admin';

  for u in (
    select distinct user_id from (
      select user_id from transactions
      union select user_id from budgets
      union select user_id from categories
      union select user_id from goals
      union select user_id from notifications
    ) all_users
    where user_id is not null
      and not exists (
        select 1 from memberships m where m.user_id = all_users.user_id
      )
  )
  loop
    select email into user_email from auth.users where id = u.user_id;
    if user_email is null then
      user_email := 'user-' || u.user_id;
    end if;

    base_slug := lower(regexp_replace(split_part(user_email, '@', 1), '[^a-z0-9]+', '-', 'g'));
    final_slug := base_slug;
    suffix := 1;
    while exists (select 1 from companies where slug = final_slug) loop
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix;
    end loop;

    insert into companies (name, slug, owner_user_id)
      values (split_part(user_email, '@', 1), final_slug, u.user_id)
      returning id into new_company_id;

    insert into workspaces (company_id, name, slug, status)
      values (new_company_id, 'Default', 'default', 'active')
      returning id into new_workspace_id;

    insert into memberships (workspace_id, user_id, role_id, status)
      values (new_workspace_id, u.user_id, admin_role_id, 'active');
  end loop;
end $$;

-- Note: companies.owner_user_id referenced above — add it now (not in the
-- original column list at top since PRD §7.2 includes it; added here so the
-- backfill block above can populate it in the same migration run).
alter table companies add column if not exists owner_user_id uuid references auth.users(id);

-- ----------------------------------------------------------------------------
-- 9. Alter existing tables — add nullable workspace_id (and department_id
--    where relevant). NOT NULL constraint deferred to a Phase 2 cutover
--    migration once the frontend sends X-Workspace-Id on every request and
--    dual-scoping has been verified in production.
-- ----------------------------------------------------------------------------
alter table transactions  add column if not exists workspace_id uuid references workspaces(id);
alter table transactions  add column if not exists department_id uuid references departments(id);
alter table budgets       add column if not exists workspace_id uuid references workspaces(id);
alter table budgets       add column if not exists department_id uuid references departments(id);
alter table categories    add column if not exists workspace_id uuid references workspaces(id);
alter table goals         add column if not exists workspace_id uuid references workspaces(id);
alter table notifications add column if not exists workspace_id uuid references workspaces(id);

create index if not exists idx_transactions_workspace_id on transactions(workspace_id);
create index if not exists idx_budgets_workspace_id on budgets(workspace_id);
create index if not exists idx_categories_workspace_id on categories(workspace_id);
create index if not exists idx_goals_workspace_id on goals(workspace_id);
create index if not exists idx_notifications_workspace_id on notifications(workspace_id);

-- ----------------------------------------------------------------------------
-- 10. Backfill workspace_id on existing rows from the new 1:1 mapping
-- ----------------------------------------------------------------------------
update transactions t
  set workspace_id = m.workspace_id
  from memberships m
  where t.user_id = m.user_id and t.workspace_id is null;

update budgets b
  set workspace_id = m.workspace_id
  from memberships m
  where b.user_id = m.user_id and b.workspace_id is null;

update categories c
  set workspace_id = m.workspace_id
  from memberships m
  where c.user_id = m.user_id and c.workspace_id is null;

update goals g
  set workspace_id = m.workspace_id
  from memberships m
  where g.user_id = m.user_id and g.workspace_id is null;

update notifications n
  set workspace_id = m.workspace_id
  from memberships m
  where n.user_id = m.user_id and n.workspace_id is null;

-- ----------------------------------------------------------------------------
-- Verification queries (run manually before/after in production, per the
-- PRD §14.6 rollout pattern — not part of the automated migration):
--
--   select count(*) from transactions where workspace_id is null;   -- expect 0 (or only rows with no user_id)
--   select count(*) from memberships;                                -- expect 1 per distinct pre-migration user
--   select count(*) from companies;                                  -- expect 1 per distinct pre-migration user
-- ----------------------------------------------------------------------------
