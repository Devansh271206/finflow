const express = require("express");
const { body, param } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
} = require("../controllers/companyController");

const router = express.Router();

// Full chain: authenticate -> resolveWorkspace -> authorize -> controller
router.use(authenticate);
router.use(resolveWorkspace);

router.get("/", getCompanies);

router.get("/:id", [param("id").notEmpty()], validateRequest, getCompanyById);

router.post(
  "/",
  [body("name").notEmpty().withMessage("Company name is required")],
  validateRequest,
  createCompany
);

router.patch(
  "/:id",
  [param("id").notEmpty()],
  validateRequest,
  authorize(PERMISSIONS.COMPANY_MANAGE),
  updateCompany
);

module.exports = router;
