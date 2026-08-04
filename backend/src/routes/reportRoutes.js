const express = require("express");
const { param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const validateRequest = require("../middleware/validateRequest");
const { REPORT_IDS } = require("../config/reportRegistry");
const { listReports, getReport, exportReport } = require("../controllers/reportController");

const router = express.Router();

router.use(protect);
router.use(resolveWorkspace);

// :reportId is validated against the live registry (not just "is a
// string") so an unknown id 404s cleanly via reportController's own
// getReportConfig() check, rather than reaching the service layer —
// this just gives a fast, consistent 400 for obviously-bad ids first.
const validateReportId = [
  param("reportId").isIn(REPORT_IDS).withMessage("Unknown report id"),
  validateRequest,
];

router.get("/", listReports);
router.get("/:reportId", validateReportId, getReport);
router.get("/:reportId/export", validateReportId, exportReport);

module.exports = router;
