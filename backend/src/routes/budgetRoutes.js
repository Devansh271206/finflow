const express = require("express");
const { body, param, query } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
} = require("../controllers/budgetController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace);

// Sprint 1: RBAC flipped from log-only to enforcing, same as
// transactionRoutes.js this sprint. Phase F.5 had left this in log-only
// mode as a rollout precaution; Categories/Departments already proved
// the underlying mechanism works correctly in enforcing mode.

router.get(
  "/",
  authorize(PERMISSIONS.BUDGETS_READ),
  [query("department_id").optional({ nullable: true }).isUUID()],
  validateRequest,
  getBudgets
);

router.get(
  "/:id",
  authorize(PERMISSIONS.BUDGETS_READ),
  [param("id").notEmpty()],
  validateRequest,
  getBudgetById
);

router.post(
  "/",
  authorize(PERMISSIONS.BUDGETS_MANAGE),
  [
    body("limit").isFloat({ gt: 0 }).withMessage("Budget limit must be a positive number"),
    body("categoryId").optional({ nullable: true }).isUUID().withMessage("categoryId must be a valid category"),
    body("departmentId").optional({ nullable: true }).isUUID().withMessage("departmentId must be a valid department"),
    body("periodType").optional().isIn(["monthly", "quarterly", "annual"]),
    body("periodStart").optional().isISO8601(),
  ],
  validateRequest,
  createBudget
);

router.put(
  "/:id",
  authorize(PERMISSIONS.BUDGETS_MANAGE),
  [
    param("id").notEmpty(),
    body("categoryId").optional({ nullable: true }).isUUID().withMessage("categoryId must be a valid category"),
    body("departmentId").optional({ nullable: true }).isUUID().withMessage("departmentId must be a valid department"),
    body("limit").optional().isFloat({ gt: 0 }),
    body("periodType").optional().isIn(["monthly", "quarterly", "annual"]),
    body("periodStart").optional().isISO8601(),
  ],
  validateRequest,
  updateBudget
);

router.delete(
  "/:id",
  authorize(PERMISSIONS.BUDGETS_MANAGE),
  [param("id").notEmpty()],
  validateRequest,
  deleteBudget
);

module.exports = router;