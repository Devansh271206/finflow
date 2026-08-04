const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getVendors,
  getVendorById,
  getSubscriptions,
  getVendorAnalytics,
  createVendor,
  updateVendor,
} = require("../controllers/vendorController");

// Sprint 3: this file was an empty stub before this sprint — never even
// required in app.js, so every vendor endpoint 404'd regardless of what
// vendorController.js already implemented (see original audit findings).
// Enforcing RBAC from the start, no log-only rollout period, matching
// how Sprint 2's new PERMISSION_GRANTS_MANAGE routes were also landed
// directly enforcing rather than log-only — this is new surface, not an
// existing route being tightened.
const router = express.Router();

router.use(protect);
router.use(resolveWorkspace);

// Static sub-paths (/subscriptions, /analytics) are registered BEFORE
// the /:id param route below, so they aren't swallowed by it — same
// ordering concern as any Express router with a catch-all param route.
router.get("/subscriptions", authorize(PERMISSIONS.VENDORS_READ), getSubscriptions);
router.get("/analytics", authorize(PERMISSIONS.VENDORS_READ), getVendorAnalytics);

router.get("/", authorize(PERMISSIONS.VENDORS_READ), getVendors);

router.get(
  "/:id",
  authorize(PERMISSIONS.VENDORS_READ),
  [param("id").isUUID()],
  validateRequest,
  getVendorById
);

router.post(
  "/",
  authorize(PERMISSIONS.VENDORS_MANAGE),
  [
    body("name").trim().notEmpty().withMessage("Vendor name is required"),
    body("contactEmail").optional({ nullable: true, checkFalsy: true }).isEmail(),
    body("isSubscription").optional().isBoolean(),
    body("billingCycle")
      .optional({ nullable: true, checkFalsy: true })
      .isIn(["monthly", "quarterly", "annual", "one_time"]),
    body("autoRenew").optional().isBoolean(),
    body("licenseCount").optional({ nullable: true }).isInt({ min: 0 }),
    body("licenseUsed").optional({ nullable: true }).isInt({ min: 0 }),
    body("ownerDepartmentId").optional({ nullable: true, checkFalsy: true }).isUUID(),
    body("nextBillingDate").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  ],
  validateRequest,
  createVendor
);

router.patch(
  "/:id",
  authorize(PERMISSIONS.VENDORS_MANAGE),
  [
    param("id").isUUID(),
    body("name").optional().trim().notEmpty(),
    body("contactEmail").optional({ nullable: true, checkFalsy: true }).isEmail(),
    body("isSubscription").optional().isBoolean(),
    body("billingCycle")
      .optional({ nullable: true, checkFalsy: true })
      .isIn(["monthly", "quarterly", "annual", "one_time"]),
    body("autoRenew").optional().isBoolean(),
    body("licenseCount").optional({ nullable: true }).isInt({ min: 0 }),
    body("licenseUsed").optional({ nullable: true }).isInt({ min: 0 }),
    body("ownerDepartmentId").optional({ nullable: true, checkFalsy: true }).isUUID(),
    body("nextBillingDate").optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body("status").optional().isIn(["pending_review", "reviewed"]),
    body("is_active").optional().isBoolean(),
  ],
  validateRequest,
  updateVendor
);

// No DELETE route — soft-delete only via PATCH { is_active: false },
// matching vendorController.js's own header comment and the same rule
// already applied to departments/employees.

module.exports = router;
