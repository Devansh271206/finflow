const express = require("express");
const { param, body, query } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { requirePlatformAdmin } = require("../middleware/requirePlatformAdmin");
const validateRequest = require("../middleware/validateRequest");
const {
  listOrganizations,
  getOrganization,
  activateOrganization,
  suspendOrganization,
  deleteOrganization,
  getDashboard,
  getAnalytics,
} = require("../controllers/platformAdminController");
const { createCompany } = require("../controllers/companyController");

const router = express.Router();

// Platform admin chain: protect -> requirePlatformAdmin -> controller.
// Deliberately does NOT run resolveWorkspace/authorize — see
// requirePlatformAdmin.js's header comment for why platform routes are
// structurally separate from every company/workspace-scoped route.
router.use(protect);
router.use(requirePlatformAdmin);

router.get("/dashboard", getDashboard);
router.get("/analytics", getAnalytics);

router.get(
  "/organizations",
  [query("status").optional().isIn(["active", "suspended"])],
  validateRequest,
  listOrganizations
);

// Organization creation reuses companyController.createCompany as-is
// (already validated, already tested via the self-service company
// signup flow) rather than duplicating create logic here — see
// platformAdminController.js's header note. One known v1 limitation
// worth restating: createCompany sets owner_user_id to the caller
// (req.user.id), so an org created by a Platform Admin will show that
// Platform Admin as owner_user_id, which is semantically slightly off
// (a Platform Admin isn't meant to "own" a company the way a customer
// does) but functionally harmless for v1 — no code path currently
// treats owner_user_id as anything other than "who can self-manage
// this company's profile," and revisiting that model is out of scope
// for this sprint.
router.post(
  "/organizations",
  [body("name").notEmpty().withMessage("Organization name is required")],
  validateRequest,
  createCompany
);

router.get("/organizations/:id", [param("id").notEmpty()], validateRequest, getOrganization);

router.post(
  "/organizations/:id/activate",
  [param("id").notEmpty()],
  validateRequest,
  activateOrganization
);

router.post(
  "/organizations/:id/suspend",
  [param("id").notEmpty()],
  validateRequest,
  suspendOrganization
);

router.delete("/organizations/:id", [param("id").notEmpty()], validateRequest, deleteOrganization);

module.exports = router;
