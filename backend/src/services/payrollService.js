/**
 * Payroll Service
 * ------------------------------------------------------------------
 * Business logic for payroll_records. Three things distinguish this
 * from a plain CRUD service:
 *
 * 1. Individual row reads require the SAME salary.read_department grant
 *    as salary_history (PRD §13.3 groups them explicitly), checked and
 *    audit-logged the same way salaryHistoryService.js already does —
 *    reusing that exact mechanism, not a parallel one.
 *
 * 2. Finance's visibility is "aggregate-only" (§13.3) — a genuinely
 *    different permission (PAYROLL_READ_AGGREGATE) backing a
 *    department/period summary with no employee-level figures at all,
 *    not a weaker check on the row-level permission.
 *
 * 3. Two non-blocking validation WARNINGS (PRD §18.2 explicitly calls
 *    this pattern out: "validation warning, not a hard block"):
 *      - net_salary arithmetic mismatch (base + allowances + bonus -
 *        tax - other != net_salary)
 *      - stale base_salary vs. the employee's most recent
 *        salary_history revision as of this pay period
 *    Neither prevents the record from being saved — PRD is explicit
 *    that payroll is a "record store only", so the tool warns but the
 *    recorder has the final say on what actually happened.
 */

const payrollRepository = require("../repositories/payrollRepository");
const employeeRepository = require("../repositories/employeeRepository");
const salaryHistoryRepository = require("../repositories/salaryHistoryRepository");
const membershipPermissionGrantService = require("../services/membershipPermissionGrantService");
const auditLogRepository = require("../repositories/auditLogRepository");
const { parseCsv } = require("../utils/csvParser");
const { uploadPrivateFile, getSignedDocumentUrl } = require("../utils/upload");
const { supabaseAdmin } = require("../config/supabase");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const ApiError = require("../utils/ApiError");
const eventBusService = require("./eventBusService");
const { EVENT_TYPES } = require("../events/eventTypes");

async function assertEmployeeInWorkspace(employeeId, workspaceId) {
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found");
  return employee;
}

async function assertPayrollReadGranted(membershipId) {
  const granted = await membershipPermissionGrantService.hasActiveGrant(
    membershipId,
    PERMISSIONS.SALARY_READ_DEPARTMENT
  );
  if (!granted) {
    throw new ApiError(
      403,
      "Viewing individual payroll records requires an active salary.read_department grant, which is not implied by your role."
    );
  }
}

/**
 * Computes the two non-blocking warnings described above. Returns an
 * array (empty if nothing to flag) — never throws; these are always
 * advisory.
 */
async function computeWarnings(employeeId, { payPeriodMonth, payPeriodYear, baseSalary, allowancesTotal, bonusTotal, taxDeducted, otherDeductions, netSalary }) {
  const warnings = [];

  const expectedNet =
    Number(baseSalary) + Number(allowancesTotal || 0) + Number(bonusTotal || 0) -
    Number(taxDeducted || 0) - Number(otherDeductions || 0);
  if (Math.abs(expectedNet - Number(netSalary)) > 0.01) {
    warnings.push(
      `net_salary (${netSalary}) does not match base + allowances + bonus - tax - other_deductions ` +
        `(computed: ${expectedNet.toFixed(2)}). Saved as entered — this is a warning, not a block.`
    );
  }

  const history = await salaryHistoryRepository.listByEmployee(employeeId);
  if (history.length > 0) {
    // history is already ordered most-recent-first (effective_date DESC)
    const mostRecent = history[0];
    const payPeriodEnd = new Date(payPeriodYear, payPeriodMonth, 0); // last day of pay_period_month
    const revisionDate = new Date(mostRecent.effective_date);
    if (revisionDate <= payPeriodEnd && Number(mostRecent.base_salary) !== Number(baseSalary)) {
      warnings.push(
        `A salary revision effective ${mostRecent.effective_date} set base_salary to ${mostRecent.base_salary}, ` +
          `but this payroll entry uses ${baseSalary}. Saved as entered — this is a warning, not a block.`
      );
    }
  }

  return warnings;
}

