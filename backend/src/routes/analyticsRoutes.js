const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
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

// Sprint 1: previously had no permission check at all. Wired to the
// existing (until now unused) ANALYTICS_VIEW permission key. Landed in
// log-only mode ({ enforce: false }) — unlike DASHBOARD_VIEW, this key
// hasn't been confirmed seeded in role_permissions yet. Flip to
// enforcing (drop the option) once that's confirmed, same rollout this
// sprint already used for transactions/budgets/employees.
router.get("/expense-by-category", authorize(PERMISSIONS.ANALYTICS_VIEW, { enforce: false }), getExpenseByCategory);
router.get("/income-vs-expense", authorize(PERMISSIONS.ANALYTICS_VIEW, { enforce: false }), getIncomeVsExpense);
router.get("/monthly-spending", authorize(PERMISSIONS.ANALYTICS_VIEW, { enforce: false }), getMonthlySpending);
router.get("/weekly-spending", authorize(PERMISSIONS.ANALYTICS_VIEW, { enforce: false }), getWeeklySpending);
router.get("/cash-flow", authorize(PERMISSIONS.ANALYTICS_VIEW, { enforce: false }), getCashFlow);
router.get("/savings-growth", authorize(PERMISSIONS.ANALYTICS_VIEW, { enforce: false }), getSavingsGrowth);

module.exports = router;
