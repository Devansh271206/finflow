const express = require("express");
const { body, param, query } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getEmployees,
  getEmployeeById,
  getDirectReports,
  createEmployee,
  updateEmployee,
  terminateEmployee,
} = require("../controllers/employeeController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace);

// Phase E.2: RBAC wired in for employees, in log-only mode (enforce: false)
// — same rollout pattern as budgetRoutes.js/transactionRoutes.js. Watch
// logs for [authorize:log-only] denials before flipping to enforce: true.
// See middleware/authorize.js header for the full rollout rationale.

router.get(
  "/",
  authorize(PERMISSIONS.EMPLOYEES_READ, { enforce: false }),
  [
    query("department_id").optional({ nullable: true }).isUUID(),
    query("employment_status").optional({ nullable: true }).isIn(["active", "on_leave", "terminated"]),
  ],
  validateRequest,
  getEmployees
);

router.get(
  "/:id",
  authorize(PERMISSIONS.EMPLOYEES_READ, { enforce: false }),
  [param("id").notEmpty()],
  validateRequest,
  getEmployeeById
);

router.get(
  "/:id/reports",
  authorize(PERMISSIONS.EMPLOYEES_READ, { enforce: false }),
  [param("id").notEmpty()],
  validateRequest,
  getDirectReports
);

router.post(
  "/",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE, { enforce: false }),
  [
    body("employeeCode").trim().notEmpty().withMessage("employeeCode is required"),
    body("fullName").trim().notEmpty().withMessage("fullName is required"),
    body("designation").trim().notEmpty().withMessage("designation is required"),
    body("departmentId").isUUID().withMessage("departmentId must be a valid department"),
    body("reportingManagerId").optional({ nullable: true }).isUUID(),
    body("userId").optional({ nullable: true }).isUUID(),
    body("employmentStatus").optional().isIn(["active", "on_leave", "terminated"]),
    body("dateOfJoining").isISO8601().withMessage("dateOfJoining must be a valid date"),
  ],
  validateRequest,
  createEmployee
);

router.put(
  "/:id",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE, { enforce: false }),
  [
    param("id").notEmpty(),
    body("employeeCode").optional().trim().notEmpty(),
    body("fullName").optional().trim().notEmpty(),
    body("designation").optional().trim().notEmpty(),
    body("departmentId").optional().isUUID(),
    body("reportingManagerId").optional({ nullable: true }).isUUID(),
    body("userId").optional({ nullable: true }).isUUID(),
    body("employmentStatus").optional().isIn(["active", "on_leave", "terminated"]),
    body("dateOfJoining").optional().isISO8601(),
    body("dateOfExit").optional({ nullable: true }).isISO8601(),
  ],
  validateRequest,
  updateEmployee
);

// No DELETE route on purpose — employees are soft-terminated only,
// mirroring the no-hard-delete rule on departments (PRD §5.2).
router.post(
  "/:id/terminate",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE, { enforce: false }),
  [param("id").notEmpty(), body("dateOfExit").optional({ nullable: true }).isISO8601()],
  validateRequest,
  terminateEmployee
);

module.exports = router;