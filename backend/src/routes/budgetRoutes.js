const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
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
router.use(resolveWorkspace); // Phase 1: optional X-Workspace-Id resolution, non-breaking (see resolveWorkspace.js)

router.get("/", getBudgets);

router.get("/:id", [param("id").notEmpty()], validateRequest, getBudgetById);

router.post(
  "/",
  [
    body("limit").isFloat({ gt: 0 }).withMessage("Monthly limit must be a positive number"),
    body("categoryId").optional({ nullable: true }).isUUID().withMessage("categoryId must be a valid category"),
    body("month").optional().isInt({ min: 1, max: 12 }),
    body("year").optional().isInt({ min: 2000 }),
  ],
  validateRequest,
  createBudget
);

router.put(
  "/:id",
  [
    param("id").notEmpty(),
    body("categoryId").optional({ nullable: true }).isUUID().withMessage("categoryId must be a valid category"),
    body("limit").optional().isFloat({ gt: 0 }),
    body("month").optional().isInt({ min: 1, max: 12 }),
    body("year").optional().isInt({ min: 2000 }),
  ],
  validateRequest,
  updateBudget
);

router.delete("/:id", [param("id").notEmpty()], validateRequest, deleteBudget);

module.exports = router;