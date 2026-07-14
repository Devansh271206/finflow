# FinFlow Enterprise

> A modern multi-tenant finance management platform for startups and IT companies to manage expenses, budgets, subscriptions, approvals, and cost optimization from a single dashboard.

---

# Overview

FinFlow Enterprise is an internal financial operating system built for startups and growing companies.

Unlike personal finance applications, FinFlow Enterprise enables organizations to:

- Track company-wide expenses
- Manage departmental budgets
- Monitor recurring SaaS subscriptions
- Approve employee reimbursements
- Analyze burn rate and cash flow
- Estimate runway
- Detect unnecessary spending
- Generate financial reports
- Surface AI-powered cost optimization recommendations

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

Business logic is handled entirely by the Express backend.

Supabase is used only for:

- Authentication
- Database
- Storage

---

# Features

## Financial Management

- Expense Tracking
- Revenue Tracking
- Department Budgets
- Category Budgets
- Financial Reports
- Cash Flow
- Burn Rate
- Runway Estimation

---

## Expense Management

- Expense Submission
- Receipt Uploads
- Vendor Tracking
- Recurring Expenses
- Employee Reimbursements
- Approval Workflow

---

## Budgeting

- Monthly Budgets
- Quarterly Budgets
- Yearly Budgets
- Budget Alerts
- Budget Utilization
- Overspend Detection

---

## Dashboard

- Total Expenses
- Revenue
- Net Cash Flow
- Burn Rate
- Runway
- Department Spend
- Category Spend
- Vendor Spend
- Monthly Trends
- Recent Activity

---

## Cost Revamp Engine

Automatically identifies:

- Duplicate SaaS subscriptions
- Unused software licenses
- Recurring cost spikes
- Over-budget departments
- Vendor consolidation opportunities
- Cloud overspending
- Unused subscriptions
- Idle infrastructure

---

## Notifications

- Budget Alerts
- Approval Requests
- Subscription Renewals
- Spend Spikes
- Monthly Reports

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
Users
```

Every company has one or more workspaces.

Each workspace has:

- Departments
- Budgets
- Transactions
- Vendors
- Reports
- Members

Complete tenant isolation is enforced using PostgreSQL Row Level Security (RLS).

---

# User Roles

| Role | Permissions |
|-------|-------------|
| Founder / Admin | Full platform access |
| Finance / Operations | Manage finances, budgets, vendors |
| Department Lead | Department budgets & approvals |
| Employee | Submit expenses & reimbursements |

---

# Project Structure

```
FinFlow Enterprise

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

Core entities

- Companies
- Workspaces
- Memberships
- Roles
- Permissions
- Departments
- Categories
- Vendors
- Transactions
- Budgets
- Approvals
- Revenue
- Notifications
- Audit Logs

---

# Security

- JWT Authentication
- Role-Based Access Control (RBAC)
- Workspace Isolation
- PostgreSQL RLS
- Audit Logging
- Secure File Uploads
- Input Validation
- Rate Limiting

---

# API

Example

```
POST /api/auth/login

GET /api/workspaces

GET /api/dashboard

GET /api/transactions

POST /api/transactions

PUT /api/transactions/:id

DELETE /api/transactions/:id

GET /api/budgets

POST /api/budgets

GET /api/vendors

POST /api/vendors
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

# Current Roadmap

## ✅ Phase 1

- Multi-Tenant Architecture
- Companies
- Workspaces
- RBAC
- Workspace Context
- Permission Context
- Repository Layer

---

## 🚧 Phase 2

- Departments
- Vendors
- Subscription Management
- Expense Approval Workflow
- Revenue Module

---

## 📅 Phase 3

- Advanced Dashboard
- Burn Rate
- Runway Estimation
- Forecasting
- Cost Revamp Engine

---

## 🤖 Phase 4

AI Financial Copilot

Examples:

> Why did Engineering spend increase 32%?

> Predict next month's burn rate.

> Which SaaS subscriptions should we cancel?

> Estimate runway if revenue decreases by 20%.

---

# Future Integrations

- Slack
- Microsoft Teams
- Google Workspace
- AWS Billing
- Azure Cost Management
- GitHub
- Stripe
- Razorpay

---

# Contributing

1. Create a feature branch.
2. Follow the existing architecture.
3. Add tests for new functionality.
4. Ensure RBAC and workspace isolation are preserved.
5. Submit a pull request.

---

# License

MIT License

---

# Author

**Devansh Bhatia**

Built as a scalable enterprise finance management platform for modern startups, focusing on financial visibility, operational efficiency, and intelligent cost optimization.