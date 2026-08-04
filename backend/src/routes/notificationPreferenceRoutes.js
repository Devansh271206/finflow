const express = require("express");
const { param, body } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const validateRequest = require("../middleware/validateRequest");
const { getPreferences, updatePreference } = require("../controllers/notificationPreferenceController");

const router = express.Router();

// No authorize() call — every route here only ever reads/writes the
// caller's own notification_preferences row (enforced by
// notificationPreferenceRepository's user_id-scoped queries), same
// reasoning notificationRoutes.js already documents for its own
// non-privileged routes.
router.use(authenticate);
router.use(resolveWorkspace);

router.get("/", getPreferences);

router.put(
  "/:eventType",
  [param("eventType").notEmpty(), body("isEnabled").isBoolean().withMessage("isEnabled must be a boolean")],
  validateRequest,
  updatePreference
);

module.exports = router;
