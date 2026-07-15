# FinFlow

> An Internal Operating System for IT Startups — org structure, employees, payroll records, spend, vendors, and budgets in a single workspace, sized for companies too big for spreadsheets and too small for an enterprise suite.

---

# Overview

FinFlow is an internal operations platform built for IT startups and technology companies (20–500 employees).

It is **not** an accounting tool, **not** a payroll processor, and **not** a general-purpose HRMS. It is the operational visibility layer above whatever point tools a company already uses — the single workspace that answers: who works here, what are we paying them, what are we spending on, and what needs a decision this week.

FinFlow enables organizations to:

- Maintain an employee directory with org structure, designations, and reporting lines
- Track salary history and CTC revisions per employee
- Store payroll records and generate payroll analytics (record-keeping, not processing)
- Track company-wide expenses and departmental budgets
- Manage vendors, contracts, and SaaS subscription renewals
- Approve employee reimbursements through a governed workflow
- Analyze burn rate, cash flow, and runway
- Detect unnecessary or duplicate spending
- Surface trend-level risk signals and executive summaries (Business Intelligence)
- Generate department, payroll, vendor, and budget reports
- Get narrow, explanation-focused AI assistance — not a chatbot

> **v2.1 note:** the PRD has gone through a product/business review pass. Scope and architecture are unchanged from v2.0, but the product is now positioned explicitly as an *Internal Operating System*, every module states a business objective and KPIs, and a new Business Intelligence module has been added. See `FinFlow_Enterprise_PRD_v2.1.md` for the full spec.

---

# Positioning

Between roughly 20 and 500 employees, a tech company is too large for one founder to hold the whole operational picture in their head, and too small to justify running a full HRIS + FP&A + spend-management stack with headcount to administer it. FinFlow is sized for exactly that gap — not competing with payroll processors, ATS platforms, or accounting software, but sitting above them.

| Instead of... | You get... | FinFlow gives you... |
|---|---|---|
| SAP / Oracle | Multi-year implementation, enterprise pricing | A workspace you can set up in a day |
| Zoho / Freshworks | Three separately licensed products, three data models | One workspace, one shared org/employee model |
| Darwinbox / Keka | Strong HR, finance-blind | Employee and financial data in the same place |
| Rippling | Payroll processing you may not need yet | Visibility without the compliance overhead |
| Notion / Spreadsheets | No access control, no audit trail, no computation | RBAC, RLS-backed isolation, computed budgets/burn/runway |

---

# Tech Stack

## Frontend
- React
- Vite
- TailwindCSS
- Framer Motion
- Recharts

## Backend
- Node.js
- Express.js

## Database
- PostgreSQL (Supabase)

## Authentication
- Supabase Auth

## Storage
- Supabase Storage

---

# Architecture

```
React
        │
        ▼
Express REST API
        │
        ▼
Supabase PostgreSQL
        │
        ▼
Supabase Storage
```

Business logic is handled entirely by the Express backend. Supabase is used only for authentication, database, and storage.

---

# Modules

Each module now maps to a business objective and a set of KPIs in the PRD (§15) — status below reflects actual shipped code, not intent.

| # | Module | Status | Business Objective (short) |
|---|---|---|---|
| 1 | Workspace & Organization | ✅ Shipped | Reliable, isolated org foundation for every other module |
| 2 | Employee Management | 🚧 Phase 3 | Org structure & comp history as system of record, not spreadsheets |
| 3 | Payroll Records | 🚧 Phase 3 | Payroll trend visibility without building/licensing a processor |
| 4 | Finance | ⚠️ Migration required | Governed, auditable ledger replacing spend spreadsheets |
| 5 | Expense Approval | 📅 Phase 4 | Auditable approval workflow, replacing Slack/email approvals |
| 6 | Vendor Management | 📅 Phase 4 | Every vendor has an owner; nothing auto-renews unnoticed |
| 7 | SaaS Subscription Management | 📅 Phase 4 | Recurring software spend visible and attributable by department |
| 8 | Cost Optimization | 📅 Phase 6 | Waste converted into a ranked, actionable savings list |
| 9 | Executive Dashboard | 📅 Phase 5 | Founder answers "how are we doing" without manual assembly |
| 10 | HR Dashboard | 📅 Phase 5 | Standing headcount/payroll view without pulling from 3 systems |
| 11 | Finance Dashboard | 📅 Phase 5 | Finance's daily queue in one screen |
| 12 | Employee Portal | 📅 Phase 5 | Employees self-serve profile/payslip questions |
| 13 | Reporting | ⚠️ Partially built | Export-ready reports for boards, diligence, audits |
| 14 | AI Insights | 📅 Phase 6 | Explains flagged metrics — never an open-ended assistant |
| 15 | Business Intelligence *(new)* | 📅 Phase 6 | Trend-level signals & executive summaries, rules-based |

