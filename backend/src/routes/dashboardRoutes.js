const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { getDashboard } = require("../controllers/dashboardController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace); // Phase 1: optional X-Workspace-Id resolution, non-breaking (see resolveWorkspace.js)

router.get("/", getDashboard);

module.exports = router;
