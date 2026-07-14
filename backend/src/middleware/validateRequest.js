const { validationResult } = require("express-validator");

/**
 * Runs after express-validator's chained validators (e.g. body("email").isEmail())
 * have executed on the route. If any validation failed, responds with a 422
 * and a list of field-level error messages. Otherwise passes control onward.
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      error: {
        details: errors.array().map((e) => ({
          field: e.path,
          message: e.msg,
        })),
      },
    });
  }

  next();
}

module.exports = validateRequest;
