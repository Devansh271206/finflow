/**
 * Standardized API response helpers.
 * Ensures every endpoint in the app responds with the same shape:
 *
 * Success (no meta — unchanged from before):
 * { success: true, message: "...", data: {} }
 *
 * Success (with meta — Sprint 7, e.g. GET /employees pagination):
 * { success: true, message: "...", data: {}, meta: { total, page, pageSize } }
 *
 * Error:
 * { success: false, message: "...", error: {} }
 */

function sendSuccess(res, { statusCode = 200, message = "Success", data = null, meta = null } = {}) {
  const body = {
    success: true,
    message,
    data,
  };

  // Only added to the response when a caller actually passes meta —
  // every existing call site that doesn't pass it gets the exact same
  // response shape as before this change (no empty `meta: null` key
  // added to responses that never asked for one).
  if (meta !== null) {
    body.meta = meta;
  }

  return res.status(statusCode).json(body);
}

function sendError(res, { statusCode = 500, message = "Something went wrong", error = null } = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
  });
}

module.exports = { sendSuccess, sendError };