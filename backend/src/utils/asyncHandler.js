/**
 * Wraps an async route/controller function and forwards any thrown error
 * to Express's `next()` so it reaches our centralized error handler,
 * instead of requiring a try/catch block in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
