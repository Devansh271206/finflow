const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const validateRequest = require("../middleware/validateRequest");
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace); // Phase 1: optional X-Workspace-Id resolution, non-breaking (see resolveWorkspace.js)

router.get("/", getCategories);

router.get("/:id", [param("id").notEmpty()], validateRequest, getCategoryById);

router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Category name is required"),
    body("type").optional().isIn(["income", "expense"]),
  ],
  validateRequest,
  createCategory
);

router.put(
  "/:id",
  [param("id").notEmpty(), body("type").optional().isIn(["income", "expense"])],
  validateRequest,
  updateCategory
);

router.delete("/:id", [param("id").notEmpty()], validateRequest, deleteCategory);

module.exports = router;
