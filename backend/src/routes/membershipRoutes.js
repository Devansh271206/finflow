const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getMembers,
  getMemberById,
  createMember,
  updateMemberRole,
  updateMemberDepartment,
  updateMemberStatus,
  removeMember,
} = require("../controllers/membershipController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

router.get(
  "/",
  [
    query("search").optional().trim(),
    query("role").optional().trim(),
    query("department").optional().trim(),
    query("status").optional().isIn(["active", "invited", "suspended"]),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAM_MANAGE),
  getMembers
);

router.post(
  "/",
  [
    body("email").isEmail().normalizeEmail().withMessage("A valid email is required"),
    body("role_id").notEmpty().withMessage("role_id is required"),
    body("department_id").optional({ nullable: true }),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAM_INVITE),
  createMember
);

router.get(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.TEAM_MANAGE),
  getMemberById
);

router.patch(
  "/:id/role",
  [param("id").notEmpty(), body("role_id").notEmpty().withMessage("role_id is required")],
  validateRequest,
  authorize(PERMISSIONS.TEAM_MANAGE),
  updateMemberRole
);

router.patch(
  "/:id/department",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.TEAM_MANAGE),
  updateMemberDepartment
);

router.patch(
  "/:id/status",
  [
    param("id").notEmpty(),
    body("status").isIn(["active", "suspended"]).withMessage("status must be 'active' or 'suspended'"),
  ],
  validateRequest,
  authorize(PERMISSIONS.TEAM_MANAGE),
  updateMemberStatus
);

// Soft-remove only — sets status to 'suspended'. See membershipController
// for rationale (memberships has no hard-delete path).
router.delete(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.TEAM_MANAGE),
  removeMember
);

module.exports = router;