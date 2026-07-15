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
} = require("../controllers/transactionController");

const router = express.Router();

// All transaction routes require authentication
router.use(protect);
router.use(resolveWorkspace);

// Phase F.2: RBAC now wired in for transactions. Started in log-only mode
// (enforce: false) so denials are logged but not blocking — flip to
// enforce: true (or drop the option entirely, since true is the default)
// once you've watched the logs for a few days and confirmed no legitimate
// user/role is being wrongly denied. See middleware/authorize.js header.

const TRANSACTION_TYPES = [
  "income",
  "expense",
  "payroll",
  "reimbursement",
  "vendor_invoice",
  "transfer",
  "journal_entry",
];
const APPROVAL_STATUSES = ["pending", "approved", "rejected"];
const PAYMENT_STATUSES = ["unpaid", "paid", "partially_paid"];

router.get(
  "/",
  authorize(PERMISSIONS.TRANSACTIONS_READ, { enforce: false }),
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
  authorize(PERMISSIONS.TRANSACTIONS_READ, { enforce: false }),
  [param("id").notEmpty()],
  validateRequest,
  getTransactionById
);

router.post(
  "/",
  authorize(PERMISSIONS.TRANSACTIONS_CREATE, { enforce: false }),
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
  authorize(PERMISSIONS.TRANSACTIONS_EDIT, { enforce: false }),
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
  authorize(PERMISSIONS.TRANSACTIONS_DELETE, { enforce: false }),
  [param("id").notEmpty()],
  validateRequest,
  deleteTransaction
);

module.exports = router;