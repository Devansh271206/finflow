const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const { getDashboard } = require("../controllers/dashboardController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace); // Phase 1: optional X-Workspace-Id resolution, non-breaking (see resolveWorkspace.js)

// Sprint 1: previously had no permission check at all beyond being
// authenticated — any role could view any workspace's dashboard. Wired
// to the existing (until now unused) DASHBOARD_VIEW permission key, in
// enforcing mode to match transactions/budgets/employees this sprint.
router.get("/", authorize(PERMISSIONS.DASHBOARD_VIEW), getDashboard);

module.exports = router;
