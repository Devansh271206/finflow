const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getEmployeeBalances,
  adjustBalance,
  getEmployeeSummary,
  getDepartmentSummary,
} = require("../controllers/leaveBalanceController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

// @route   GET /api/leave-balances?employee_id=&policy_period=
router.get(
  "/",
  [
    query("employee_id").notEmpty().isUUID().withMessage("employee_id must be a valid UUID"),
    query("policy_period").optional({ nullable: true }).isString().trim(),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_READ),
  getEmployeeBalances
);

// @route   POST /api/leave-balances/:employeeId/adjust
// HR/Admin allocation correction — see leaveBalanceController.js header
// for the "own vs any employee" scoping caveat.
router.post(
  "/:employeeId/adjust",
  [
    param("employeeId").isUUID().withMessage("employeeId must be a valid UUID"),
    body("leave_type_id").isUUID().withMessage("leave_type_id must be a valid UUID"),
    body("policy_period").optional({ nullable: true }).isString().trim(),
    body("allocated_days")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("allocated_days must be a non-negative number"),
    body("carried_forward_days")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("carried_forward_days must be a non-negative number"),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_MANAGE),
  adjustBalance
);

// @route   GET /api/leave-balances/summary/employee/:employeeId?policy_period=
router.get(
  "/summary/employee/:employeeId",
  [
    param("employeeId").isUUID().withMessage("employeeId must be a valid UUID"),
    query("policy_period").optional({ nullable: true }).isString().trim(),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_READ),
  getEmployeeSummary
);

// @route   GET /api/leave-balances/summary/department/:departmentId?policy_period=
router.get(
  "/summary/department/:departmentId",
  [
    param("departmentId").isUUID().withMessage("departmentId must be a valid UUID"),
    query("policy_period").optional({ nullable: true }).isString().trim(),
  ],
  validateRequest,
  authorize(PERMISSIONS.LEAVE_READ),
  getDepartmentSummary
);

module.exports = router;