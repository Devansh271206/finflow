# FinFlow Backend API

A production-ready Node.js/Express backend for **FinFlow** — an AI-powered personal finance management application. Built on Supabase (PostgreSQL + Auth + Storage), with JWT-based authentication, input validation, structured error handling, and a modular MVC-style architecture.

---

## Tech Stack

| Layer            | Technology                              |
|-------------------|------------------------------------------|
| Runtime           | Node.js (>=18) + Express.js              |
| Database          | Supabase (PostgreSQL)                    |
| Auth              | Supabase Auth (JWT) + Supabase Admin SDK |
| Validation        | express-validator                        |
| File Uploads      | multer + Supabase Storage                |
| Security          | helmet, cors, rate limiting             |
| Logging           | morgan + centralized logger             |
| Config            | dotenv                                   |

---

## Folder Structure

```
backend/
│
├── src/
│   ├── config/
│   │     supabase.js              # Supabase admin + auth clients
│   │
│   ├── controllers/
│   │     authController.js
│   │     transactionController.js
│   │     budgetController.js
│   │     goalController.js
│   │     categoryController.js
│   │     dashboardController.js
│   │     analyticsController.js
│   │     notificationController.js
│   │     profileController.js
│   │
│   ├── middleware/
│   │     authMiddleware.js        # JWT verification ("protect")
│   │     errorHandler.js          # Global error handler + 404
│   │     validateRequest.js       # express-validator result handler
│   │
│   ├── routes/
│   │     authRoutes.js
│   │     transactionRoutes.js
│   │     budgetRoutes.js
│   │     goalRoutes.js
│   │     dashboardRoutes.js
│   │     analyticsRoutes.js
│   │     categoryRoutes.js
│   │     profileRoutes.js
│   │     notificationRoutes.js    # added: required by spec item #9
│   │
│   ├── services/
│   │     dashboardService.js      # dashboard business logic
│   │     analyticsService.js      # analytics business logic
│   │
│   ├── utils/
│   │     apiResponse.js           # sendSuccess / sendError helpers
│   │     ApiError.js              # custom operational error class
│   │     asyncHandler.js          # wraps async controllers
│   │     upload.js                # multer + Supabase Storage upload
│   │
│   ├── app.js                     # Express app (middleware + routes)
│   └── server.js                  # Entrypoint (starts HTTP server)
│
├── package.json
├── .env.example
└── README.md
```

> **Note:** `notificationRoutes.js` was added to `routes/` (not in the originally listed structure) since a full Notifications CRUD API was explicitly required — it's mounted at `/api/notifications` in `app.js`.

---

## Database Schema (Supabase / PostgreSQL)

