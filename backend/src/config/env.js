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

  // File storage - was previously re-declared with the same fallback
  // in attachmentController.js, upload.js (x3), and employeeDocumentService.js
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || "finflow-uploads",
  MAX_UPLOAD_SIZE: parsePositiveInteger(process.env.MAX_UPLOAD_SIZE, 5 * 1024 * 1024), // 5MB default

  isProduction: process.env.NODE_ENV === "production",
});

module.exports = env;