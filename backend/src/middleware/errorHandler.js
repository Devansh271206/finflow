/* eslint-disable no-unused-vars */
const ApiError = require("../utils/ApiError");

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
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  let message = err.message || "Internal Server Error";
  let details = err.details || null;

  // Supabase / PostgREST errors carry a `code` field (e.g. '23505' unique violation)
  if (err.code === "23505") {
    statusCode = 409;
    message = "A record with these details already exists.";
  } else if (err.code === "23503") {
    statusCode = 400;
    message = "Related record not found (invalid foreign key reference).";
  } else if (err.code === "PGRST116") {
    statusCode = 404;
    message = "Requested record not found.";
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      details,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
}

module.exports = { notFound, errorHandler };
