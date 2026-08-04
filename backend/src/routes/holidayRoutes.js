const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getHolidays,
  getHolidaysInRange,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require("../controllers/holidayController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

// Read access: Employee, Manager, HR, Admin all have holidays.read per
// Sprint 13's RBAC table / migration 018 — enforced here, same pattern
// as departmentRoutes.js's GET /.
router.get(
  "/",
  [
    query("search").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    query("type").optional({ nullable: true }).isIn(["public", "organization"]),
    query("sort_by").optional({ nullable: true }).isIn(["date", "name", "type", "created_at"]),
    query("sort_order").optional({ nullable: true }).isIn(["asc", "desc"]),
  ],
  validateRequest,
  authorize(PERMISSIONS.HOLIDAYS_READ),
  getHolidays
);

// IMPORTANT: registered before GET /:id so Express doesn't try to match
// "range" as the :id param.
router.get(
  "/range",
  [
    query("start").notEmpty().isISO8601().withMessage("start must be a valid date (YYYY-MM-DD)"),
    query("end").notEmpty().isISO8601().withMessage("end must be a valid date (YYYY-MM-DD)"),
  ],
  validateRequest,
  authorize(PERMISSIONS.HOLIDAYS_READ),
  getHolidaysInRange
);

router.get(
  "/:id",
  [param("id").isUUID().withMessage("id must be a valid UUID")],
  validateRequest,
  authorize(PERMISSIONS.HOLIDAYS_READ),
  getHolidayById
);

// Create/Update/Delete: Organization Admin only (holidays.manage,
// cloned from departments.manage grants in migration 018).
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Holiday name is required"),
    body("date").isISO8601().withMessage("A valid date (YYYY-MM-DD) is required"),
    body("type").optional({ nullable: true }).isIn(["public", "organization"]),
    body("description").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
    body("is_recurring_annual").optional({ nullable: true }).isBoolean(),
  ],
  validateRequest,
  authorize(PERMISSIONS.HOLIDAYS_MANAGE),
  createHoliday
);

router.patch(
  "/:id",
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("name").optional().trim().notEmpty().withMessage("Holiday name cannot be empty"),
    body("date").optional().isISO8601().withMessage("date must be a valid date (YYYY-MM-DD)"),
    body("type").optional({ nullable: true }).isIn(["public", "organization"]),
    body("description").optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
    body("is_recurring_annual").optional({ nullable: true }).isBoolean(),
  ],
  validateRequest,
  authorize(PERMISSIONS.HOLIDAYS_MANAGE),
  updateHoliday
);

router.delete(
  "/:id",
  [param("id").isUUID().withMessage("id must be a valid UUID")],
  validateRequest,
  authorize(PERMISSIONS.HOLIDAYS_MANAGE),
  deleteHoliday
);

module.exports = router;
