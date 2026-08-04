/**
 * Shared App Constants
 * ------------------------------------------------------------------
 * Single source of truth for magic values referenced in more than one
 * place. Keep this file flat and additive - Sprint 6 only introduces
 * the Postgres error codes already used by errorHandler.js; later
 * sprints can extend this (not restructure it) as new shared constants
 * are needed.
 */

// Postgres / PostgREST error codes surfaced by Supabase queries.
// Referenced in middleware/errorHandler.js to translate low-level DB
// errors into user-facing HTTP responses.
const DB_ERROR_CODES = Object.freeze({
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  NOT_FOUND: "PGRST116",
});

module.exports = { DB_ERROR_CODES };