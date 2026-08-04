const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
} = require("../controllers/leaveTypeController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

// Read access: every role holding leave.read per migration 015's seed
// (cloned from departments.read — see that migration's header for the
// Finance/Operations caveat).
//
// search/status/sort/pagination query params, validated the same way
// departmentRoutes.js validates getDepartments's querystring.
router.get(
  "/",
  [
    query("search").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    query("status").optional({ nullable: true }).isIn(["active", "inactive"]),
    query("sort_by").optional({ nullable: true }).isIn(["name", "created_at", "is_active"]),
    query("sort_order").optional({ nullable: true }).isIn(["asc", "desc"]),
    query("page").optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    query("page_size").optional({ nullable: true }).isInt({ min: 1, max: 100 }).toInt(),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_READ),
  getLeaveTypes
);

router.get(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_READ),
  getLeaveTypeById
);

// Create/Edit: HR / Organization Admin only per PRD §15.16. Enforced
// here via leave.manage (see leaveTypeService.js's NEXT FILE note —
// today's permission table can't further distinguish "HR/Admin only"
// from "everyone with leave.manage" since leave.manage is shared with
// employee self-submission; if a future sprint needs to split leave
// type CRUD onto its own stricter permission key, that's a
// non-breaking additive change here, not a redesign).
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Leave type name is required"),
    body("is_paid").optional().isBoolean().withMessage("is_paid must be a boolean"),
    body("default_annual_days")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("default_annual_days must be a non-negative number"),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_MANAGE),
  createLeaveType
);

router.patch(
  "/:id",
  [
    param("id").notEmpty(),
    body("name").optional().trim().notEmpty().withMessage("Leave type name cannot be empty"),
    body("is_paid").optional().isBoolean().withMessage("is_paid must be a boolean"),
    body("default_annual_days")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("default_annual_days must be a non-negative number"),
    body("is_active").optional().isBoolean().withMessage("is_active must be a boolean"),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_MANAGE),
  updateLeaveType
);

// No DELETE route — leave types are soft-deleted via PATCH { is_active:
// false } only. leave_requests.leave_type_id is ON DELETE RESTRICT
// (migration 014), so hard-delete of a leave type with request history
// is out of scope by design, same convention as departmentRoutes.js.

module.exports = router;