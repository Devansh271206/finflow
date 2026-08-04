const express = require("express");
const { body, param } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const { upload } = require("../utils/upload");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const employeeRepository = require("../repositories/employeeRepository");
const {
  listPayrollForEmployee,
  createPayrollRecord,
  uploadPayslip,
  getPayslipUrl,
} = require("../controllers/payrollController");

// mergeParams: true so :employeeId from the parent mount path
// (app.js mounts this at /api/employees/:employeeId/payroll) is
// visible on req.params here.
const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(resolveWorkspace);

// Sprint 13 (Employee Self-Service Portal): read access (list + payslip
// URL) is allowed either via the existing PAYROLL_READ role permission
// + salary.read_department grant (HR/Admin/Manager viewing anyone —
// unchanged, still enforced inside payrollService.listForEmployee()/
// getPayslipUrl()) OR when the caller is viewing their own employee
// record (My Payroll tab). Sets req.isSelf so payrollController can
// route to payrollService.listOwnPayslips()/getOwnPayslipUrl(), which
// deliberately skip the grant check — that grant exists to gate a
// manager/HR viewing someone ELSE's payroll, not self-view. Write
// actions (create/upload) intentionally remain PAYROLL_MANAGE only.
const allowSelfOrPayrollRead = asyncHandler(async (req, res, next) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;
  const ownRecord = await employeeRepository.findByUserIdInWorkspace(
    req.user.id,
    req.workspace.id
  );

  if (ownRecord && ownRecord.id === employeeId) {
    req.isSelf = true;
    return next();
  }

  return authorize(PERMISSIONS.PAYROLL_READ)(req, res, next);
});

// Route-level check is PAYROLL_READ only — confirms the caller's ROLE
// can reach row-level payroll data at all (Admin/HR per PRD RBAC row
// 354). The ADDITIONAL, per-membership salary.read_department grant
// check happens inside payrollService.listForEmployee(), same split as
// salaryHistoryRoutes.js. Self-access (own employee record) bypasses
// both — see allowSelfOrPayrollRead above.
router.get(
  "/",
  [param("employeeId").isUUID()],
  validateRequest,
  allowSelfOrPayrollRead,
  listPayrollForEmployee
);

router.post(
  "/",
  authorize(PERMISSIONS.PAYROLL_MANAGE),
  [
    param("employeeId").isUUID(),
    body("payPeriodMonth").isInt({ min: 1, max: 12 }),
    body("payPeriodYear").isInt({ min: 2000, max: 2100 }),
    body("baseSalary").isFloat({ min: 0 }),
    body("netSalary").isFloat({ min: 0 }),
    body("allowancesTotal").optional().isFloat({ min: 0 }),
    body("bonusTotal").optional().isFloat({ min: 0 }),
    body("taxDeducted").optional().isFloat({ min: 0 }),
    body("otherDeductions").optional().isFloat({ min: 0 }),
  ],
  validateRequest,
  createPayrollRecord
);

router.post(
  "/:recordId/payslip",
  authorize(PERMISSIONS.PAYROLL_MANAGE),
  upload.single("file"),
  [param("employeeId").isUUID(), param("recordId").isUUID()],
  validateRequest,
  uploadPayslip
);

router.get(
  "/:recordId/payslip",
  [param("employeeId").isUUID(), param("recordId").isUUID()],
  validateRequest,
  allowSelfOrPayrollRead,
  getPayslipUrl
);

module.exports = router;
