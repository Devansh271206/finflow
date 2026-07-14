const express = require("express");
const { body, param } = require("express-validator");
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
} = require("../controllers/departmentController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

// Read access: Admin, Finance/Ops, Dept Lead, Employee all have
// departments.read per PRD §4 — enforced here (not log-only) since the
// permission is already granted to every role in migration 001's seed.
router.get("/", authorize(PERMISSIONS.DEPARTMENTS_READ), getDepartments);

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

// No DELETE route — departments are soft-deleted via PATCH { is_active:
// false } only. Hard-delete of a department with transaction history is
// explicitly out of scope (PRD §5.2).

module.exports = router;