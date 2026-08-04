const express = require("express");
const { body, param, query } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { resolveWorkspace } = require("../middleware/resolveWorkspace");
const { authorize } = require("../middleware/authorize");
const { PERMISSIONS } = require("../utils/permissionRegistry");
const validateRequest = require("../middleware/validateRequest");
const { upload } = require("../utils/upload");
const {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  submitTransaction,
  approveTransaction,
  rejectTransaction,
  reimburseTransaction,
  getApprovalHistory,
} = require("../controllers/transactionController");

const router = express.Router();

// All transaction routes require authentication
router.use(protect);
router.use(resolveWorkspace);

// Sprint 1: RBAC flipped from log-only to enforcing. Phase F.2 had left
// this in { enforce: false } (denials logged, not blocking) as a
// deliberate rollout precaution — Categories/Departments already proved
// the underlying permissionService/role_permissions mechanism works
// correctly in enforcing mode, so this now matches that. A denied
// permission returns 403 instead of just a console.warn.

const TRANSACTION_TYPES = [
  "income",
  "expense",
  "payroll",
  "reimbursement",
  "vendor_invoice",
  "transfer",
  "journal_entry",
];
// Sprint 4: widened to match transactionService.js's VALID_APPROVAL_STATUSES
// — this was a separate, stale copy of the old 3-value enum that would
// have rejected valid draft/submitted/under_review/reimbursed values on
// direct create/update/filter requests otherwise.
const APPROVAL_STATUSES = ["draft", "submitted", "under_review", "approved", "rejected", "reimbursed"];
const PAYMENT_STATUSES = ["unpaid", "paid", "partially_paid"];

router.get(
  "/",
  authorize(PERMISSIONS.TRANSACTIONS_READ),
  [
    query("type").optional().isIn(["income", "expense"]),
    query("category_id").optional().isUUID(),
    query("vendor_id").optional().isUUID(),
    query("employee_id").optional().isUUID(),
    query("approval_status").optional().isIn(APPROVAL_STATUSES),
    query("payment_status").optional().isIn(PAYMENT_STATUSES),
    query("transaction_type").optional().isIn(TRANSACTION_TYPES),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 200 }),
  ],
  validateRequest,
  getTransactions
);

router.get(
  "/:id",
  authorize(PERMISSIONS.TRANSACTIONS_READ),
  [param("id").notEmpty()],
  validateRequest,
  getTransactionById
);

router.post(
  "/",
  authorize(PERMISSIONS.TRANSACTIONS_CREATE),
  upload.single("receipt"),
  [
    body("amount").isFloat({ gt: 0 }).withMessage("Amount must be a positive number"),
    body("type").optional().isIn(["income", "expense"]),
    body("date").optional().isISO8601(),
    body("categoryId").optional({ nullable: true }).isUUID(),
    body("vendorId").optional().isUUID(),
    body("employeeId").optional().isUUID(),
    body("budgetId").optional().isUUID(),
    body("transactionType").optional().isIn(TRANSACTION_TYPES),
    body("approvalStatus").optional().isIn(APPROVAL_STATUSES),
    body("paymentStatus").optional().isIn(PAYMENT_STATUSES),
    body("referenceNumber").optional().isString(),
    body("invoiceNumber").optional().isString(),
  ],
  validateRequest,
  createTransaction
);

router.put(
  "/:id",
  authorize(PERMISSIONS.TRANSACTIONS_EDIT),
  upload.single("receipt"),
  [
    param("id").notEmpty(),
    body("amount").optional().isFloat({ gt: 0 }),
    body("type").optional().isIn(["income", "expense"]),
    body("date").optional().isISO8601(),
    body("categoryId").optional({ nullable: true }).isUUID(),
    body("vendorId").optional().isUUID(),
    body("employeeId").optional().isUUID(),
    body("budgetId").optional().isUUID(),
    body("transactionType").optional().isIn(TRANSACTION_TYPES),
    body("approvalStatus").optional().isIn(APPROVAL_STATUSES),
    body("paymentStatus").optional().isIn(PAYMENT_STATUSES),
    body("referenceNumber").optional().isString(),
    body("invoiceNumber").optional().isString(),
  ],
  validateRequest,
  updateTransaction
);

router.delete(
  "/:id",
  authorize(PERMISSIONS.TRANSACTIONS_DELETE),
  [param("id").notEmpty()],
  validateRequest,
  deleteTransaction
);

// Sprint 4 — Expense Approval Workflow. authorize() here only confirms
// the caller has approval rights of SOME kind; approvalService.js is
// what actually checks WHICH step a role/department may act on (see
// its header comment). PERMISSIONS.APPROVALS_SUBMIT/APPROVALS_ACT were
// already registered in permissionRegistry.js before this sprint —
// defined but unused until now.

router.post(
  "/:id/submit",
  authorize(PERMISSIONS.APPROVALS_SUBMIT),
  [param("id").isUUID()],
  validateRequest,
  submitTransaction
);

router.post(
  "/:id/approve",
  authorize(PERMISSIONS.APPROVALS_ACT),
  [param("id").isUUID(), body("notes").optional().isString()],
  validateRequest,
  approveTransaction
);

router.post(
  "/:id/reject",
  authorize(PERMISSIONS.APPROVALS_ACT),
  [
    param("id").isUUID(),
    body("notes").notEmpty().withMessage("A reason is required when rejecting a transaction"),
  ],
  validateRequest,
  rejectTransaction
);

router.post(
  "/:id/reimburse",
  authorize(PERMISSIONS.APPROVALS_ACT),
  [param("id").isUUID()],
  validateRequest,
  reimburseTransaction
);

router.get(
  "/:id/approvals",
  authorize(PERMISSIONS.TRANSACTIONS_READ),
  [param("id").isUUID()],
  validateRequest,
  getApprovalHistory
);

module.exports = router;