/**
 * Lists payroll records for one employee — row-level, salary-grant
 * gated, audit-logged. Mirrors salaryHistoryService.listForEmployee()
 * almost exactly.
 */
async function listForEmployee(employeeId, workspaceId, membershipId, actorUserId) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);
  await assertPayrollReadGranted(membershipId);

  const rows = await payrollRepository.listByEmployee(employeeId);

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "payroll_records.read",
      resourceType: "employee",
      resourceId: employeeId,
      metadata: { rowCount: rows.length },
    });
  } catch (auditError) {
    // eslint-disable-next-line no-console
    console.error("[auditLogRepository] Failed to record payroll_records.read:", auditError.message);
  }

  return rows;
}

/**
 * Creates a new payroll record. Enforces the (employee_id,
 * pay_period_month, pay_period_year) uniqueness with a clear 409
 * before hitting the DB constraint, and returns any non-blocking
 * warnings alongside the created record.
 */
async function createRecord(employeeId, workspaceId, payload, recordedBy) {
  const employee = await assertEmployeeInWorkspace(employeeId, workspaceId);

  const {
    payPeriodMonth,
    payPeriodYear,
    baseSalary,
    allowancesTotal,
    bonusTotal,
    taxDeducted,
    otherDeductions,
    netSalary,
  } = payload;

  if (!payPeriodMonth || payPeriodMonth < 1 || payPeriodMonth > 12) {
    throw new ApiError(400, "payPeriodMonth must be between 1 and 12");
  }
  if (!payPeriodYear || payPeriodYear < 2000 || payPeriodYear > 2100) {
    throw new ApiError(400, "payPeriodYear is required");
  }
  if (baseSalary === undefined || Number(baseSalary) < 0) {
    throw new ApiError(400, "baseSalary is required and must be non-negative");
  }
  if (netSalary === undefined || Number(netSalary) < 0) {
    throw new ApiError(400, "netSalary is required and must be non-negative");
  }

  const existing = await payrollRepository.findByEmployeeAndPeriod(
    employeeId,
    payPeriodMonth,
    payPeriodYear
  );
  if (existing) {
    throw new ApiError(
      409,
      `A payroll record for this employee already exists for ${payPeriodMonth}/${payPeriodYear}`
    );
  }

  const warnings = await computeWarnings(employeeId, payload);

  const record = await payrollRepository.create({
    workspace_id: workspaceId,
    employee_id: employeeId,
    pay_period_month: payPeriodMonth,
    pay_period_year: payPeriodYear,
    base_salary: baseSalary,
    allowances_total: allowancesTotal || 0,
    bonus_total: bonusTotal || 0,
    tax_deducted: taxDeducted || 0,
    other_deductions: otherDeductions || 0,
    net_salary: netSalary,
    recorded_by: recordedBy,
  });

  if (employee.user_id) {
    eventBusService.publish(EVENT_TYPES.PAYROLL_GENERATED, {
      workspaceId,
      actorUserId: recordedBy,
      recipientUserIds: [employee.user_id],
      module: "Payroll",
      resourceType: "payroll_record",
      resourceId: record.id,
      title: "Your payslip is ready",
      message: `${payPeriodMonth}/${payPeriodYear}`,
      actionUrl: `/portal?tab=payroll`,
      metadata: { payPeriodMonth, payPeriodYear, netSalary },
    });
  }

  return { record, warnings };
}

/**
 * Aggregate summary for a workspace/period — backs Finance's
 * "aggregate-only" visibility (PAYROLL_READ_AGGREGATE, no
 * salary.read_department grant needed, and no employee-level rows
 * returned at all). Grouped by department via a JS join against
 * employeeRepository, same aggregation-in-JS pattern established for
 * budgets/analytics/vendor spend elsewhere in this codebase.
 */
