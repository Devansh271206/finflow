const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const {
  getSalaryHistory,
  createSalaryRevision,
} = require("../controllers/salaryHistoryController");

// mergeParams: true so :employeeId from the parent mount path
// (app.js mounts this at /api/employees/:employeeId/salary-history) is
// visible on req.params here.
const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(resolveWorkspace);

// Route-level check is EMPLOYEES_READ only — confirms the caller can
// see employees at all. The ADDITIONAL, more specific
// salary.read_department grant check happens inside
// salaryHistoryService.listForEmployee(), not here, since that gate is
// per-membership rather than per-role and authorize() only understands
// role-based permissions.
router.get(
  "/",
  authorize(PERMISSIONS.EMPLOYEES_READ),
  [param("employeeId").isUUID()],
  validateRequest,
  getSalaryHistory
);

// Creating a revision is Admin/HR-only per PRD §13.2, enforced the same
// way employee create/update already is — EMPLOYEES_MANAGE — not the
// salary.read_department grant, since read-access and write-access are
// deliberately separate gates here.
router.post(
  "/",
  authorize(PERMISSIONS.EMPLOYEES_MANAGE),
  [
    param("employeeId").isUUID(),
    body("effectiveDate").isISO8601().withMessage("effectiveDate must be a valid date"),
    body("ctcAnnual").isFloat({ min: 0 }).withMessage("ctcAnnual must be a non-negative number"),
    body("baseSalary").isFloat({ min: 0 }).withMessage("baseSalary must be a non-negative number"),
    body("bonusAmount").optional().isFloat({ min: 0 }),
    body("allowances").optional().isObject(),
    body("revisionReason").optional().trim(),
  ],
  validateRequest,
  createSalaryRevision
);

module.exports = router;