This backend expects the following tables to exist in your Supabase project (matching the existing FinFlow frontend's data model). Row Level Security (RLS) can remain enabled on these tables — the backend uses the **service role key**, which bypasses RLS, and enforces per-user data isolation itself by filtering every query on `user_id`.

```sql
-- profiles (1:1 with auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  currency text default '₹',
  theme text default 'dark',
  language text default 'English',
  privacy_mode boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text default 'CreditCard',
  color text default 'emerald',
  type text default 'expense', -- 'income' | 'expense'
  created_at timestamptz default now()
);

-- transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  merchant text,
  amount numeric not null,
  type text default 'expense', -- 'income' | 'expense'
  category text,
  category_id uuid references categories(id),
  payment_method text default 'Credit Card',
  transaction_date timestamptz not null default now(),
  notes text,
  receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- budgets
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category_id uuid references categories(id),
  monthly_limit numeric not null,
  month int,
  year int,
  created_at timestamptz default now()
);

-- goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  target_amount numeric not null,
  saved_amount numeric default 0,
  deadline date,
  status text default 'active', -- 'active' | 'completed' | 'paused'
  category text default 'General',
  milestones jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info',
  is_read boolean default false,
  created_at timestamptz default now()
);
```

Also create a Supabase Storage bucket (public) named `finflow-uploads` (or your own name — set it via `SUPABASE_STORAGE_BUCKET`) for receipts and avatars.

---

## Installation & Setup

### 1. Prerequisites
- Node.js >= 18
- A Supabase project (https://supabase.com) with the schema above applied
- npm or yarn

### 2. Install dependencies
```bash
cd backend
npm install
```

### 3. Configure environment variables
Copy the example file and fill in your Supabase project credentials:
```bash
cp .env.example .env
```

| Variable                    | Description                                                    |
|-------------------------------|------------------------------------------------------------------|
| `PORT`                       | Port the API listens on (default `5000`)                        |
| `NODE_ENV`                   | `development` or `production`                                   |
| `SUPABASE_URL`                | Your Supabase project URL                                        |
| `SUPABASE_ANON_KEY`           | Supabase public anon key                                         |
| `SUPABASE_SERVICE_ROLE_KEY`   | Supabase **service role** key (secret, server-only)               |
| `SUPABASE_JWT_SECRET`         | Supabase project JWT secret (Project Settings → API → JWT Settings) |
| `CORS_ORIGIN`                 | Comma-separated list of allowed frontend origins                 |
| `SUPABASE_STORAGE_BUCKET`     | Storage bucket name for uploads (default `finflow-uploads`)       |
| `MAX_UPLOAD_SIZE`             | Max upload size in bytes (default 5MB)                            |

### 4. Run the server
```bash
# Development (auto-restart with nodemon)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:5000`. Check `GET /health` to confirm it's running.

### Production readiness checks
- `node --test test/env.test.js`
- `npm run start`
- `curl http://localhost:5000/health`

---

## Authentication

All protected endpoints require an `Authorization: Bearer <access_token>` header, where `access_token` is the Supabase session token returned from `/api/auth/login` or `/api/auth/register` (or from the Supabase JS client directly, since both issue the same token type).

The `protect` middleware (`src/middleware/authMiddleware.js`) verifies this JWT — first locally against `SUPABASE_JWT_SECRET` for speed, falling back to a live check against Supabase Auth — and attaches the resolved user to `req.user`.

---

## Standard Response Format

**Success:**
```json
{
  "success": true,
  "message": "Human readable message",
  "data": { }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Human readable error message",
  "error": { "details": null }
}
```

---

## API Reference

### Auth — `/api/auth`
| Method | Endpoint             | Auth | Description                          |
|--------|-----------------------|------|----------------------------------------|
| POST   | `/register`           | ❌   | Register a new user (`email`, `password`, `fullName?`) |
| POST   | `/login`               | ❌   | Log in (`email`, `password`) → returns session/access token |
| POST   | `/refresh`             | ❌   | Refresh an access token (`refresh_token`) |
| GET    | `/me`                  | ✅   | Get the currently authenticated user   |
| POST   | `/logout`              | ✅   | Revoke the current session             |

### Transactions — `/api/transactions`
| Method | Endpoint | Auth | Description |
|--------|-----------|------|--------------|
| GET    | `/`               | ✅ | List transactions. Query: `type`, `category_id`, `from`, `to`, `page`, `limit` |
| GET    | `/:id`            | ✅ | Get a single transaction |
| POST   | `/`               | ✅ | Create a transaction. Body: `merchant`, `amount`, `type`, `category`, `paymentMethod`, `date`, `notes`. Optional multipart file field `receipt` |
| PUT    | `/:id`            | ✅ | Update a transaction (same fields, all optional) |
| DELETE | `/:id`            | ✅ | Delete a transaction |

### Budgets — `/api/budgets`
| Method | Endpoint | Auth | Description |
|--------|-----------|------|--------------|
| GET    | `/`      | ✅ | List budgets, enriched with `spent`, `remaining`, `utilization` |
| GET    | `/:id`   | ✅ | Get a single budget |
| POST   | `/`      | ✅ | Create a budget. Body: `categoryId`, `limit`, `month?`, `year?` |
| PUT    | `/:id`   | ✅ | Update a budget |
| DELETE | `/:id`   | ✅ | Delete a budget |

### Goals — `/api/goals`
| Method | Endpoint | Auth | Description |
|--------|-----------|------|--------------|
| GET    | `/`      | ✅ | List goals |
| GET    | `/:id`   | ✅ | Get a single goal |
| POST   | `/`      | ✅ | Create a goal. Body: `name`, `target`, `deadline?`, `category?` |
| PUT    | `/:id`   | ✅ | Update a goal. Supports `savedAmount` (absolute) or `addFunds` (increment) |
| DELETE | `/:id`   | ✅ | Delete a goal |

### Categories — `/api/categories`
| Method | Endpoint | Auth | Description |
|--------|-----------|------|--------------|
| GET    | `/`      | ✅ | List categories |
| GET    | `/:id`   | ✅ | Get a single category |
| POST   | `/`      | ✅ | Create a category. Body: `name`, `icon?`, `color?`, `type?` |
| PUT    | `/:id`   | ✅ | Update a category |
| DELETE | `/:id`   | ✅ | Delete a category |

### Dashboard — `/api/dashboard`
| Method | Endpoint | Auth | Description |
|--------|-----------|------|--------------|
| GET    | `/` | ✅ | Returns `balance`, `income`, `expenses`, `cashFlow`, `recentTransactions`, `monthlySummary` (trailing 6 months), `budgetUtilization`, `financialHealthScore` (0–100) |

### Analytics — `/api/analytics`
| Method | Endpoint                    | Auth | Description |
|--------|------------------------------|------|--------------|
| GET    | `/expense-by-category`       | ✅ | Total expenses grouped by category |
| GET    | `/income-vs-expense`         | ✅ | Monthly income vs expense (trailing 6 months) |
| GET    | `/monthly-spending`          | ✅ | Daily spend totals for the current month |
| GET    | `/weekly-spending`           | ✅ | Weekly spend totals (trailing 8 weeks) |
| GET    | `/cash-flow`                 | ✅ | Net + cumulative cash flow (trailing 6 months) |
| GET    | `/savings-growth`            | ✅ | Cumulative savings growth over time |

### Profile — `/api/profile`
| Method | Endpoint | Auth | Description |
|--------|-----------|------|--------------|
| GET    | `/` | ✅ | Get profile (auto-creates a default one on first access) |
| PUT    | `/` | ✅ | Update profile. Body: `fullName`, `currency`, `theme`, `language`, `privacyMode`. Optional multipart file field `avatar` |

### Notifications — `/api/notifications`
| Method | Endpoint      | Auth | Description |
|--------|----------------|------|--------------|
| GET    | `/`            | ✅ | List notifications |
| POST   | `/`            | ✅ | Create a notification. Body: `title`, `message`, `type?` |
| PUT    | `/read-all`    | ✅ | Mark all notifications as read |
| PUT    | `/:id`         | ✅ | Update a notification (e.g. `isRead: true`) |
| DELETE | `/:id`         | ✅ | Delete a notification |

---

## Error Handling

- All thrown `ApiError` instances (and common Supabase/Postgres error codes like unique violations `23505`, FK violations `23503`, not-found `PGRST116`) are converted to the standard error response with the correct HTTP status code.
- Unmatched routes return a `404` via the `notFound` middleware.
- Validation errors from `express-validator` return `422` with a field-by-field breakdown.
- In non-production environments, error responses include a stack trace to speed up debugging; this is omitted in production.

---

## Security Notes

- `helmet` sets secure HTTP headers by default.
- `cors` is restricted to the origins listed in `CORS_ORIGIN`.
- The Supabase **service role key** bypasses Row Level Security — every controller manually scopes queries to `req.user.id` to enforce data isolation. Do not add a route that queries these tables without a `user_id` filter.
- File uploads are limited by MIME type and `MAX_UPLOAD_SIZE`, and streamed directly into Supabase Storage rather than written to local disk.
- Never commit your real `.env` file — only `.env.example` should be checked into source control.
