const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  listGrants,
  createGrant,
  revokeGrant,
} = require("../controllers/membershipPermissionGrantController");

// mergeParams so :membershipId from the parent mount path (see app.js —
// mounted at /api/memberships/:membershipId/permission-grants) is
// visible on req.params here, same pattern needed for
// salaryHistoryRoutes.js/employeeDocumentRoutes.js nested under
// /api/employees/:employeeId/*.
const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(resolveWorkspace);

// New, security-sensitive surface (Sprint 2) — gates who can grant/
// revoke the per-membership salary.read_department override. Enforcing
// from the start, no log-only rollout period, since this endpoint only
// exists to control access to the most sensitive data class in the
// system.
router.get(
  "/",
  authorize(PERMISSIONS.PERMISSION_GRANTS_MANAGE),
  [param("membershipId").isUUID()],
  validateRequest,
  listGrants
);

router.post(
  "/",
  authorize(PERMISSIONS.PERMISSION_GRANTS_MANAGE),
  [
    param("membershipId").isUUID(),
    body("permissionKey").trim().notEmpty().withMessage("permissionKey is required"),
  ],
  validateRequest,
  createGrant
);

router.delete(
  "/:grantId",
  authorize(PERMISSIONS.PERMISSION_GRANTS_MANAGE),
  [param("membershipId").isUUID(), param("grantId").isUUID()],
  validateRequest,
  revokeGrant
);

module.exports = router;
