/**
 * Express App
 * ------------------------------------------------------------------
 * Wires up global middleware (security, logging, parsing) and mounts
 * all feature routers under /api/*. Kept separate from server.js so
 * the app instance can be imported directly in tests without binding
 * to a port.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errorHandler");

// Sprint 14: wire notificationService + activityService to
// eventBusService before any router (and therefore any request) can
// publish an event. Safe to call at module-load time — registration
// is idempotent (see registerSubscribers.js's own guard) and has no
// dependency on Express/the HTTP server existing yet.
const { registerSubscribers } = require("./events/registerSubscribers");
registerSubscribers();

// Routers
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const goalRoutes = require("./routes/goalRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const roleDashboardRoutes = require("./routes/roleDashboardRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const profileRoutes = require("./routes/profileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const notificationPreferenceRoutes = require("./routes/notificationPreferenceRoutes");
const activityRoutes = require("./routes/activityRoutes");
const companyRoutes = require("./routes/companyRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const roleRoutes = require("./routes/roleRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const teamRoutes = require("./routes/teamRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const essRoutes = require("./routes/essRoutes");
const salaryHistoryRoutes = require("./routes/salaryHistoryRoutes");
const employeeDocumentRoutes = require("./routes/employeeDocumentRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const payrollWorkspaceRoutes = require("./routes/payrollWorkspaceRoutes");
const employeeTimelineRoutes = require("./routes/employeeTimelineRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const attachmentRoutes = require("./routes/attachmentRoutes");

const membershipRoutes = require("./routes/membershipRoutes");
const membershipPermissionGrantRoutes = require("./routes/membershipPermissionGrantRoutes");

// Sprint 9: Leave Management
const leaveTypeRoutes = require("./routes/leaveTypeRoutes");
const leaveBalanceRoutes = require("./routes/leaveBalanceRoutes");
const leaveRequestRoutes = require("./routes/leaveRequestRoutes");

// Sprint 11: Enterprise Reporting & BI Platform
const reportRoutes = require("./routes/reportRoutes");

// Sprint 12: Platform Administration
const platformAdminRoutes = require("./routes/platformAdminRoutes");

// Sprint 13: Enterprise Onboarding & Calendar Experience
const holidayRoutes = require("./routes/holidayRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const onboardingRoutes = require("./routes/onboardingRoutes");

const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// ------------------------------------------------------------------
// Security & core middleware
// ------------------------------------------------------------------
app.disable("etag");
app.set("trust proxy", 1);
app.use(helmet());

const allowedOrigins = env.CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server) with no origin header
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(apiLimiter);
app.use(morgan(env.isProduction ? "combined" : "dev"));

// ------------------------------------------------------------------
// Health check
// ------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FinFlow API is healthy",
    data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
  });
});

// ------------------------------------------------------------------
// API Routes
// ------------------------------------------------------------------
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
// Sprint 10: additive — adds GET /api/dashboard/role-summary alongside
// the existing GET /api/dashboard (dashboardRoutes) above. Same base
// path, no collision (dashboardRoutes only registers "/").
app.use("/api/dashboard", roleDashboardRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/profile", profileRoutes);
// Mounted BEFORE the broader /api/notifications router below so
// /api/notifications/preferences/* is unambiguously routed here first
// — notificationRoutes.js's PUT /:id pattern is single-segment only
// and would not actually collide with /preferences/:eventType (two
// segments), but mounting the more specific path first removes any
// doubt rather than relying on that path-shape distinction.
app.use("/api/notifications/preferences", notificationPreferenceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/ess", essRoutes);
app.use("/api/employees/:employeeId/salary-history", salaryHistoryRoutes);
app.use("/api/employees/:employeeId/documents", employeeDocumentRoutes);
app.use("/api/employees/:employeeId/payroll", payrollRoutes);
app.use("/api/payroll", payrollWorkspaceRoutes);
app.use("/api/employees/:employeeId/timeline", employeeTimelineRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/transactions/:transactionId/attachments", attachmentRoutes);
app.use("/api/memberships", membershipRoutes);   // <-- add this line (was require'd on line 33 but never mounted — every team-management endpoint was 404ing)
app.use("/api/memberships/:membershipId/permission-grants", membershipPermissionGrantRoutes);

// Sprint 9: Leave Management
app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/leave-balances", leaveBalanceRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);

// Sprint 11: Enterprise Reporting & BI Platform
app.use("/api/reports", reportRoutes);

// Sprint 12: Platform Administration
app.use("/api/platform", platformAdminRoutes);

// Sprint 13: Enterprise Onboarding & Calendar Experience
app.use("/api/holidays", holidayRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/onboarding", onboardingRoutes);

// ------------------------------------------------------------------
// 404 + centralized error handling (must be registered last)
// ------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;