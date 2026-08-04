const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  assignDepartmentHead,
} = require("../controllers/departmentController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

// Read access: Admin, Finance/Ops, Dept Lead, Employee all have
// departments.read per PRD §4 — enforced here (not log-only) since the
// permission is already granted to every role in migration 001's seed.
//
// Sprint 8: search/status/sort/pagination query params, validated the
// same way employeeRoutes.js validates getEmployees's querystring.
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
  authorize(PERMISSIONS.DEPARTMENTS_READ),
  getDepartments
);

router.get(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.DEPARTMENTS_READ),
  getDepartmentById
);

router.post(
  "/",
  [body("name").trim().notEmpty().withMessage("Department name is required")],
  validateRequest,
  authorize(PERMISSIONS.DEPARTMENTS_MANAGE),
  createDepartment
);

router.patch(
  "/:id",
  [
    param("id").notEmpty(),
    body("name").optional().trim().notEmpty().withMessage("Department name cannot be empty"),
    body("is_active").optional().isBoolean().withMessage("is_active must be a boolean"),
  ],
  validateRequest,
  authorize(PERMISSIONS.DEPARTMENTS_MANAGE),
  updateDepartment
);

// Sprint 8: Department Head assignment. employee_id: null clears the
// head (see departmentService.js's assignHead). Kept as its own route
// rather than folded into the generic PATCH /:id above, since it's a
// distinct permission-worthy action (reassigning leadership) that may
// need its own audit-log entry in a future sprint (Notification Center
// is out of scope here per Sprint 8's DO NOT IMPLEMENT list).
router.patch(
  "/:id/head",
  [
    param("id").notEmpty(),
    body("employee_id").optional({ nullable: true }).isUUID().withMessage("employee_id must be a valid UUID"),
  ],
  validateRequest,
  authorize(PERMISSIONS.DEPARTMENTS_MANAGE),
  assignDepartmentHead
);

// No DELETE route — departments are soft-deleted via PATCH { is_active:
// false } only. Hard-delete of a department with transaction history is
// explicitly out of scope (PRD §5.2).

module.exports = router;