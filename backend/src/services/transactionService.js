/**
 * Transaction Service
 * ------------------------------------------------------------------
 * Business logic for transactions: workspace-scoped validation of
 * vendor/employee/budget references before write, and validation of
 * the enterprise enum fields added in
 * migrations/002_enterprise_transactions.sql. Framework-agnostic per
 * PRD §10.1 layering — the controller stays thin and delegates here,
 * the same way budgetService/employeeService already do for their
 * resources.
 *
 * This file did not exist before the enterprise transaction refactor
 * (audit finding: transactionController talked to the repository
 * directly, unlike budgets/employees). It now owns the validation
 * that createTransaction/updateTransaction need before building their
 * insert/update payloads.
 */

const vendorRepository = require("../repositories/vendorRepository");
const employeeRepository = require("../repositories/employeeRepository");
const budgetRepository = require("../repositories/budgetRepository");
const categoryRepository = require("../repositories/categoryRepository");
const ApiError = require("../utils/ApiError");

const VALID_TRANSACTION_TYPES = [
  "income",
  "expense",
  "payroll",
  "reimbursement",
  "vendor_invoice",
  "transfer",
  "journal_entry",
];
// Sprint 4: widened from the original 3-value set (pending/approved/
// rejected) to the PRD §15.5 state machine, confirmed with product
// owner before this change — see migrations/
// 009_expense_approval_workflow.sql for the full rationale and the
// backfill this required.
const VALID_APPROVAL_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "reimbursed",
];
const VALID_PAYMENT_STATUSES = ["unpaid", "paid", "partially_paid"];

async function assertVendorInWorkspace(vendorId, workspaceId) {
  if (!vendorId) return;

  // Vendor Management (Sprint 3) has not shipped yet — vendorRepository.js
  // is currently an empty stub file with no exports, even though
  // vendorController.js is written against it. Without this guard, any
  // transaction submitted with a vendor_id would throw an unhandled
  // "vendorRepository.findByIdInWorkspace is not a function" TypeError.
  // Fail clearly instead until that repository is actually implemented.
  if (typeof vendorRepository.findByIdInWorkspace !== "function") {
    throw new ApiError(
      501,
      "Vendor management is not yet available — transactions cannot reference a vendor_id until it ships."
    );
  }

  const vendor = await vendorRepository.findByIdInWorkspace(vendorId, workspaceId);
  if (!vendor) throw new ApiError(404, "Vendor not found");
}

async function assertEmployeeInWorkspace(employeeId, workspaceId) {
  if (!employeeId) return;
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found");
}

async function assertBudgetInWorkspace(budgetId, workspaceId) {
  if (!budgetId) return;
  const budget = await budgetRepository.findByIdInWorkspace(budgetId, workspaceId);
  if (!budget) throw new ApiError(404, "Budget not found");
}

/**
 * Validates that a category_id belongs to the resolved workspace before a
 * transaction can reference it. This is the single enforcement point that
 * keeps transactions on the same Categories table as Budgets — no
 * transaction may be created/updated against a category from another
 * workspace, a deleted category, or a free-text name (see categoryService.js
 * for the Categories module this defers to). Returns the category record
 * (so the controller can derive display fields like name without a second
 * lookup) or null when no categoryId was supplied.
 */
async function assertCategoryInWorkspace(categoryId, workspaceId) {
  if (!categoryId) return null;
  const category = await categoryRepository.findByIdInWorkspace(categoryId, workspaceId);
  if (!category) {
    throw new ApiError(400, "Selected category does not exist in this workspace");
  }
  return category;
}

function assertValidEnumFields({ transactionType, approvalStatus, paymentStatus }) {
  if (transactionType && !VALID_TRANSACTION_TYPES.includes(transactionType)) {
    throw new ApiError(400, `Invalid transaction_type "${transactionType}"`);
  }
  if (approvalStatus && !VALID_APPROVAL_STATUSES.includes(approvalStatus)) {
    throw new ApiError(400, `Invalid approval_status "${approvalStatus}"`);
  }
  if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
    throw new ApiError(400, `Invalid payment_status "${paymentStatus}"`);
  }
}

/**
 * Validates enterprise-field references against the resolved workspace
 * before the controller builds its insert/update payload. Throws
 * ApiError(400/404) on any invalid enum value or cross-workspace /
 * nonexistent reference. No-ops for any field left undefined, so it is
 * safe to call from both create (all fields optional) and update
 * (only changed fields present) call sites.
 */
async function validateEnterpriseFields(workspaceId, fields = {}) {
  if (!workspaceId) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  assertValidEnumFields(fields);

  await Promise.all([
    assertVendorInWorkspace(fields.vendorId, workspaceId),
    assertEmployeeInWorkspace(fields.employeeId, workspaceId),
    assertBudgetInWorkspace(fields.budgetId, workspaceId),
  ]);
}

// The single-step assertApprovableTransition() that used to live here
// (pending -> approved/rejected only) has been removed — it assumed
// the old 3-value enum and had no notion of the two-step Dept Lead ->
// Finance escalation the widened state machine above requires. That
// logic now lives in approvalService.js's assertTransition(), which is
// aware of both steps and of who is allowed to perform each one. This
// file still owns validation of the enum values themselves
// (assertValidEnumFields above) for direct PUT edits — just not the
// submit/approve/reject/reimburse workflow transitions, which are a
// distinct concern with their own actor/role checks.

module.exports = {
  validateEnterpriseFields,
  assertCategoryInWorkspace,
  VALID_TRANSACTION_TYPES,
  VALID_APPROVAL_STATUSES,
  VALID_PAYMENT_STATUSES,
};