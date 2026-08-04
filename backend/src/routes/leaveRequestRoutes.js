const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getLeaveRequests,
  getLeaveRequestById,
  createLeaveRequest,
  updateLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveHistory,
} = require("../controllers/leaveRequestController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

const STATUS_VALUES = ["pending", "dept_approved", "approved", "rejected", "cancelled"];

// @route   GET /api/leave-requests?employee_id=&department_id=&leave_type_id=
//              &status=&start_date_from=&start_date_to=&search=&sort_by=
//              &sort_order=&page=&page_size=
router.get(
  "/",
  [
    query("employee_id").optional({ nullable: true }).isUUID(),
    query("department_id").optional({ nullable: true }).isUUID(),
    query("leave_type_id").optional({ nullable: true }).isUUID(),
    query("status").optional({ nullable: true }).isIn(STATUS_VALUES),
    query("start_date_from").optional({ nullable: true }).isISO8601(),
    query("start_date_to").optional({ nullable: true }).isISO8601(),
    query("search").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    query("sort_by").optional({ nullable: true }).isIn(["start_date", "end_date", "submitted_at", "status"]),
    query("sort_order").optional({ nullable: true }).isIn(["asc", "desc"]),
    query("page").optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    query("page_size").optional({ nullable: true }).isInt({ min: 1, max: 100 }).toInt(),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_READ),
  getLeaveRequests
);

// Static segment registered before the generic "/:id" route below so
// Express doesn't try to match "history" as an :id value.
router.get(
  "/history/:employeeId",
  [param("employeeId").isUUID().withMessage("employeeId must be a valid UUID")],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_READ),
  getLeaveHistory
);

router.get(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_READ),
  getLeaveRequestById
);

router.post(
  "/",
  [
    body("employee_id").isUUID().withMessage("employee_id must be a valid UUID"),
    body("leave_type_id").isUUID().withMessage("leave_type_id must be a valid UUID"),
    body("start_date").isISO8601().withMessage("start_date must be a valid date"),
    body("end_date").isISO8601().withMessage("end_date must be a valid date"),
    body("is_half_day").optional().isBoolean(),
    body("half_day_period").optional({ nullable: true }).isIn(["AM", "PM"]),
    body("reason").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_MANAGE),
  createLeaveRequest
);

router.patch(
  "/:id",
  [
    param("id").notEmpty(),
    body("employee_id").isUUID().withMessage("employee_id must be a valid UUID"),
    body("leave_type_id").optional({ nullable: true }).isUUID(),
    body("start_date").optional({ nullable: true }).isISO8601(),
    body("end_date").optional({ nullable: true }).isISO8601(),
    body("is_half_day").optional().isBoolean(),
    body("half_day_period").optional({ nullable: true }).isIn(["AM", "PM"]),
    body("reason").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_MANAGE),
  updateLeaveRequest
);

router.post(
  "/:id/approve",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_APPROVE),
  approveLeaveRequest
);

router.post(
  "/:id/reject",
  [
    param("id").notEmpty(),
    body("reason").optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_APPROVE),
  rejectLeaveRequest
);

router.post(
  "/:id/cancel",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_MANAGE),
  cancelLeaveRequest
);

// No DELETE route — leave requests are never hard-deleted, only moved
// to the 'cancelled' status (PRD §15.16 "Leave Cancellation").

module.exports = router;