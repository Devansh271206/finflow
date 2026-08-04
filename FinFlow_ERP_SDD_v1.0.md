# FinFlow ERP — Software Design Document v1.0

**Status:** v1.0 — Engineering Handover
**Owner:** Platform Engineering
**Last Updated:** July 30, 2026
**Based On:** FinFlow ERP PRD v2.4 (companion document — this SDD does not redefine product requirements; it explains implementation)
**Audience:** Engineering (Frontend, Backend, DevOps, QA), Security, Technical Diligence Readers

---

## 1. Introduction

### 1.1 Purpose
This document specifies **how** FinFlow ERP is implemented: architecture, technology choices, module internals, data flow, and operational design. Every requirement here traces back to a PRD v2.4 section — where this document makes an implementation decision not explicit in the PRD (e.g. a specific caching TTL, a specific retry count), that decision is called out explicitly in Section 18 (Engineering Decisions) with rationale.

### 1.2 Scope
Covers the full FinFlow ERP platform: all ~30 modules (PRD Section 15, 28–43), the 13 shared platform services (PRD Section 46), the event-driven architecture (PRD Section 47), and the cross-cutting engineering/security/DevOps concerns (PRD Sections 44–45). Out of scope: infrastructure-as-code specifics beyond what's needed to understand deployment topology (owned by a separate runbook), and third-party integration API references (owned by each integration's own doc, linked from Section 10).

### 1.3 Audience
Backend engineers implementing services/repositories; frontend engineers implementing the React application; DevOps engineers owning CI/CD and infrastructure; Security reviewing the threat model; QA building the test suite; technical diligence readers assessing engineering maturity.

### 1.4 Definitions
- **Workspace** — the tenant boundary; one workspace = one organization (PRD Section 4).
- **Service Layer** — the business-logic layer between controllers and repositories (Section 4 below).
- **Event Bus** — internal pub/sub backbone (PRD 46.13, SDD Section 9).
- **RLS** — Postgres Row-Level Security, the DB-layer tenant isolation mechanism.

### 1.5 References
FinFlow ERP PRD v2.4 (companion document, all section numbers referenced below are PRD section numbers unless prefixed "SDD"). OWASP ASVS (Section 11 security baseline). Postgres RLS documentation. Supabase Auth/Storage documentation.

---

## 2. High-Level Architecture

### 2.1 Architecture Diagram (described)
```
┌─────────────────────────────────────────────────────────────┐
│  Client (React SPA, Vite build)                              │
│  Vercel-hosted static assets + client-side routing            │
└───────────────────────────┬────────────────────────────────┘
                             │ HTTPS / JSON (REST, /api/v1)
┌───────────────────────────▼────────────────────────────────┐
│  API Layer (Node/Express, Railway-hosted)                    │
│  routes → middleware (auth, authz, validate, rateLimit)       │
│         → controllers → services → repositories               │
├────────────────────────────────────────────────────────────┤
│  Shared Platform Services (in-process modules, PRD §46)       │
│  Auth · Authz · Workflow · Approval · Notification · Audit    │
│  Search · Analytics · AI · Integration · Billing · Storage    │
│  Event Bus (EventEmitter → Redis Streams upgrade path)        │
├────────────────────────────────────────────────────────────┤
│  Background Workers (BullMQ on Redis)                        │
│  Imports · Digests · Retention sweeps · BI computation         │
│  Webhook delivery · Email delivery                             │
└───────────────────────────┬────────────────────────────────┘
                             │
┌───────────────────────────▼────────────────────────────────┐
│  Data Layer                                                   │
│  Supabase Postgres (RLS-enforced multi-tenancy)                │
│  Supabase Storage (files, signed URLs)                        │
│  Supabase Auth (identity provider, wrapped by Auth Service)    │
│  Redis (cache + queue backing store)                          │
└────────────────────────────────────────────────────────────┘
        │                                                    │
        ▼                                                    ▼
┌───────────────┐                                  ┌──────────────────┐
│ External APIs  │                                  │ Webhooks / Public │
│ Slack, Teams,   │                                  │ API consumers     │
│ QuickBooks, etc │                                  │                    │
└───────────────┘                                  └──────────────────┘
```

### 2.2 Technology Stack
| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18, Vite, Tailwind CSS | Fast dev loop, existing team expertise (PRD Section 14 baseline), no need to introduce a meta-framework for an authenticated SPA |
| Frontend State | React Query (server state) + Zustand (UI state) | Separates cache/sync concerns (server state) from ephemeral UI state — avoids over-using a single global store for both |
| Backend | Node.js, Express | Existing baseline (PRD Section 14), mature ecosystem for REST APIs |
| Database | Postgres via Supabase | RLS gives tenant isolation at the DB layer, not just application layer — defense in depth for multi-tenancy |
| Auth | Supabase Auth (wrapped by Auth Service, PRD 46.1) | Avoids building auth from scratch; wrapping keeps the provider swappable |
| Cache/Queue | Redis (BullMQ) | Single piece of infrastructure serves both caching (PRD Section 44) and background job queueing |
| File Storage | Supabase Storage | Same provider as DB/Auth, signed URLs supported natively |
| Hosting | Vercel (frontend), Railway (API + workers) | Static frontend and stateful API have different scaling/deployment needs; splitting hosting matches that |
| CI/CD | GitHub Actions | Standard, integrates with both Vercel and Railway deploy hooks |

### 2.3 Component Diagram (described)
The API layer is organized by module (one route file, one controller, one service, one repository set per module — e.g. `employees.routes.js → employees.controller.js → employees.service.js → employees.repository.js`), with the 13 shared services (PRD §46) as a separate `services/platform/` directory that module services import from, never the reverse — shared services never depend on module-specific code, keeping the dependency graph acyclic.

### 2.4 Deployment Diagram (described)
Three environments (Development, Staging, Production — SDD Section 15), each with its own Supabase project (full data isolation between environments, not just RLS-based tenant isolation within one). Railway hosts the API as a single deployable service initially (PRD Section 17 covers the future microservices split) plus a separate Railway service for the BullMQ worker process, so long-running jobs don't compete with request-handling for the same process's event loop.

