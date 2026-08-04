const express = require("express");
const { query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const { getCalendarEvents } = require("../controllers/calendarController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

// Reuses HOLIDAYS_READ (see calendarController.js's header note on why
// this doesn't mint a separate "calendar.read" permission) — already
// granted broadly to Employee/Manager/HR/Admin per migration 018, the
// same visibility set the calendar itself needs.
router.get(
  "/events",
  [
    query("start").notEmpty().isISO8601().withMessage("start must be a valid date (YYYY-MM-DD)"),
    query("end").notEmpty().isISO8601().withMessage("end must be a valid date (YYYY-MM-DD)"),
    query("include")
      .optional({ nullable: true })
      .isString()
      .custom((value) => {
        const allowed = new Set(["leave", "holidays", "weekends"]);
        const parts = value.split(",").map((s) => s.trim().toLowerCase());
        return parts.every((p) => allowed.has(p));
      })
      .withMessage("include must be a comma-separated list of: leave, holidays, weekends"),
  ],
  validateRequest,
  authorize(PERMISSIONS.HOLIDAYS_READ),
  getCalendarEvents
);

module.exports = router;
