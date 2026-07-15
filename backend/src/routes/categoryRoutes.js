const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  reorderCategories,
  deleteCategory,
} = require("../controllers/categoryController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
// (was `protect` — an alias for the same function, see authMiddleware.js
// `module.exports = { protect, authenticate: protect }` — renamed here
// only for naming consistency with departmentRoutes.js/membershipRoutes.js,
// no behavior change)
router.use(authenticate);
router.use(resolveWorkspace);

router.get(
  "/",
  [
    query("search").optional().trim(),
    query("department").optional().trim(),
    query("status").optional().isIn(["active", "inactive"]),
  ],
  validateRequest,
  authorize(PERMISSIONS.CATEGORIES_READ),
  getCategories
);

// IMPORTANT: /reorder must be registered before /:id-style routes below,
// otherwise Express matches the literal path "reorder" as the :id param.
router.patch(
  "/reorder",
  [body("ordered_ids").isArray({ min: 1 }).withMessage("ordered_ids must be a non-empty array")],
  validateRequest,
  authorize(PERMISSIONS.CATEGORIES_MANAGE),
  reorderCategories
);

router.get(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.CATEGORIES_READ),
  getCategoryById
);

router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Category name is required"),
    body("type").optional().isIn(["income", "expense"]),
    body("department_id").optional({ nullable: true }).trim(),
  ],
  validateRequest,
  authorize(PERMISSIONS.CATEGORIES_MANAGE),
  createCategory
);

router.put(
  "/:id",
  [
    param("id").notEmpty(),
    body("department_id").optional({ nullable: true }).trim(),
  ],
  validateRequest,
  authorize(PERMISSIONS.CATEGORIES_MANAGE),
  updateCategory
);

router.patch(
  "/:id/status",
  [
    param("id").notEmpty(),
    body("status").isIn(["active", "inactive"]).withMessage("status must be 'active' or 'inactive'"),
  ],
  validateRequest,
  authorize(PERMISSIONS.CATEGORIES_MANAGE),
  updateCategoryStatus
);

router.delete(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.CATEGORIES_MANAGE),
  deleteCategory
);

module.exports = router;