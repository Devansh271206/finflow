const express = require("express");
const { body, param } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
} = require("../controllers/invitationController");

const router = express.Router();

// Create an invitation — only workspace admins/finance-ops (team.invite).
router.post(
  "/",
  authenticate,
  resolveWorkspace,
  [
    body("email").isEmail().normalizeEmail().withMessage("A valid email is required"),
    body("role_id").notEmpty().withMessage("role_id is required"),
    body("department_id").optional({ nullable: true }),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAM_INVITE),
  createInvitation
);

// Public token lookup for the /invite join page (token is the secret).
router.get(
  "/:token",
  [param("token").isLength({ min: 32 }).withMessage("Invalid invitation token")],
  validateRequest,
  getInvitationByToken
);

// Authenticated accept — no resolveWorkspace: the user is not a member yet.
router.post(
  "/:token/accept",
  authenticate,
  [param("token").isLength({ min: 32 }).withMessage("Invalid invitation token")],
  validateRequest,
  acceptInvitation
);

module.exports = router;