**MVP line (v1.0):** Modules 1, 4 (post-migration), 2, 5, 9, and 11 are required for v1.0. Payroll Records, Vendor/SaaS Management, HR Dashboard, and Employee Portal are optional for v1.0. Cost Optimization, Business Intelligence, and AI Insights are explicitly deferred to v2.0+. See PRD §8 for the full MVP definition.

---

# Multi-Tenant Architecture

```
Company
    │
    ▼
Workspace
    │
    ▼
Departments
    │
    ▼
Employees / Users
```

Every company has one or more workspaces. Each workspace has departments, employees, budgets, transactions, vendors, reports, and members. Complete tenant isolation is enforced using PostgreSQL Row Level Security (RLS) as defense-in-depth alongside application-layer RBAC.

---

# User Roles

| Role | Permissions |
|---|---|
| Founder / Admin | Full platform access |
| Finance | Manage budgets, transactions, vendor payments; payroll visibility is aggregate-only |
| HR | Manage employee records, salary history, payroll records |
| Operations | Manage vendors, subscriptions, cost optimization |
| Department Lead | Own department's budget, headcount visibility, expense approvals |
| Employee | Self-service: profile, payslips, expense submission |

**Note on salary/CTC data:** access is not implied purely by role. Department Leads do not see salary data by default — it requires an explicit, separately-grantable permission set by Admin/HR. All reads of salary or individual payroll records are audit-logged regardless of role.

---

# Executive KPIs

Full definitions and formulas in PRD §17. Headline set: Burn Rate, Runway, Payroll % of Burn, Revenue per Employee, Cost per Employee, Vendor Concentration, Cloud Spend, Budget Utilization, Expense Approval Time, Employee Growth Rate, Headcount Cost, Reimbursement Time, SaaS Spend, Renewal Risk.

---

# Project Structure

```
FinFlow

backend/
    migrations/
    src/
        controllers/
        middleware/
        repositories/
        routes/
        services/
        utils/

Frontend/
    src/
        components/
        context/
        hooks/
        layouts/
        pages/
        services/
```

---

# Backend Architecture

```
Routes
      │
      ▼
Controllers
      │
      ▼
Services
      │
      ▼
Repositories
      │
      ▼
Supabase
```

New modules (Employee Management, Payroll Records, Vendor Management, Business Intelligence) follow this same pattern — each gets its own repository/controller/routes triplet.

---

# Authentication Flow

```
User Login
      │
      ▼
Supabase Auth
      │
      ▼
JWT Verification
      │
      ▼
Resolve Workspace
      │
      ▼
Resolve Membership
      │
      ▼
Resolve Role
      │
      ▼
Resolve Permissions
```

---

# Database

## Core entities (shipped)
Companies, Workspaces, Memberships, Roles, Permissions, Departments

## Core entities (built, migration required — see Known Issues)
Categories, Transactions, Budgets

## Core entities (planned)
Employees, Salary History, Employee Documents, Employee Events, Payroll Records, Vendors, Approvals, Revenue, Notifications, Audit Logs, Cost Recommendations, BI Signals

---

# Known Issues

Tracked in `FinFlow_Enterprise_PRD_v2.1.md` §11.3 — top-priority fix before further feature work:

