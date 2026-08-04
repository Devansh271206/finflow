const express = require("express");
const { query } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const { upload } = require("../utils/upload");
const { getAggregateSummary, importPayrollCsv } = require("../controllers/payrollController");

// Top-level workspace routes — distinct from payrollRoutes.js (which is
// nested under /api/employees/:employeeId/payroll for row-level CRUD).
// These two endpoints aren't about a single employee: the summary is a
// workspace-wide aggregate, and import creates rows for potentially
// many employees in one request.
const router = express.Router();

router.use(protect);
router.use(resolveWorkspace);

// PAYROLL_READ_AGGREGATE is a distinct permission from PAYROLL_READ —
// backs Finance's "aggregate-only" visibility (PRD §13.3) without
// granting row-level access. Does NOT require the
// salary.read_department grant, since no individual salary/CTC figures
// are exposed by this endpoint.
router.get(
  "/summary",
  authorize(PERMISSIONS.PAYROLL_READ_AGGREGATE),
  [
    query("month").optional().isInt({ min: 1, max: 12 }),
    query("year").optional().isInt({ min: 2000, max: 2100 }),
  ],
  validateRequest,
  getAggregateSummary
);

router.post(
  "/import",
  authorize(PERMISSIONS.PAYROLL_MANAGE),
  upload.single("file"),
  importPayrollCsv
);

module.exports = router;
