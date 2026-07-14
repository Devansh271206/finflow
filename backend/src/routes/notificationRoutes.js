/**
 * Note: not listed in the originally requested routes/ folder structure,
 * but added here since the spec explicitly requires a full Notifications
 * CRUD API (requirement #9). Mounted at /api/notifications in app.js.
 */
const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const validateRequest = require("../middleware/validateRequest");
const {
  getNotifications,
  createNotification,
  updateNotification,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace); // Phase 1: optional X-Workspace-Id resolution, non-breaking (see resolveWorkspace.js)

router.get("/", getNotifications);

router.post(
  "/",
  [body("title").notEmpty().withMessage("Title is required"), body("message").notEmpty().withMessage("Message is required")],
  validateRequest,
  createNotification
);

router.put("/read-all", markAllAsRead);

router.put("/:id", [param("id").notEmpty()], validateRequest, updateNotification);

router.delete("/:id", [param("id").notEmpty()], validateRequest, deleteNotification);

module.exports = router;