- **Budgets is buggy.** Legacy schema (`user_id`, `category_id`, `monthly_limit`, `month`, `year`) with no workspace/department concept. Spend is recomputed per-request in `budgetController.js` via a dual-key match (`category_id` OR lowercased category name), which is the root cause of incorrect remaining/spent figures. Fix is a schema migration, not a patch to the matching logic.
- **Analytics is non-functional.** `analyticsService.js` reads from the same unscoped tables. Resolved automatically once the Finance schema migration lands.
- **`department_id` is not yet wired into** Transactions, Budgets, or Categories.
- **`billService.js`** references a `bills` table that does not exist — broken, pending removal or replacement by Vendor Management.
- **Goals module** is leftover from the original personal-finance app, out of current scope, flagged for removal pending product confirmation.

---

# Security

- JWT Authentication
- Role-Based Access Control (RBAC)
- Workspace Isolation
- PostgreSQL RLS
- Audit Logging (mandatory on all salary/payroll reads, regardless of role)
- Secure File Uploads
- Input Validation
- Rate Limiting

---

# API

Example (existing + planned — see PRD §12 for the full inventory)

```
POST /api/auth/login
GET  /api/workspaces
GET  /api/departments

GET  /api/employees
POST /api/employees
GET  /api/employees/:id/timeline
POST /api/employees/:id/salary-revisions

GET  /api/payroll-records
POST /api/payroll-records/import

GET  /api/transactions
POST /api/transactions
PUT  /api/transactions/:id
DELETE /api/transactions/:id

GET  /api/budgets
POST /api/budgets

GET  /api/vendors
POST /api/vendors

GET  /api/dashboards/executive
GET  /api/dashboards/hr
GET  /api/dashboards/finance

GET  /api/bi/signals
GET  /api/bi/executive-summary

GET  /api/ai-insights/monthly-summary
GET  /api/ai-insights/explain/:entityType/:entityId
```

---

# Development

## Install Dependencies

Backend
```bash
cd backend
npm install
```

Frontend
```bash
cd Frontend
npm install
```

---

## Configure Environment

Backend
```env
PORT=5000

SUPABASE_URL=

SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

SUPABASE_JWT_SECRET=
```

Frontend
```env
VITE_API_URL=http://localhost:5000/api
```

---

## Run Backend

```bash
cd backend
npm run dev
```

---

## Run Frontend

```bash
cd Frontend
npm run dev
```

---

# Product Roadmap

## Completed
- **Phase 1 — Multi-Tenant Foundation:** companies, workspaces, RBAC foundation, RLS, backfill
- **Phase 2.1 — Departments:** department CRUD, default seeding, soft delete, workspace switcher

## In Progress / Next Up
- **Phase 2.2 — Finance Schema Migration (blocking):** workspace/department-scope transactions, budgets, categories; fix Analytics; remove dead code

## Upcoming (v1.0 scope)
- **Phase 3 — Employee Management & Payroll Records**
- **Phase 4 — Vendor Management & Expense Workflow**
- **Phase 5 — Dashboards & Reporting**

## Future (v2.0+, deferred)
- **Phase 6 — Cost Optimization & Business Intelligence:** rule engine, `bi_signals` feed, AI Insights
- Integrations: Slack, Google Workspace, QuickBooks/Zoho Books, GitHub/Jira

## Stretch Goals
- ML-augmented Business Intelligence
- Multi-workspace-per-company support
- Configurable department-efficiency KPI

---

# Future Integrations

Slack, Microsoft Teams, Google Workspace, Google Calendar, QuickBooks, Zoho Books, GitHub, Jira, AWS Billing, Azure Cost Management, CSV, Email. None required for v1.0 — see PRD §25.

---

# Contributing

1. Create a feature branch.
2. Follow the existing architecture (routes → middleware → controllers → services → repositories).
3. Add tests for new functionality.
4. Ensure RBAC and workspace isolation are preserved.
5. Never grant salary/payroll row-level access without going through the §13.3 restricted-access layer.
6. Check the MVP line (PRD §8) before adding scope — if it's not required for v1.0, it belongs in a later phase.
7. Submit a pull request.

---

# License

MIT License

---

# Author

**Devansh Bhatia**

Built as an Internal Operating System for modern tech startups, focusing on operational visibility, governance, and decision-ready reporting — not accounting, not payroll processing, not a general-purpose ERP.
