/**
 * Notification Routes
 * ------------------------------------------------------------------
 * Sprint 14 rewrite. Previously used `protect` + optional
 * `resolveWorkspace` (a pre-Sprint-9 pattern, inconsistent with every
 * other module). Now follows the standard
 * authenticate -> resolveWorkspace -> authorize chain, same as
 * holidayRoutes.js/departmentRoutes.js/etc.
 *
 * All previously-existing paths and verbs are preserved exactly:
 *   GET    /            (now paginated, but same path/verb)
 *   POST   /            (repurposed: announcement broadcast, same path/verb)
 *   PUT    /read-all
 *   PUT    /:id
 *   DELETE /:id
 * Plus one new route: GET /unread-count (navbar bell badge).
 *
 * Read routes (GET /, GET /unread-count, PUT :id, PUT read-all,
 * DELETE :id) require no special permission beyond authentication —
 * they only ever operate on the caller's own notifications
 * (enforced in notificationService.js via user_id-scoped repository
 * calls), so there is nothing to gate with authorize() the way
 * holidays/activity are gated for workspace-wide resources.
 *
 * POST / (announcement broadcast) is the one privileged action here —
 * gated by notifications.manage, now correctly seeded per migration 020.
 */

const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getNotifications,
  getUnreadCount,
  createAnnouncement,
  updateNotification,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(authenticate);
router.use(resolveWorkspace);

router.get(
  "/",
  [
    query("page").optional({ nullable: true }).isInt({ min: 1 }),
    query("limit").optional({ nullable: true }).isInt({ min: 1, max: 100 }),
    query("search").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    query("type").optional({ nullable: true }).isString().trim(),
    query("is_read").optional({ nullable: true }).isBoolean(),
  ],
  validateRequest,
  getNotifications
);

// IMPORTANT: registered before PUT /:id / DELETE /:id equivalents
// aren't ambiguous here since this is a distinct path segment
// ("unread-count" is not a UUID param collision risk the way
// holidayRoutes.js's /range needed ordering protection against
// /:id — GET has no :id route at this path level), but kept above
// the mutation routes for readability/grouping.
router.get("/unread-count", getUnreadCount);

router.post(
  "/",
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("message").optional({ nullable: true }).isString().trim(),
  ],
  validateRequest,
  authorize(PERMISSIONS.NOTIFICATIONS_MANAGE),
  createAnnouncement
);

router.put("/read-all", markAllAsRead);

router.put(
  "/:id",
  [param("id").notEmpty().withMessage("id is required"), body("isRead").optional({ nullable: true }).isBoolean()],
  validateRequest,
  updateNotification
);

router.delete("/:id", [param("id").notEmpty().withMessage("id is required")], validateRequest, deleteNotification);

module.exports = router;
