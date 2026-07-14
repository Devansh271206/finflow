/**
 * Standardized API response helpers.
 * Ensures every endpoint in the app responds with the same shape:
 *
 * Success:
 * { success: true, message: "...", data: {} }
 *
 * Error:
 * { success: false, message: "...", error: {} }
 */

function sendSuccess(res, { statusCode = 200, message = "Success", data = null } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function sendError(res, { statusCode = 500, message = "Something went wrong", error = null } = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
  });
}

module.exports = { sendSuccess, sendError };
