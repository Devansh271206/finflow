/**
 * Custom error class for operational errors we throw intentionally
 * (e.g. "not found", "validation failed"). Caught by the global error
 * handler middleware and converted into the standard error response shape.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
