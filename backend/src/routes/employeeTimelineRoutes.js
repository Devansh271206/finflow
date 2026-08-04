const express = require("express");
const { param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const { getEmployeeTimeline } = require("../controllers/employeeTimelineController");

// mergeParams: true so :employeeId from the parent mount path
// (app.js mounts this at /api/employees/:employeeId/timeline) is
// visible on req.params here.
const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(resolveWorkspace);

router.get(
  "/",
  authorize(PERMISSIONS.EMPLOYEES_READ),
  [param("employeeId").isUUID()],
  validateRequest,
  getEmployeeTimeline
);

module.exports = router;
