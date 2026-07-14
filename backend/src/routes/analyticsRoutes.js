const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const {
  getExpenseByCategory,
  getIncomeVsExpense,
  getMonthlySpending,
  getWeeklySpending,
  getCashFlow,
  getSavingsGrowth,
} = require("../controllers/analyticsController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace); // Phase 1: optional X-Workspace-Id resolution, non-breaking (see resolveWorkspace.js)

router.get("/expense-by-category", getExpenseByCategory);
router.get("/income-vs-expense", getIncomeVsExpense);
router.get("/monthly-spending", getMonthlySpending);
router.get("/weekly-spending", getWeeklySpending);
router.get("/cash-flow", getCashFlow);
router.get("/savings-growth", getSavingsGrowth);

module.exports = router;
