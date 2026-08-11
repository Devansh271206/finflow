/**
 * Centralized Environment Configuration
 * ------------------------------------------------------------------
 * Non-Supabase env vars read by more than one file (or that carry a
 * default value) are collected here so the default lives in exactly
 * one place. Supabase credentials are intentionally NOT duplicated
 * here - config/supabase.js already owns those, validates them, and
 * fails fast; this file only adds what was previously scattered.
 */

require("dotenv").config();

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missingEnvVars = requiredEnvVars.filter((key) => !String(process.env[key] || "").trim());

if (missingEnvVars.length) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
}

const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parsePositiveInteger(process.env.PORT, 5000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

  // Public origin of the deployed frontend. Used as the base for
  // email links (confirmation, invitations). Must be the Vercel
  // frontend URL in production; falls back to the local dev server.
  FRONTEND_URL: (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, ""),

  // File storage - was previously re-declared with the same fallback
  // in attachmentController.js, upload.js (x3), and employeeDocumentService.js
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || "finflow-uploads",
  MAX_UPLOAD_SIZE: parsePositiveInteger(process.env.MAX_UPLOAD_SIZE, 5 * 1024 * 1024), // 5MB default

  // Email delivery (PRD Sections 30.2 / 30.3). Consumed by
  // services/emailService.js. EMAIL_PROVIDER is one of:
  //   "resend"  — Resend REST API (RESEND_API_KEY)
  //   "smtp"    — any SMTP server (SMTP_HOST/PORT/USER/PASS/SECURE)
  //   "console" — DEV ONLY: log to stdout instead of sending
  // A missing/invalid config makes emailService throw a 502, never silently
  // skip delivery.
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || "",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "",
  // DEV ONLY: when set (and NODE_ENV != production), every email is
  // delivered to this address instead of the intended recipient so the
  // forgot-password / invite flows can be tested without a verified
  // Resend domain. Hard-rejected in production. The real provider
  // response is still returned — nothing is faked.
  EMAIL_DEV_OVERRIDE_RECIPIENT: process.env.EMAIL_DEV_OVERRIDE_RECIPIENT || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: parsePositiveInteger(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_SECURE: process.env.SMTP_SECURE === "true",

  isProduction: process.env.NODE_ENV === "production",
});

module.exports = env;