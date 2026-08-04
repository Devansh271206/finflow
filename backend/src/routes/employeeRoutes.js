const express = require("express");
const { body, param, query } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getEmployees,
  getSelfEmployee,
  getEmployeeById,
  getDirectReports,
  createEmployee,
  updateEmployee,
  terminateEmployee,
  deleteEmployee,
  restoreEmployee,
} = require("../controllers/employeeController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace);

// Sprint 1: RBAC flipped from log-only to enforcing, same as
// budgetRoutes.js/transactionRoutes.js this sprint. Phase E.2 had left
// this in log-only mode as a rollout precaution; Categories/Departments
// already proved the underlying mechanism works correctly in enforcing
// mode.

router.get(
  "/",
  authorize(PERMISSIONS.EMPLOYEES_READ),
  [
    query("department_id").optional({ nullable: true }).isUUID(),
    query("employment_status").optional({ nullable: true }).isIn(["active", "on_leave", "terminated"]),
    query("employment_type").optional({ nullable: true }).isIn(["full_time", "part_time", "contract", "intern"]),
    // Sprint 7: Employee Search / Filtering / Sorting / Pagination.
    // Repository/service already supported these — this route was the
    // only layer not exposing them.
    query("search").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    query("sort_by")
      .optional({ nullable: true })
      .isIn(["full_name", "employee_code", "designation", "date_of_joining", "created_at", "updated_at"]),
    query("sort_order").optional({ nullable: true }).isIn(["asc", "desc"]),
    query("page").optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    query("page_size").optional({ nullable: true }).isInt({ min: 1, max: 100 }).toInt(),
  ],
  validateRequest,
  getEmployees
);

// @desc    Get current user's employee record
// @access  Authenticated User (not gated by EMPLOYEES_READ)
router.get(
  "/me",
  getSelfEmployee
);

router.get(
  "/:id",
  authorize(PERMISSIONS.EMPLOYEES_READ),
  [param("id").notEmpty()],
  validateRequest,
  getEmployeeById
);

router.get(
  "/:id/reports",
  authorize(PERMISSIONS.EMPLOYEES_READ),
  [param("id").notEmpty()],
  validateRequest,
  getDirectReports
);

router.post(
  "/",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE),
  [
    body("employeeCode").trim().notEmpty().withMessage("employeeCode is required"),
    body("fullName").trim().notEmpty().withMessage("fullName is required"),
    body("designation").trim().notEmpty().withMessage("designation is required"),
    body("departmentId").isUUID().withMessage("departmentId must be a valid department"),
    body("reportingManagerId").optional({ nullable: true }).isUUID(),
    body("userId").optional({ nullable: true }).isUUID(),
    body("employmentStatus").optional().isIn(["active", "on_leave", "terminated"]),
    body("employmentType").optional().isIn(["full_time", "part_time", "contract", "intern"]),
    body("dateOfJoining").isISO8601().withMessage("dateOfJoining must be a valid date"),
    body("email").optional({ nullable: true }).isEmail().withMessage("email must be valid"),
    // Sprint 7: Employee Contact Information / Emergency Contact / Notes.
    // All optional, free-form — length caps only, matching the DB's
    // unconstrained text columns (011_employee_contact_fields.sql).
    body("phone").optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
    body("address").optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
    body("emergencyContactName").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    body("emergencyContactPhone").optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
    body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  ],
  validateRequest,
  createEmployee
);

router.put(
  "/:id",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE),
  [
    param("id").notEmpty(),
    body("employeeCode").optional().trim().notEmpty(),
    body("fullName").optional().trim().notEmpty(),
    body("designation").optional().trim().notEmpty(),
    body("departmentId").optional().isUUID(),
    body("reportingManagerId").optional({ nullable: true }).isUUID(),
    body("userId").optional({ nullable: true }).isUUID(),
    body("employmentStatus").optional().isIn(["active", "on_leave", "terminated"]),
    body("employmentType").optional().isIn(["full_time", "part_time", "contract", "intern"]),
    body("dateOfJoining").optional().isISO8601(),
    body("dateOfExit").optional({ nullable: true }).isISO8601(),
    body("email").optional({ nullable: true }).isEmail().withMessage("email must be valid"),
    // Sprint 7 fields — same rules as POST above.
    body("phone").optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
    body("address").optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
    body("emergencyContactName").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    body("emergencyContactPhone").optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
    body("notes").optional({ nullable: true }).isString().trim().isLength({ max: 5000 }),
  ],
  validateRequest,
  updateEmployee
);

router.post(
  "/:id/terminate",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE),
  [param("id").notEmpty(), body("dateOfExit").optional({ nullable: true }).isISO8601()],
  validateRequest,
  terminateEmployee
);

// Sprint 7: DELETE and restore routes added — deliberately superseding
// the original design note here, which read "No DELETE route on
// purpose — employees are soft-terminated only." That covered
// EMPLOYMENT termination (terminate route above, employment_status);
// this is the separate RECORD soft-delete/restore axis
// (is_active/deleted_at) that employeeService.js already implemented
// but never had routes exposed for. Both axes are intentionally
// independent — see employeeService.js file header.
router.delete(
  "/:id",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE),
  [param("id").notEmpty()],
  validateRequest,
  deleteEmployee
);

router.post(
  "/:id/restore",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE),
  [param("id").notEmpty()],
  validateRequest,
  restoreEmployee
);

module.exports = router;