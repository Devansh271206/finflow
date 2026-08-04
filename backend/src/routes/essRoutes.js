/**
 * ESS (Employee Self-Service) Routes
 * ------------------------------------------------------------------
 * Sprint 13. Mounted at /api/ess in app.js. Ungated by a role
 * permission — same pattern as profileRoutes.js/notificationRoutes.js
 * — since every field returned is already self-scoped inside
 * essService.
 */

const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { getMyOverview } = require("../controllers/essController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace);

router.get("/overview", getMyOverview);

module.exports = router;
