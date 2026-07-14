const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const validateRequest = require("../middleware/validateRequest");
const {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
} = require("../controllers/goalController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace); // Phase 1: optional X-Workspace-Id resolution, non-breaking (see resolveWorkspace.js)

router.get("/", getGoals);

router.get("/:id", [param("id").notEmpty()], validateRequest, getGoalById);

router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Goal name is required"),
    body("target").isFloat({ gt: 0 }).withMessage("Target amount must be a positive number"),
    body("deadline").optional().isISO8601(),
  ],
  validateRequest,
  createGoal
);

router.put(
  "/:id",
  [
    param("id").notEmpty(),
    body("target").optional().isFloat({ gt: 0 }),
    body("deadline").optional().isISO8601(),
    body("status").optional().isIn(["active", "completed", "paused"]),
  ],
  validateRequest,
  updateGoal
);

router.delete("/:id", [param("id").notEmpty()], validateRequest, deleteGoal);

module.exports = router;
