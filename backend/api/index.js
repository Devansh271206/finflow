/**
 * Vercel Serverless Entry Point
 * ------------------------------------------------------------------
 * Vercel treats every file under api/ as a serverless function. This
 * file simply exports the existing Express app (from src/app.js) so
 * Vercel can bridge incoming requests into Express — it deliberately
 * does NOT call app.listen(), which is what the traditional src/server.js
 * entry does and what causes FUNCTION_INVOCATION_FAILED in a serverless
 * runtime.
 *
 * vercel.json rewrites route every request (/ , /health, /api/*) to this
 * function (/api) while preserving the original request path, so all
 * existing business logic and route mounting in app.js work unchanged.
 */
const app = require("../src/app");

module.exports = app;
