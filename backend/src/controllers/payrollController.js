const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const payrollService = require("../services/payrollService");

// @desc    List payroll records for an employee (row-level, grant-gated
//          for HR/Admin viewing someone else; self-service, no grant
//          needed, when the caller is viewing their own records — see
//          allowSelfOrPayrollRead in payrollRoutes.js)
// @route   GET /api/employees/:employeeId/payroll
// @access  Private (payroll.read + active salary.read_department grant,
//          OR own employee record)
const listPayrollForEmployee = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;
  const data = req.isSelf
    ? await payrollService.listOwnPayslips(employeeId, req.workspace.id, req.user.id)
    : await payrollService.listForEmployee(
        employeeId,
        req.workspace.id,
        req.membership?.id,
        req.user.id
      );

  return sendSuccess(res, { message: "Payroll records fetched successfully", data });
});

// @desc    Create a new payroll record for an employee
// @route   POST /api/employees/:employeeId/payroll
// @access  Private (payroll.manage — Admin/HR only)
const createPayrollRecord = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;
  const {
    payPeriodMonth,
    payPeriodYear,
    baseSalary,
    allowancesTotal,
    bonusTotal,
    taxDeducted,
    otherDeductions,
    netSalary,
  } = req.body;

  const { record, warnings } = await payrollService.createRecord(
    employeeId,
    req.workspace.id,
    {
      payPeriodMonth: Number(payPeriodMonth),
      payPeriodYear: Number(payPeriodYear),
      baseSalary: Number(baseSalary),
      allowancesTotal: allowancesTotal !== undefined ? Number(allowancesTotal) : undefined,
      bonusTotal: bonusTotal !== undefined ? Number(bonusTotal) : undefined,
      taxDeducted: taxDeducted !== undefined ? Number(taxDeducted) : undefined,
      otherDeductions: otherDeductions !== undefined ? Number(otherDeductions) : undefined,
      netSalary: Number(netSalary),
    },
    req.user.id
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: warnings.length > 0 ? "Payroll record created with warnings" : "Payroll record created",
    data: { record, warnings },
  });
});

// @desc    Upload a payslip file for an existing payroll record
// @route   POST /api/employees/:employeeId/payroll/:recordId/payslip
// @access  Private (payroll.manage — Admin/HR only)
const uploadPayslip = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId, recordId } = req.params;
  const data = await payrollService.uploadPayslip(
    employeeId,
    req.workspace.id,
    recordId,
    req.file
  );

  return sendSuccess(res, { message: "Payslip uploaded successfully", data });
});

// @desc    Get a fresh signed URL for a payroll record's payslip
// @route   GET /api/employees/:employeeId/payroll/:recordId/payslip
// @access  Private (payroll.read + active salary.read_department grant,
//          OR own employee record)
const getPayslipUrl = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId, recordId } = req.params;
  const url = req.isSelf
    ? await payrollService.getOwnPayslipUrl(employeeId, req.workspace.id, recordId, req.user.id)
    : await payrollService.getPayslipUrl(
        employeeId,
        req.workspace.id,
        recordId,
        req.membership?.id,
        req.user.id
      );

  return sendSuccess(res, { message: "Payslip URL generated", data: { url } });
});

// @desc    Aggregate payroll summary for a workspace/period — no
//          employee-level rows, backs Finance's "aggregate-only"
//          visibility (PRD §13.3)
// @route   GET /api/payroll/summary
// @access  Private (payroll.read_aggregate)
const getAggregateSummary = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { month, year } = req.query;
  const data = await payrollService.getAggregateSummary(req.workspace.id, {
    month: month ? Number(month) : undefined,
    year: year ? Number(year) : undefined,
  });

  return sendSuccess(res, { message: "Payroll summary fetched successfully", data });
});

// @desc    Bulk-import payroll records from a CSV file
// @route   POST /api/payroll/import
// @access  Private (payroll.manage — Admin/HR only)
const importPayrollCsv = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  if (!req.file) throw new ApiError(400, "A CSV file is required");

  const csvText = req.file.buffer.toString("utf-8");
  const data = await payrollService.importCsv(req.workspace.id, csvText, req.user.id);

  return sendSuccess(res, { message: "CSV import complete", data });
});

module.exports = {
  listPayrollForEmployee,
  createPayrollRecord,
  uploadPayslip,
  getPayslipUrl,
  getAggregateSummary,
  importPayrollCsv,
};