### 2.5 System Context Diagram (described)
FinFlow sits between: (a) end users (Organization Admins, Org Members, Platform Super Admin) via the React SPA; (b) external systems via Integration Service adapters (Slack, Teams, Google Workspace, GitHub, Jira, QuickBooks, Outlook) and the Public API; (c) Supabase as the managed data/auth/storage substrate. No other system writes to FinFlow's database directly — all external interaction goes through the API layer, preserving the validation/authorization/audit guarantees described in PRD Sections 45–46 for every write, regardless of source.

---

## 3. Frontend Design

### 3.1 React Architecture
Single-page application, client-side routed, talking to the `/api/v1` REST API. No server-side rendering — FinFlow is an authenticated internal tool, not a public content site, so SSR's SEO/first-paint benefits don't apply and would add deployment complexity for no gain.

### 3.2 Folder Structure
```
src/
  app/                — app shell, providers, router config
  modules/            — one folder per module, mirrors backend module boundaries
    employees/
      components/
      hooks/          — React Query hooks (useEmployees, useCreateEmployee, ...)
      pages/
      types.ts
    payroll/
    expenses/
    ... (one per PRD-15.x / 28-43 module)
  shared/
    components/       — design-system primitives (Button, Table, Modal, ...)
    hooks/             — useAuth, usePermission (wraps Authorization Service calls), useDebounce, ...
    lib/                — apiClient, queryClient config
  styles/
```
Rationale: mirroring backend module boundaries in the frontend keeps "where does X live" answerable the same way on both sides, and keeps module ownership clear as the team grows.

### 3.3 Routing
React Router, route tree generated per-role at login by combining the static route config with the Authorization Service's `getPermissions` result (PRD 46.2) — routes for modules/actions the user can't access are not just hidden but not registered, so there's no client-side route that renders a 403 for a route the nav never showed (matches PRD Section 19's "hide rather than disable" principle, extended here to routing, not just navigation).

### 3.4 State Management
- **Server state** (anything from the API): React Query. Cache keys mirror API resource paths (`['employees', workspaceId]`). Invalidation triggered by mutation success and, for cross-user-visible data, by a lightweight polling/SSE layer subscribing to the same Event Bus categories relevant to that view (e.g. the Approvals inbox invalidates on `approval_requests` changes).
- **UI state** (modal open/closed, selected filters, wizard step): Zustand, scoped per feature, not global — avoids a single store becoming a dumping ground.

### 3.5 Authentication Flow
1. Login form submits credentials → Auth Service (46.1) via `/api/v1/auth/login`.
2. Access token (short-lived, ~15 min) stored in memory (not localStorage — XSS mitigation, PRD Section 45.3/SDD Section 11); refresh token in an HttpOnly, Secure, SameSite=Strict cookie (not accessible to JS at all).
3. React Query's request layer attaches the access token; on 401, a single in-flight refresh call obtains a new access token before retrying the original request (request queue during refresh to avoid a refresh stampede on concurrent 401s).
4. Logout clears in-memory token and calls `/api/v1/auth/logout` to invalidate the refresh token server-side.

### 3.6 Protected Routes
A `RequireAuth` wrapper checks for a valid in-memory access token (or a successful silent-refresh attempt on app load) before rendering; a `RequirePermission` wrapper (built on `usePermission`, wrapping Authorization Service) gates individual routes/actions beyond plain authentication.

### 3.7 Component Hierarchy
`App → AuthProvider → RoleAwareLayout (sidebar per PRD Section 19) → ModuleRoutes → Page (list/detail per PRD Section 45.3) → Feature Components → Design-System Primitives`.

### 3.8 Reusable Components
Design-system primitives (Table with built-in pagination/filter/sort per PRD 45.3, Modal, ConfirmDialog for delete actions per PRD Section 35, EmptyState, SkeletonLoader, ErrorState) live in `shared/components/` and are used identically across all ~30 modules — this is what makes PRD 45.3's "every module has the same list/detail/empty/loading/error pattern" achievable without each module reinventing it.

