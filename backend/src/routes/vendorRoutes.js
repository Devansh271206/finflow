const express = require("express");
const { body, param } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
} = require("../controllers/vendorController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

router.get("/", authorize(PERMISSIONS.VENDORS_READ), getVendors);

router.get(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.VENDORS_READ),
  getVendorById
);

router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Vendor name is required"),
    body("contactEmail").optional().isEmail().withMessage("contactEmail must be a valid email"),
  ],
  validateRequest,
  authorize(PERMISSIONS.VENDORS_MANAGE),
  createVendor
);

router.patch(
  "/:id",
  [
    param("id").notEmpty(),
    body("name").optional().trim().notEmpty().withMessage("Vendor name cannot be empty"),
    body("contactEmail").optional().isEmail().withMessage("contactEmail must be a valid email"),
    body("is_active").optional().isBoolean().withMessage("is_active must be a boolean"),
  ],
  validateRequest,
  authorize(PERMISSIONS.VENDORS_MANAGE),
  updateVendor
);

// No DELETE route — vendors are soft-deleted via PATCH { is_active: false }
// only, same rationale as departments (never hard-delete an entity with
// transaction history).

module.exports = router;