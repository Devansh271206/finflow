/**
 * Role Dashboard Routes
 * ------------------------------------------------------------------
 * Sprint 10 — Role-Based Dashboard System.
 *
 * Mounted alongside (not replacing) the existing dashboardRoutes.js —
 * see app.js, which mounts both under /api/dashboard. Same middleware
 * chain and permission key (DASHBOARD_VIEW) as the legacy dashboard
 * route: this endpoint is additive, not a stricter or looser gate.
 */

const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const { getRoleDashboard } = require("../controllers/roleDashboardController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace);

router.get("/role-summary", authorize(PERMISSIONS.DASHBOARD_VIEW), getRoleDashboard);

module.exports = router;
