const express = require("express");
const { body } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const validateRequest = require("../middleware/validateRequest");
const { completeOnboarding } = require("../controllers/onboardingController");

const router = express.Router();

// Same chain as companyRoutes.js's POST / (createCompany): authenticate
// -> resolveWorkspace, no authorize() call. resolveWorkspace is
// confirmed non-blocking when the caller has no membership yet (see
// resolveWorkspace.js's own header comment) — there is deliberately no
// workspace to check a permission against until this endpoint creates
// one, so authorize() would have nothing meaningful to gate on.
router.use(authenticate);
router.use(resolveWorkspace);

router.post(
  "/complete",
  [
    body("organization_name").trim().notEmpty().withMessage("organization_name is required"),
    body("industry").optional({ nullable: true }).isString().trim(),
    body("company_size").optional({ nullable: true }).isString().trim(),
    body("country").optional({ nullable: true }).isString().trim(),
    body("currency").optional({ nullable: true }).isString().trim().isLength({ max: 10 }),
    body("time_zone").optional({ nullable: true }).isString().trim(),
    body("financial_year").optional({ nullable: true }).isString().trim(),
    body("working_days").optional({ nullable: true }).isArray(),
    body("office_hours").optional({ nullable: true }),
    body("weekend_config").optional({ nullable: true }),
    body("default_leave_policy").optional({ nullable: true }),
    body("default_expense_policy").optional({ nullable: true }),
  ],
  validateRequest,
  completeOnboarding
);

module.exports = router;