async function getAggregateSummary(workspaceId, { month, year } = {}) {
  const [records, { rows: employees }] = await Promise.all([
    payrollRepository.listForWorkspace(workspaceId, { month, year }),
    employeeRepository.listByWorkspace(workspaceId),
  ]);

  const departmentIdByEmployee = new Map(employees.map((e) => [e.id, e.department_id]));

  const byDepartment = new Map();
  let totalNet = 0;
  let totalBase = 0;

  for (const r of records) {
    const deptId = departmentIdByEmployee.get(r.employee_id) || "unassigned";
    const bucket = byDepartment.get(deptId) || { departmentId: deptId, totalNet: 0, totalBase: 0, headcount: 0 };
    bucket.totalNet += Number(r.net_salary);
    bucket.totalBase += Number(r.base_salary);
    bucket.headcount += 1;
    byDepartment.set(deptId, bucket);

    totalNet += Number(r.net_salary);
    totalBase += Number(r.base_salary);
  }

  return {
    totalNet,
    totalBase,
    recordCount: records.length,
    byDepartment: [...byDepartment.values()],
  };
}

/**
 * Bulk-imports payroll records from a CSV (PRD §15.3/Phase 3: "payroll
 * records + CSV import" — explicitly manual entry or CSV import, never
 * a live payroll-processor integration, per §21). See utils/csvParser.js
 * for this parser's stated limitations.
 *
 * Expected columns (case-sensitive, matches createRecord's field names):
 *   employeeId OR employeeEmail (one of the two, employeeId takes
 *   precedence if both are present), payPeriodMonth, payPeriodYear,
 *   baseSalary, allowancesTotal, bonusTotal, taxDeducted,
 *   otherDeductions, netSalary
 *
 * Row-level failures (duplicate period, unresolvable employee,
 * validation error) do NOT abort the batch — each row is attempted
 * independently and the caller gets a per-row success/failure report,
 * since a bad row shouldn't block 50 good ones in the same file.
 */
async function importCsv(workspaceId, csvText, recordedBy) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new ApiError(400, "CSV file is empty or could not be parsed");
  }

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 for header row, +1 for 1-indexing

    try {
      let employeeId = row.employeeId;
      if (!employeeId && row.employeeEmail) {
        const employee = await employeeRepository.findByEmailInWorkspace(
          workspaceId,
          row.employeeEmail
        );
        if (!employee) {
          throw new ApiError(404, `No employee found with email ${row.employeeEmail}`);
        }
        employeeId = employee.id;
      }
      if (!employeeId) {
        throw new ApiError(400, "Row must include employeeId or employeeEmail");
      }

      const { record, warnings } = await createRecord(
        employeeId,
        workspaceId,
        {
          payPeriodMonth: Number(row.payPeriodMonth),
          payPeriodYear: Number(row.payPeriodYear),
          baseSalary: Number(row.baseSalary),
          allowancesTotal: Number(row.allowancesTotal || 0),
          bonusTotal: Number(row.bonusTotal || 0),
          taxDeducted: Number(row.taxDeducted || 0),
          otherDeductions: Number(row.otherDeductions || 0),
          netSalary: Number(row.netSalary),
        },
        recordedBy
      );

      results.push({ row: rowNumber, success: true, record, warnings });
    } catch (err) {
      results.push({
        row: rowNumber,
        success: false,
        error: err.message || "Unknown error",
      });
    }
  }

  return {
    totalRows: rows.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Uploads a payslip file for an existing payroll record. Signed-URL
 * storage pattern, same as employee_documents (Sprint 2) and
 * attachments (Sprint 4) — never a permanent public link, since a
 * payslip is at least as sensitive as the salary data it's built from.
 */
async function uploadPayslip(employeeId, workspaceId, recordId, file) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);

  const record = await payrollRepository.findByIdForEmployee(recordId, employeeId);
  if (!record) throw new ApiError(404, "Payroll record not found");

  if (!file) throw new ApiError(400, "A file is required");

  const storagePath = await uploadPrivateFile(
    supabaseAdmin,
    file,
    `payslips/${employeeId}`
  );

  return payrollRepository.updatePayslipPath(recordId, storagePath);
}

