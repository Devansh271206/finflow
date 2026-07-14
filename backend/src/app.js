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
require("dotenv").config();

const { notFound, errorHandler } = require("./middleware/errorHandler");

// Routers
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const goalRoutes = require("./routes/goalRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const profileRoutes = require("./routes/profileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const companyRoutes = require("./routes/companyRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const roleRoutes = require("./routes/roleRoutes");

const app = express();

// ------------------------------------------------------------------
// Security & core middleware
// ------------------------------------------------------------------
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || "*")
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

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

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
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/roles", roleRoutes);

// ------------------------------------------------------------------
// 404 + centralized error handling (must be registered last)
// ------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
