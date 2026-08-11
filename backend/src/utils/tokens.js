/**
 * Secure token utilities
 * ------------------------------------------------------------------
 * Shared by invitationService and passwordResetService.
 *
 *   generateToken() — 32-byte CSPRNG hex string (64 chars).
 *   hashToken(token) — SHA-256 hash of the raw token (hex).
 *
 * Only hashToken() output is persisted. The raw token exists only in
 * the emailed link and in the short-lived service call that builds it,
 * so a database leak can never be replayed against the API.
 */

const crypto = require("crypto");

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

module.exports = { generateToken, hashToken };