### 3.9 Theme
Tailwind config drives a token-based theme (colors, spacing, typography) supporting the Organization Branding requirement (PRD Section 32) — brand color overrides apply as CSS custom properties layered over the Tailwind base tokens, not by regenerating Tailwind config per tenant at build time (which wouldn't scale to multi-tenant runtime theming).

### 3.10 Responsive Design
Mobile-first Tailwind breakpoints; WCAG 2.1 AA target (PRD Section 10/45.3) verified via automated accessibility linting in CI (axe-core) plus manual review for complex interactive components (approval workflow builder, dashboard customization).

---

## 4. Backend Design

### 4.1 Express Architecture
Layered: `routes → middleware → controllers → services → repositories`, unchanged from the PRD's existing baseline (Section 14) — this SDD section makes explicit what each layer is and is not responsible for, since that boundary is where most real-world violations creep in.

### 4.2 Folder Structure
```
src/
  modules/
    employees/
      employees.routes.js
      employees.controller.js
      employees.service.js
      employees.repository.js
      employees.validation.js   — Joi/Zod schemas
    ... (one per module)
  services/
    platform/           — the 13 shared services, PRD §46
      auth.service.js
      authorization.service.js
      workflow.service.js
      approval.service.js
      notification.service.js
      audit.service.js
      search.service.js
      analytics.service.js
      ai.service.js
      integration.service.js
      billing.service.js
      storage.service.js
      eventBus.js
  middleware/
    authenticate.js
    authorize.js
    validateRequest.js
    rateLimit.js
    errorHandler.js
  jobs/                  — BullMQ job definitions (imports, digests, retention sweeps)
  db/
    migrations/
    repositories/base.repository.js  — shared query helpers (pagination, soft-delete filtering)
```

### 4.3 Controllers
Thin — parse/shape the request, call exactly one service method, shape the response. No business logic, no direct repository calls. A controller that needs data from two services calls both and composes the response; it does not reach into a repository to "just get one field."

### 4.4 Services
Own business logic: validation beyond schema shape (e.g. "budget amount must be positive" is schema-level; "this expense would exceed the department's remaining budget" is service-level, PRD 49.2), orchestration across repositories, and publishing events to the Event Bus after a successful write. Services are the only layer permitted to call other services (module services call shared platform services; shared platform services never call module services, per Section 2.3's acyclic rule).

### 4.5 Repositories
Own data access only — no business logic. Every repository extends `base.repository.js` for shared concerns: pagination (`?page=&limit=`, PRD 45.2), soft-delete filtering (queries exclude `deleted_at IS NOT NULL` rows by default, PRD Section 35), and workspace scoping (every query is automatically scoped to `workspace_id` from the authenticated request context — this is the application-layer half of tenant isolation, with Postgres RLS as the defense-in-depth second layer, SDD Section 11).

### 4.6 Middleware
`authenticate` (validates access token via Auth Service, 46.1, attaches `req.user`), `authorize` (checks permission via Authorization Service, 46.2, before the controller runs), `validateRequest` (schema validation, rejects malformed requests before they reach business logic), `rateLimit` (per PRD Section 44, distinct limits for standard CRUD vs. Public API vs. bulk-import endpoints), `errorHandler` (final middleware, converts thrown errors into the consistent error envelope, PRD Section 10).

### 4.7 Validation
Request body/query/params validated via schema (Zod) in `validateRequest`, co-located per module in `*.validation.js`. Schema-level validation (types, required fields, formats) is separated from service-level business-rule validation (Section 4.4) — this split means a validation schema change doesn't require touching business logic and vice versa.

### 4.8 Error Handling
All thrown errors extend a base `AppError` class carrying an HTTP status and a machine-readable error code; the `errorHandler` middleware is the single place that formats the response envelope, so every endpoint returns errors in the same shape without each controller reimplementing formatting.

### 4.9 Dependency Injection Strategy
Lightweight, constructor-based (no DI framework/container) — each service receives its repository and any platform services it needs as constructor arguments, instantiated once in a composition-root module (`src/container.js`) at app startup. This makes unit testing straightforward (inject mocks) without the overhead of a full DI framework for a codebase this size; revisit if module count grows significantly (see Section 17).

---

## 5. Database Design

### 5.1 Complete ER Diagram (described)
Organized around `workspaces` as the tenant root; every tenant-owned table carries a `workspace_id` foreign key (PRD Section 45.1). Core entity clusters:
- **People**: `workspaces → departments → teams → employees`, with `team_members` and `employee_departments` as join tables where needed.
- **Finance**: `budgets → expenses → approval_requests`, `payroll_runs → payroll_records`.
- **Operations**: `vendors → subscriptions (+ subscription_cost_history) `, `vendors → purchase_requests → purchase_orders → invoices`, `assets → asset_assignments`.
- **Platform**: `audit_logs`, `notifications`, `documents`, `activity_feed` (view/materialized subset of `audit_logs`), `webhook_subscriptions`, `system_status`/`incidents`.
- **Identity/RBAC**: `users` (Supabase Auth-owned), `user_workspace_roles`, `roles`, `role_permissions`.

Full column-level ERD is maintained as a generated artifact (via `prisma-erd-generator` or equivalent, run in CI against the migration history) rather than hand-maintained in this document, to avoid drift between the diagram and the actual schema — the migration history in `db/migrations/` is the single source of truth.

### 5.2 Relationships
Every relationship is one of three explicit kinds, chosen per PRD Section 45.1:
1. **Strictly-owned child** → `ON DELETE CASCADE` (e.g. `asset_assignments.asset_id → assets.id`; `approval_decisions.approval_request_id → approval_requests.id`).
2. **Referenced-but-independent** → `ON DELETE RESTRICT` or nullable FK (e.g. `assets.vendor_id → vendors.id` — deleting a vendor must not cascade-delete assets; `purchase_orders.vendor_id` similarly restrict).
3. **Blocked-if-in-use** → application-layer check before allowing delete, enforced in the service layer, not just the DB constraint (e.g. deleting a `department` with active `employees`, deleting a `role` with assigned users — PRD 49.1) — RESTRICT alone would surface a raw DB error to the user; the service layer check gives a specific, actionable error message instead.

### 5.3 Indexes
Baseline (every table): index on `workspace_id`; index on every foreign key; index on every status/state-machine column used in filtering (PRD Section 45.1). Module-specific indexes are enumerated per-module in PRD Section 49 (e.g. `employees (workspace_id, department_id)`, `assets (warranty_expiry_date)`) and are implemented as explicit migration statements, not left to be inferred — each index has a comment in its migration file citing the PRD section that motivates it, so future engineers can tell which indexes are load-bearing for a specific query pattern vs. speculative.

### 5.4 Constraints
Check constraints on every enum-like status column (e.g. `approval_status IN ('pending','approved','rejected')`); not-null constraints on every required relationship; unique constraints where the PRD specifies uniqueness (e.g. `workspaces.slug`, `team_members (team_id, employee_id)`). All state machines (payroll run status, approval status, procurement matched_status) are implemented as Postgres enums or check-constrained text columns — enums preferred where the value set is genuinely closed and rarely changes; check-constrained text preferred where new statuses might be added without a schema migration (e.g. integration connection statuses, which may grow as new integrations are added).

### 5.5 Migration Strategy
Sequential, timestamped SQL migration files (Supabase CLI migration format) checked into `db/migrations/`, applied in CI before deploy and never edited after being merged to main (a bad migration is fixed with a new forward migration, never by rewriting history) — this is the standard safe pattern for any team with more than one engineer touching the schema, and it's what makes the "single source of truth" claim in 5.1 actually true over time.

---

## 6. API Design

### 6.1 Conventions
REST, versioned under `/api/v1` (PRD Section 10), resource-oriented paths (`/employees`, `/employees/:id`, `/departments/:id/employees`). Every list endpoint supports `?page=&limit=` (pagination), `?field=value` (filtering), `?sort=field:asc|desc` (sorting), and where applicable a `?q=` search parameter delegating to Search Service (PRD 46.7) — this is the API-layer expression of PRD Section 45.2's standard, applied uniformly rather than per-module.

### 6.2 Request/Response Models
Every endpoint's request body is validated against its Zod schema (Section 4.7) before reaching the controller. Response envelope is consistent:
```json
// Success
{ "data": {...} or [...], "meta": { "page": 1, "limit": 20, "total": 143 } }
// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```
This single envelope shape (PRD Section 10) means frontend API-handling code (Section 3.4/3.6) doesn't need per-endpoint special-casing for error shape.

### 6.3 Authentication & Authorization (per-endpoint)
Every protected endpoint runs `authenticate` then `authorize(action, resource)` middleware (Section 4.6) before the controller executes — authorization is declared at the route level (e.g. `router.post('/employees', authorize('create', 'employee'), ...)`), making the permission required for each endpoint auditable by reading the route file, not buried inside controller logic.

### 6.4 Error Codes
Standardized machine-readable codes (`VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`) mapped 1:1 to HTTP status codes (400, 404, 403, 409, 429, 500) — the frontend's error-handling layer (Section 3) switches on `error.code`, not on parsing `error.message` strings, so error-message copy can change without breaking frontend logic.

### 6.5 Endpoint Inventory
Full per-endpoint request/response documentation (every module's complete endpoint list) is generated from the Zod schemas + route definitions into an OpenAPI spec (`openapi.json`, generated in CI, served at `/api/v1/docs`) rather than hand-maintained in this document — this avoids the single most common source of PRD/SDD drift (an endpoint doc that no longer matches the actual route). The generation script and its CI check (fails the build if `openapi.json` is stale relative to route definitions) are themselves a Section 18 engineering decision, detailed there.

---

## 7. Authentication & Authorization

### 7.1 JWT Flow
Supabase Auth issues JWTs (access + refresh) on login; Auth Service (PRD 46.1) wraps this so the rest of the app depends on `authService.authenticate()`, not the Supabase SDK directly. Access token: 15-minute expiry, contains `sub` (user id), `workspace_id` claims are **not** embedded in the JWT (a user can belong to multiple workspaces — the active workspace is resolved per-request from an `X-Workspace-Id` header or route param, validated against the user's actual workspace memberships on every request, never trusted from the token alone).

### 7.2 Refresh Tokens
Rotating refresh tokens (each use issues a new refresh token and invalidates the old one) stored in an HttpOnly cookie (Section 3.5). Reuse of an already-rotated refresh token triggers revocation of the entire token family (PRD 46.1 edge case) — this is the standard mitigation for refresh-token theft/replay.

### 7.3 RBAC
Three-tier hierarchy (PRD Section 5A/13): Platform Super Admin (platform-level, not workspace-scoped) → Organization Admin (workspace-scoped, full authority within their workspace) → Org Member (workspace-scoped, permission set per assigned role). Custom roles (`roles` table) let an Organization Admin define permission sets beyond the built-in ones, each row in `role_permissions` mapping a role to a specific `(action, resource)` pair.

### 7.4 Permission Resolution
`Authorization Service.can(userId, action, resource)` (PRD 46.2): resolves the user's role(s) in the request's active workspace, unions the permissions granted by those roles, checks for the requested `(action, resource)` pair. Result cached in Redis keyed `perm:{userId}:{workspaceId}`, TTL 5 minutes, **explicitly invalidated** (not just left to expire) on role change, workspace removal, or permission-set edit — the cache is a performance optimization, not a source of eventual-consistency risk for security-sensitive checks, because every mutation path that could change a permission calls the invalidation function directly rather than relying on TTL alone.

### 7.5 Supabase Auth
Used purely as the identity provider (credential storage, password hashing, email verification/reset token generation) — FinFlow's own `users`/`user_workspace_roles` tables own the workspace-membership and role data, kept in sync via Supabase Auth webhooks (e.g. `user.created` triggers creation of the corresponding FinFlow-side user record). This split (identity vs. authorization data) is what keeps Section 7.1's provider-swappable design honest — swapping Supabase Auth for another provider would touch Auth Service and the sync webhook, not the RBAC model.

---
## 8. Module Design

Every module follows the same internal shape (Section 4.2–4.5): `routes → controller → service → repository`, publishing events (Section 9) after successful writes, and calling shared platform services (Section 10) rather than reimplementing cross-cutting concerns. Rather than repeat that boilerplate ~30 times, this section documents each module's **module-specific** internal architecture, data flow, and event participation — the part that differs from the shared template.

### 8.1 Employees
**Responsibilities:** CRUD, employment status lifecycle (onboarding → active → terminated), department/team assignment.
**Internal architecture:** `employees.service.js` orchestrates writes across the `employees` repository and, on termination, calls Asset Service (return checklist), Payroll Service (final pay calculation trigger), and Team Service (membership cleanup) — via events (Section 9), not direct service-to-service calls, so Employees doesn't need compile-time knowledge of every module that cares about terminations.
**Data flow:** Create/update → validate (schema + business rules, e.g. duplicate email check per PRD 49.1) → write → publish `employee.created`/`.updated`/`.terminated` → Audit/Notification/Analytics/Webhooks consume independently.
**Events published:** `employee.created`, `.updated`, `.terminated`.
**Events consumed:** none (Employees is a pure producer for these lifecycle events; it consumes `department.archived` to null out `department_id` on affected employees rather than leaving a dangling reference).

### 8.2 Departments
**Internal architecture:** Straightforward CRUD service; delete path calls `employees.repository.countByDepartment()` before allowing deletion (PRD 49.1 blocked-if-in-use pattern, Section 5.2).
**Events published:** `department.created`, `.updated`, `.archived`.

### 8.3 Teams
**Internal architecture:** `teams.service.js` owns membership changes (`team_members` join table) distinctly from team metadata changes, since PRD 49.1 requires notifying on Team Lead removal — a dedicated `reassignLead()` service method (not a generic `update()`) makes that trigger explicit and testable in isolation.
**Events published:** `team.created`, `.member_added`, `.member_removed`, `.lead_changed`.

### 8.4 Payroll
**Internal architecture:** `payroll.service.js` implements the run as an explicit state machine (`pending → processing → completed | failed`, PRD 49.1 NFR) executed as a Background Job (Section 44/12), not inline in a request — payroll runs can process hundreds of employee records and must not block the request/response cycle or risk a timeout mid-run. The job is idempotent by checking `payroll_runs.status` before any payment-triggering write, so a retried job after a crash does not double-pay.
**Data flow:** Trigger run → job enqueued → job reads all active employees at period-start department assignment (PRD 49.1 edge case) → computes gross/deductions/net per employee → writes `payroll_records` → submits to Approval Service (46.4) → on approval, `payroll.approved` event → payment execution (integration-dependent, out of SDD scope beyond the event trigger) → `payroll.run_completed`.
**Events published:** `payroll.run_started`, `.run_completed`, `.run_failed`, `.approved`.

### 8.5 Budgets & Expense Workflow
**Internal architecture:** `expenses.service.js` submission path re-reads `budgets.amount_spent` at approval-decision time, not submission time (PRD 49.2 race-condition edge case) — implemented as a row-level lock (`SELECT ... FOR UPDATE`) on the budget row during the approval-decision transaction, so two concurrent approvals against the same budget serialize correctly rather than both reading stale `amount_spent`.
**Events published:** `expense.submitted`, `.approved`, `.rejected`; `budget.threshold_reached`, `.exceeded` (published by a budget-recalculation step that runs inside the same transaction as the expense approval, not as a separate async check that could race).

### 8.6 Leave
**Internal architecture:** Overlap validation (PRD 49.2) implemented as a repository-level query checking for any existing `pending`/`approved` leave request for the same employee with overlapping date ranges, run inside the same transaction as request creation.
**Events published:** `leave.requested`, `.approved`, `.rejected`, `.cancelled`.

### 8.7 Vendor Management, Subscription Management, Asset Management, Procurement
These four share the `vendors` table (PRD 49.2 confirms no duplication) and are implemented as separate services/repositories that all reference `vendors.repository.js` for read access, with only Vendor Management owning writes to the `vendors` table itself — Subscription, Asset, and Procurement each own their own tables (`subscriptions`, `assets`, `purchase_requests`/`purchase_orders`) with a `vendor_id` foreign key (Section 5.2, referenced-but-independent, RESTRICT on delete).
**Procurement-specific:** three-way-match logic (PRD 49.3) lives in `procurement.service.js` as a dedicated `reconcileInvoice()` method comparing PO amount to invoice amount and setting `matched_status` accordingly — this runs synchronously on invoice recording (low volume, no need for a background job here unlike Payroll).
**Events published:** `vendor.created`, `.contract_expiring/.expired`; `subscription.renewal_upcoming/.renewed/.cancelled`; `asset.assigned/.returned/.maintenance_due/.lost`; `procurement.requested/.approved/.po_issued/.invoiced/.paid`.

### 8.8 Document Center
**Internal architecture:** `documents.service.js` delegates actual file bytes to Storage Service (46.12/Section 10.6 below); the `documents` table stores metadata + a pointer to the Storage Service object, never file bytes in Postgres. Versioning implemented as one `documents` row per version, grouped by a shared `document_group_id`, with a `is_current_version` flag — chosen over overwriting a single row so version history (PRD Section 41) is a plain query, not a separate audit-log reconstruction.
**Events published:** `document.uploaded`, `.version_created`, `.expiring`, `.deleted`.

### 8.9 Invitation Management, Organization Settings, Platform Administration, Billing, Security Center, Activity Feed
These are thinner services, mostly orchestrating shared platform services (Auth, Billing, Audit) rather than owning complex domain logic of their own — documented in Section 10 (Shared Platform Services) rather than repeated here, per that section's role as the canonical spec for cross-cutting behavior.

### 8.10 Approval Engine & Workflow Engine
Implemented as `approval.service.js` and `workflow.service.js` respectively, matching PRD 46.3/46.4 exactly — see Section 10.3/10.4 below for full interface detail, since these are themselves shared platform services, not single-purpose modules.

### 8.11 Search, Analytics, BI, AI, Dashboards, Notifications, Reports
Each is a thin controller/service layer over the corresponding shared platform service (Search Service 46.7, Analytics Service 46.8, AI Service 46.9, Notification Service 46.5) — module-specific work here is mostly about *which* fields are indexed/searchable (declared per-module, Section 5.3) and *which* metrics each dashboard widget requests (declared per dashboard component in the frontend, Section 3.8), not separate backend architecture.

---

## 9. Event Architecture

### 9.1 Events
The full catalog is PRD Section 47 — this section covers implementation, not the event list itself.

### 9.2 Publishers
Any service method that performs a state-changing write publishes its event(s) as the **last step** of a successful transaction (after commit, not before — publishing before commit risks a subscriber acting on data that then fails to actually persist if the transaction rolls back). Implemented via a `withTransaction(fn)` helper that runs `fn`, commits, then flushes any events queued during `fn` via `eventBus.publish()` — this pattern is enforced by a lint rule flagging direct `eventBus.publish()` calls outside the helper.

### 9.3 Subscribers
Each shared platform service subscribes independently in its own module init (e.g. `auditService.js` calls `eventBus.subscribe('*', auditService.record)` — a wildcard subscription, since Audit Service cares about every event; `notificationService.js` subscribes to a specific allowlist of event types that map to user-facing notifications). Subscriber handlers are wrapped so a thrown error is caught and logged (Section 16) rather than propagating — per PRD 46.13's NFR, one failing subscriber must not block others or the publisher.

### 9.4 Retry
Failed subscriber handlers (e.g. a webhook delivery failure inside Integration Service's subscriber) are retried via BullMQ with exponential backoff (base 1s, max 5 retries, PRD Section 44) — the retry is scoped to that specific subscriber's handling of that specific event, not a re-publish of the event to all subscribers again.

### 9.5 Dead Letter Queue
After max retries, the failed job moves to a BullMQ dead-letter queue, surfaced in System Status (PRD Section 43) as a degraded integration (per PRD 49.4's edge case) and alertable via the monitoring stack (Section 16).

### 9.6 Future Kafka Support
The `eventBus.publish/subscribe` interface (PRD 46.13) is the abstraction boundary — current implementation is Node's `EventEmitter` for a single-instance deployment. When horizontal scaling (Section 17) requires cross-instance event delivery, the implementation swaps to Redis Streams (already-provisioned Redis, minimal new infra) or Kafka (if event volume/replay requirements grow beyond what Streams comfortably handles) behind the same interface — no publisher or subscriber code changes, only `eventBus.js`'s internals.

---

## 10. Shared Platform Services

Implementation detail for the 13 services specified functionally in PRD Section 46. Each is a singleton instantiated in `container.js` (Section 4.9) and injected into module services that depend on it.

### 10.1 Notification Service
Subscribes to an explicit allowlist of Event Bus event types (not wildcard — unlike Audit Service, not every event is user-facing). For each, resolves the notification's recipient(s) (e.g. `expense.submitted` → the requester's manager, resolved via Authorization Service's role data), checks the recipient's notification preferences (PRD Section 31) before enqueueing, and checks authorization at delivery time (PRD 46.5 edge case) via a re-check against Authorization Service immediately before the in-app notification is written or the email is sent — closing the gap where a user's access could have been revoked between event trigger and delivery.

### 10.2 Search Service
Postgres full-text search: each searchable table has a generated `tsvector` column (PRD 49.4), combined into a materialized cross-module search view refreshed via a Background Job on a short interval (not on every write — full-text index updates are batched to avoid write-path latency). Query path: user query → tsquery → search across the view → filter results through Authorization Service per-row (46.7's "never return unauthorized results," implemented as a post-query filter rather than trying to push RBAC logic into the SQL query itself, since permission logic is complex enough that keeping it in application code is more maintainable than a giant RLS policy).

### 10.3 Approval Service / 10.4 Workflow Service
`workflow.service.js` executes a `workflow_definitions`-driven state machine (steps, conditions, approvers, escalation rules — configured via the Organization Admin UI per PRD Section 36); `approval.service.js` is the thin domain wrapper (`submitForApproval`, `decide`) that Expense/Leave/Procurement/Payroll/Budget call, translating "approve this expense" into "advance this workflow instance." Escalation timeouts are implemented as delayed BullMQ jobs scheduled when a workflow step starts, cancelled if the step completes before the delay fires.

### 10.5 Audit Service
Wildcard Event Bus subscriber (Section 9.3); writes one `audit_logs` row per event, with bulk operations (PRD 49's Bulk Operations edge case) producing one row per affected entity rather than one summary row — implemented by having the Bulk Operations job publish one event per row rather than one event for the whole batch, so Audit Service's subscriber logic stays simple (it never needs to know "this event represents 500 things").

### 10.6 Storage Service
Thin wrapper over Supabase Storage's SDK; `upload()` validates actual file content (magic-byte sniffing via a library like `file-type`, not trusting the declared MIME type, PRD 49.4 security requirement) before forwarding to Supabase, and validates size against a per-organization-configurable limit before upload begins (not after, to avoid wasting bandwidth on rejected uploads).

### 10.7 Billing Service
Encapsulates Stripe (or equivalent) integration; `recordUsage()` tracks seat counts, triggering the soft-warning-at-90%/hard-block-at-100% logic (PRD 46.11 decision) via a scheduled Background Job checking usage against plan limits daily, plus a synchronous check at invitation-send time as the hard gate (the daily job is for proactive warning; the synchronous check is the actual enforcement, so a warning being stale by up to 24 hours never allows exceeding the hard limit).

### 10.8 AI Service
Wraps an LLM provider API (provider choice is an infra decision outside PRD scope, tracked as a Section 18 engineering decision); every query is scoped by first resolving what data the querying user can access (Authorization Service) and constructing the LLM context/prompt only from that permitted data — never sending the full dataset to the LLM and asking it to "remember" to filter, since that pattern is exactly the kind of authorization-logic-embedded-in-a-prompt that's unreliable by construction.

---

## 11. Security Design

### 11.1 Encryption
At rest: Supabase-managed Postgres encryption at rest (provider-level). In transit: TLS everywhere (Vercel/Railway default, enforced — no HTTP fallback). Integration credentials (OAuth tokens, API keys, PRD 49.4) additionally encrypted at the application layer (AES-256-GCM, key from a secrets manager, Section 11.3) before storage, so a database-level compromise alone doesn't expose third-party credentials in plaintext.

### 11.2 Storage
File storage access exclusively via signed URLs with short expiry (Storage Service, Section 10.6) — no publicly-readable storage buckets, even for "non-sensitive" assets like branding logos, since bucket-level public access is a common source of accidental data exposure and the signed-URL pattern costs little.

### 11.3 Secrets
Environment-specific secrets (DB credentials, Supabase service keys, encryption keys, third-party API keys) stored in Railway's/Vercel's built-in secrets management, never committed to the repository, never logged (structured logging, Section 16, explicitly redacts known secret-shaped fields).

### 11.4 Rate Limiting
Tiered per PRD Section 44/49.4: standard CRUD endpoints (per-user, generous), Public API (per-token, PRD 46.11-adjacent, stricter and metered against plan limits), bulk-import endpoints (per-workspace, stricter still given the resource cost of processing large imports). Implemented via `express-rate-limit` backed by Redis (shared store across Railway instances, so limits are enforced correctly even with more than one API instance running).

### 11.5 OWASP
Standard mitigations baseline: parameterized queries throughout (repositories never string-concatenate SQL — enforced by using a query builder/ORM, not raw string interpolation), CSRF protection via SameSite=Strict cookies (Section 7.2) plus CSRF tokens on state-changing requests from the SPA, output encoding handled by React's default JSX escaping (no `dangerouslySetInnerHTML` without an explicit sanitization pass, flagged in code review), dependency vulnerability scanning in CI (`npm audit` / Dependabot).

### 11.6 File Upload
Size limits, MIME validation via content-sniffing (Section 10.6), virus/malware scanning for uploaded documents (Document Center, PRD Section 41) via a scanning step in the upload job before a file is marked available — uploaded files are held in a quarantine state until the scan completes, not immediately accessible.

### 11.7 Tenant Isolation
Defense in depth, two independent layers: (1) application-layer — every repository query is scoped to `workspace_id` from the authenticated request context (Section 4.5); (2) database-layer — Postgres RLS policies on every tenant-owned table, checking `workspace_id` against a session-level claim set by the connection (belt-and-suspenders: an application-layer bug that forgets to scope a query is still caught by RLS). Cross-tenant-leak tests (PRD 49.1 NFR) run in CI, deliberately attempting queries across workspace boundaries and asserting zero rows returned.

---

## 12. DevOps

### 12.1 CI/CD
GitHub Actions: on PR — lint, type-check, unit tests, integration tests (against a CI-provisioned Postgres), OpenAPI spec freshness check (Section 6.5), cross-tenant-leak tests (Section 11.7). On merge to `main` — the same checks, then deploy to Staging automatically; Production deploy is a manual promotion step (not fully automatic) given the business-critical nature of payroll/finance data — a deliberate choice to keep a human in the loop for production releases, revisited in Section 18.

### 12.2 Docker
API and worker processes containerized (single Dockerfile, two entrypoints) for parity between local dev, CI, and Railway — avoids "works on my machine" drift, especially relevant given the BullMQ worker's Redis dependency.

### 12.3 Railway
Hosts the API service and the BullMQ worker service (separate Railway services from one repo, per Section 2.4), plus a managed Redis instance. Railway's built-in health-check/restart handles basic process-level resilience; Section 16 covers application-level health checks.

### 12.4 Vercel
Hosts the built React SPA as static assets with client-side routing fallback (`vercel.json` rewrite rule so all paths serve `index.html`); preview deployments per PR for frontend review before merge.

### 12.5 Supabase
Managed Postgres, Auth, and Storage — one Supabase project per environment (Section 2.4), migrations applied via Supabase CLI in the CI/CD pipeline (Section 5.5) rather than manually through the Supabase dashboard, so schema changes are always reviewed and reproducible.

### 12.6 GitHub Actions
Also owns dependency update automation (Dependabot PRs, auto-merged for patch-level updates that pass CI, manual review for minor/major) and the OpenAPI spec regeneration (Section 6.5) as a bot-committed PR when route definitions change without a corresponding spec update.

### 12.7 Monitoring / Logging
Covered fully in Section 16; DevOps owns the alerting configuration (which metrics page whom, escalation policy) as an operational runbook referenced from, but not duplicated in, this document.

---

## 13. Performance

### 13.1 Caching
Redis-backed, two main categories: (a) permission resolution (Section 7.4, 5-minute TTL, explicit invalidation on change); (b) dashboard/analytics aggregate reads (Analytics Service, Section 10, PRD 49.3's per-widget TTL tuning — e.g. headcount metric TTL 1 hour, pending-approvals-count TTL 1 minute, chosen per widget based on how stale a value can be before it's misleading). Cache keys are namespaced per workspace (`analytics:{workspaceId}:{metricKey}`) so cache invalidation and eviction never cross tenant boundaries.

### 13.2 Redis
Single Redis instance serves caching (13.1), BullMQ queue backing (Section 9.4, 12.3), and rate-limit counters (Section 11.4) — three concerns sharing one piece of infrastructure, differentiated by key prefix, which is operationally simpler than three separate Redis instances at FinFlow's current scale (revisit if any one concern's load starts affecting the others, tracked in Section 17).

### 13.3 Pagination
Every list endpoint (Section 6.1) paginates by default (never returns an unbounded result set) — cursor-based pagination for high-write tables where offset pagination would risk skipped/duplicated rows under concurrent writes (Activity Feed, Audit Logs); offset pagination elsewhere, where simplicity outweighs the edge case (most reference-data lists like Employees, Vendors, Assets, which change far less frequently mid-scroll).

### 13.4 Query Optimization
N+1 query prevention via explicit `include`/join specification in repository methods (never lazy-loading related records in a loop) — enforced in code review, and caught in practice by a query-count assertion in integration tests for list endpoints known to be N+1-prone (e.g. "list employees with department name" must execute a constant number of queries regardless of result count).

### 13.5 Lazy Loading
Frontend: route-based code splitting (each module's page bundle loaded on navigation, not in the initial bundle) via Vite's dynamic `import()`, keeping initial load fast even as the module count grows to ~30.

### 13.6 Indexes
Covered in Section 5.3 — this entry cross-references it as the performance-driving artifact it is, rather than duplicating the index list here.

---
## 14. Testing Strategy

### 14.1 Unit Tests
Services and repositories tested in isolation (repositories mocked when testing services, per the DI approach in Section 4.9 — trivial to swap in a mock since dependencies are constructor-injected, not imported directly). Coverage target: business-logic-bearing service methods at ≥85%; pure CRUD repository methods are lower-priority for unit coverage since they're exercised thoroughly by integration tests instead.

### 14.2 Integration Tests
Run against a real (CI-provisioned, ephemeral) Postgres instance — no mocking the database for these, since the whole point is catching issues unit tests with mocks can't (RLS behavior, cascade/restrict delete behavior, N+1 query counts per Section 13.4). Each module's integration suite covers its full CRUD lifecycle plus its PRD-specified edge cases (e.g. Leave's overlap-validation edge case, Section 8.6, has a dedicated integration test, not just a unit test of the validation function in isolation — the point is verifying the transaction-level locking actually prevents the race, which a unit test can't).

### 14.3 API Tests
Full request/response contract tests against the running API (supertest or equivalent) — verify status codes, response envelope shape (Section 6.2), and that `authorize` middleware actually blocks unauthorized requests end-to-end (not just that the Authorization Service function returns the right boolean in isolation).

### 14.4 E2E Tests
Playwright, covering critical user journeys end-to-end through the real UI: organization signup + setup wizard (PRD Section 5B), employee onboarding, expense submission → approval → budget update, payroll run → approval → completion, leave request → approval → calendar reflection. Not exhaustive of every module (E2E tests are expensive to maintain) — reserved for flows that cross multiple modules/services, where integration tests within a single module's suite wouldn't catch a cross-module regression.

### 14.5 Security Tests
Cross-tenant-leak suite (Section 11.7) run in CI on every PR touching a repository, migration, or RLS policy. Additionally: authorization-bypass tests (attempt every mutating endpoint as a role that should be forbidden, assert 403), and a scheduled (not per-PR, since it's slower) dependency/SAST scan.

### 14.6 Performance Tests
Load tests (k6 or equivalent) against staging before major releases, targeting the p95 < 500ms NFR (PRD Section 10) for dashboard/list endpoints at a simulated multi-tenant load reflecting realistic data volumes (PRD 46.7's "100k rows per workspace" baseline) — not run on every PR (too slow/expensive), run on a schedule and before any release touching a caching or indexing strategy.

---

## 15. Deployment

### 15.1 Development
Local, Docker Compose spinning up Postgres (or a local Supabase CLI instance for RLS parity), Redis, and the API — frontend runs via Vite dev server against the local API. Seed data scripts populate a representative multi-tenant dataset (multiple workspaces, so tenant-isolation bugs are visible locally, not just in CI).

### 15.2 Staging
Auto-deployed on merge to `main` (Section 12.1) — a full-fidelity environment (separate Supabase project, Section 2.4) used for E2E tests, manual QA, and stakeholder review before production promotion.

### 15.3 Production
Manual promotion from a specific Staging build (not a separate build — promoting the exact artifact that was tested in Staging, avoiding "it worked in staging but the prod build was different" class of issues). Database migrations (Section 5.5) run as a distinct, reviewed step before the application deploy that depends on them, not bundled automatically into the app deploy.

### 15.4 Rollback Strategy
Application rollback: Railway/Vercel's built-in instant rollback to the previous deployment (both platforms support this natively). Database rollback: forward-only migrations (Section 5.5) mean "rollback" for a bad migration is a new forward migration reverting the change, not a destructive rollback of the migration itself — this is safer for a system holding financial/payroll data, where silently reverting a schema change could have non-obvious data implications.

---

## 16. Monitoring

### 16.1 Metrics
APM (PRD Section 10's existing requirement) tracks request latency (p50/p95/p99 per endpoint), error rate, and queue depth (BullMQ jobs pending/processing/failed) — the queue-depth metric specifically closes a gap where a struggling background-job system (e.g. payroll runs backing up) wouldn't necessarily show up in request-latency metrics at all.

### 16.2 Tracing
Distributed tracing with a request ID generated at the API gateway/entry middleware and propagated through the Event Bus (PRD Section 44's requirement, SDD Section 9) — so a single user action (e.g. submitting an expense) can be traced across the synchronous request, the async Notification Service delivery, and the async webhook delivery, all correlated under one trace ID even though they execute at different times.

### 16.3 Alerts
Paging alerts for: error-rate spikes, p95 latency breaching the Section 10 NFR target sustained over N minutes, BullMQ dead-letter queue growth (Section 9.5), failed payroll runs (business-critical, alerted distinctly from generic error-rate alerting given the impact of a missed payroll run). Non-paging (dashboard-only) for lower-urgency signals like elevated cache-miss rate.

### 16.4 Logs
Structured JSON logging (not plain-text) with the correlation/request ID (16.2) on every log line, secrets redacted (Section 11.3), shipped to a log aggregation service for search/retention — retention period matches the audit-log retention policy (PRD Section 35) where logs contain business-data-adjacent information, shorter for purely operational logs.

### 16.5 Health Checks
`/health` (liveness — is the process up) and `/health/ready` (readiness — can the process actually serve traffic, i.e. DB and Redis connections are live) as distinct endpoints, since Railway's restart policy should treat these differently (a liveness failure means restart the process; a readiness failure during a brief Redis blip should not trigger a restart, just temporarily stop routing traffic).

---

## 17. Future Scalability

### 17.1 Microservices Migration
The module-boundary discipline maintained throughout (Section 4.2, 8) — each module's service only calls shared platform services or publishes events, never reaches into another module's repository directly — is deliberately what makes a future extraction possible without a rewrite. Payroll (heaviest compute, most sensitive data) and the background-job-heavy modules (Bulk Operations, BI) are the most likely first candidates for extraction into separate deployables, if/when a single Node process becomes a scaling bottleneck.

### 17.2 Message Queues
The Event Bus's `publish`/`subscribe` interface (Section 9.6) is already the abstraction boundary for this — moving from in-process `EventEmitter` to Redis Streams (using Redis already provisioned for caching/BullMQ, Section 13.2) is the first scaling step, with Kafka as a further-out option if event volume or cross-service replay requirements exceed what Streams handles comfortably.

### 17.3 Horizontal Scaling
The API layer is already stateless (no in-process session state — auth is JWT-based, Section 7; rate limiting and permission caching are Redis-backed, Section 11.4/7.4, not in-process) so horizontal scaling of the API service is a Railway configuration change (more instances behind the load balancer), not an architecture change, when request volume requires it.

### 17.4 Read Replicas
Not needed at current anticipated scale; the schema/query patterns (workspace-scoped queries, Section 4.5) are compatible with read-replica routing for read-heavy endpoints (dashboards, reports, Section 8.11) if/when write load on the primary becomes a bottleneck — flagged here as a known, low-risk lever rather than something requiring architectural rework later.

### 17.5 CDN
Frontend static assets already served via Vercel's CDN by default (Section 12.4); user-uploaded files (Storage Service, Section 10.6) could similarly front Supabase Storage with a CDN layer for frequently-accessed documents/branding assets if latency for geographically distant tenants becomes a concern — not needed at current scale.

---

## 18. Engineering Decisions

Decisions made in this SDD that go beyond what PRD v2.4 specified, with rationale and alternatives considered — so a future engineer can tell "was this decided deliberately" from "was this just how it happened to get built."

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| DI approach (4.9) | Constructor injection, no framework | InversifyJS / tsyringe | Framework overhead not justified at current module count; revisit if the composition root grows unwieldy |
| Access token storage (3.5) | In-memory, not localStorage | localStorage/sessionStorage | XSS mitigation — an XSS bug can't exfiltrate a token that isn't in any JS-readable storage |
| Refresh token storage (3.5) | HttpOnly cookie | localStorage | Same XSS rationale; HttpOnly cookies aren't readable by JS at all |
| Tenant isolation (11.7) | Both app-layer scoping AND Postgres RLS | RLS only, or app-layer only | Defense in depth — a bug in one layer is caught by the other, given how severe a cross-tenant leak would be for an ERP holding payroll/financial data |
| Event Bus transport (9.6) | In-process EventEmitter initially | Redis Streams/Kafka from day one | Avoids operational complexity before it's needed; interface is designed so the swap is contained, not a rewrite |
| Production deploy (12.1) | Manual promotion, not full auto-deploy | Full CI/CD auto-deploy to prod | Human-in-the-loop for a system processing payroll/financial transactions; latency cost of manual step is acceptable given the risk profile |
| Migration strategy (5.5) | Forward-only, never rewrite history | Down-migrations / rollback scripts | Safer for financial data — a "rollback" that silently reverses a schema change has non-obvious data implications; a new forward migration is explicit about what changed |
| API documentation (6.5) | Generated OpenAPI spec from code, CI-enforced freshness | Hand-maintained API docs | Hand-maintained docs drift from reality; generation + CI check makes staleness a build failure, not a silent doc-rot problem |
| Search implementation (10.2) | Postgres full-text search (tsvector) | Elasticsearch/Algolia from day one | Avoids a second search infrastructure before proving Postgres FTS is insufficient at actual data volumes (PRD 46.7 already flags this as the escalation path if needed) |
| Redis multi-purpose (13.2) | One Redis instance for cache + queue + rate-limit | Separate instances per concern | Operationally simpler at current scale; key-prefix separation is sufficient isolation for now |

---

*End of document — FinFlow ERP Software Design Document v1.0*