/**
 * Generates a fresh signed URL for a payroll record's payslip. Gated
 * by the same salary.read_department grant + audit log as row-level
 * reads — a payslip is not less sensitive than the row it belongs to.
 */
async function getPayslipUrl(employeeId, workspaceId, recordId, membershipId, actorUserId) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);
  await assertPayrollReadGranted(membershipId);

  const record = await payrollRepository.findByIdForEmployee(recordId, employeeId);
  if (!record) throw new ApiError(404, "Payroll record not found");
  if (!record.payslip_storage_path) {
    throw new ApiError(404, "No payslip has been uploaded for this record");
  }

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "payroll_records.payslip_read",
      resourceType: "payroll_record",
      resourceId: recordId,
      metadata: {},
    });
  } catch (auditError) {
    // eslint-disable-next-line no-console
    console.error(
      "[auditLogRepository] Failed to record payroll_records.payslip_read:",
      auditError.message
    );
  }

  return getSignedDocumentUrl(supabaseAdmin, record.payslip_storage_path);
}

/**
 * Sprint 10 (Role-Based Dashboard System): self-service payroll listing
 * for the Employee Dashboard's "My Payslips" widget. Deliberately does
 * NOT call assertPayrollReadGranted() — that grant exists to gate a
 * manager/HR viewing an employee's records, which is a different
 * concern from an employee viewing their OWN records. Still confirms
 * the employee actually belongs to this workspace (defense-in-depth,
 * same as every other function here), and is still audit-logged for
 * traceability, just without the 403 a plain employee would otherwise
 * hit going through listForEmployee().
 */
async function listOwnPayslips(employeeId, workspaceId, actorUserId) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);

  const rows = await payrollRepository.listByEmployee(employeeId);

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "payroll_records.read_own",
      resourceType: "employee",
      resourceId: employeeId,
      metadata: { rowCount: rows.length },
    });
  } catch (auditError) {
    // eslint-disable-next-line no-console
    console.error("[auditLogRepository] Failed to record payroll_records.read_own:", auditError.message);
  }

  return rows;
}

/**
 * Sprint 13 (Employee Self-Service Portal): own-payslip-download
 * counterpart to listOwnPayslips() above, for the My Payroll tab.
 * Deliberately mirrors getPayslipUrl() but — same rationale as
 * listOwnPayslips() vs listForEmployee() — does NOT call
 * assertPayrollReadGranted(), since that grant gates a manager/HR
 * viewing someone ELSE's payslip, not an employee viewing their own.
 */
async function getOwnPayslipUrl(employeeId, workspaceId, recordId, actorUserId) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);

  const record = await payrollRepository.findByIdForEmployee(recordId, employeeId);
  if (!record) throw new ApiError(404, "Payroll record not found");
  if (!record.payslip_storage_path) {
    throw new ApiError(404, "No payslip has been uploaded for this record");
  }

  try {
    await auditLogRepository.record({
      workspaceId,
      actorUserId,
      action: "payroll_records.payslip_read_own",
      resourceType: "payroll_record",
      resourceId: recordId,
      metadata: {},
    });
  } catch (auditError) {
    // eslint-disable-next-line no-console
    console.error(
      "[auditLogRepository] Failed to record payroll_records.payslip_read_own:",
      auditError.message
    );
  }

  return getSignedDocumentUrl(supabaseAdmin, record.payslip_storage_path);
}

module.exports = {
  listForEmployee,
  listOwnPayslips,
  createRecord,
  getAggregateSummary,
  importCsv,
  uploadPayslip,
  getPayslipUrl,
  getOwnPayslipUrl,
  assertEmployeeInWorkspace,
};
