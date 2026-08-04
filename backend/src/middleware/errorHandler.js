const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const env = require("../config/env");
const { DB_ERROR_CODES } = require("../utils/constants");

/**
 * Catches any route that doesn't match a defined path.
 */
function notFound(req, res, next) {
  next(new ApiError(404, `Route not found - ${req.originalUrl}`));
}

/**
 * Centralized error handler. Every thrown error (ApiError, Supabase error,
 * validation error, or unexpected exception) ends up here and is converted
 * into the standard { success, message, error } response shape.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  let message = err.message || "Internal Server Error";
  let details = err.details || null;

  // Supabase / PostgREST errors carry a `code` field (e.g. unique violation)
  if (err.code === DB_ERROR_CODES.UNIQUE_VIOLATION) {
    statusCode = 409;
    message = "A record with these details already exists.";
  } else if (err.code === DB_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
    statusCode = 400;
    message = "Related record not found (invalid foreign key reference).";
  } else if (err.code === DB_ERROR_CODES.NOT_FOUND) {
    statusCode = 404;
    message = "Requested record not found.";
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Not authorized. Invalid or expired token.";
  } else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON payload.";
  }

  if (!env.isProduction) {
    logger.error(`[${req.method}] ${req.originalUrl}`, err);
  } else {
    logger.error(`[${req.method}] ${req.originalUrl} -> ${statusCode} ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      details,
      ...(!env.isProduction && { stack: err.stack }),
    },
  });
}

module.exports = { notFound, errorHandler };