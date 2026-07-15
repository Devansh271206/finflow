/**
 * Transaction Controller
 * ------------------------------------------------------------------
 * Table: transactions
 * Columns: id, user_id, workspace_id, department_id, vendor_id,
 *          employee_id, budget_id, title, merchant, amount,
 *          type ('income'|'expense'), transaction_type, category,
 *          category_id, payment_method, transaction_date,
 *          reference_number, invoice_number, approval_status,
 *          payment_status, transaction_source, created_by,
 *          approved_by, attachment_count, notes, receipt_url,
 *          created_at, updated_at
 *
 * Refactored (Phase F.1) to go through transactionRepository instead of
 * calling supabaseAdmin directly — no behavior change, brings this
 * controller onto the same repository pattern as departments/workspaces/
 * memberships (PRD §10.1).
 *
 * Enterprise refactor: now also delegates to transactionService for
 * validation of vendor_id/employee_id/budget_id and the new enum
 * fields (transaction_type/approval_status/payment_status), the same
 * way budgetController delegates to budgetService. See the
 * Transactions architecture audit — this controller previously had no
 * service layer at all.
 */

const { supabaseAdmin } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { uploadToSupabaseStorage } = require("../utils/upload");
const { workspaceIdForInsert } = require("../utils/workspaceScope");
const transactionRepository = require("../repositories/transactionRepository");
const transactionService = require("../services/transactionService");

// @desc    Get all transactions for the authenticated user
// @route   GET /api/transactions
// @access  Private
// Supports optional query params: type, category_id, vendor_id,
// employee_id, approval_status, payment_status, transaction_type,
// from, to, page, limit
const getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    type,
    category_id,
    vendor_id,
    employee_id,
    approval_status,
    payment_status,
    transaction_type,
    from,
    to,
    page = 1,
    limit = 50,
  } = req.query;

  const { rows, count, page: pageNum, pageSize } = await transactionRepository.listForUser(
    userId,
    {
      workspaceId: req.workspace?.id,
      type,
      categoryId: category_id,
      vendorId: vendor_id,
      employeeId: employee_id,
      approvalStatus: approval_status,
      paymentStatus: payment_status,
      transactionType: transaction_type,
      from,
      to,
      page,
      limit,
    }
  );

  return sendSuccess(res, {
    message: "Transactions fetched successfully",
    data: {
      transactions: rows,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: count,
      },
    },
  });
});

// @desc    Get a single transaction by id
// @route   GET /api/transactions/:id
// @access  Private
const getTransactionById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const data = await transactionRepository.findByIdForUser(id, userId);

  if (!data) throw new ApiError(404, "Transaction not found");

  return sendSuccess(res, { message: "Transaction fetched successfully", data });
});

// @desc    Create a new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    merchant,
    title,
    amount,
    type,
    categoryId,
    paymentMethod,
    date,
    notes,
    vendorId,
    employeeId,
    budgetId,
    transactionType,
    referenceNumber,
    invoiceNumber,
    approvalStatus,
    paymentStatus,
  } = req.body;

  const workspaceId = workspaceIdForInsert(req);

  // Enterprise fields: validate vendor/employee/budget belong to this
  // workspace and that enum fields are valid, before touching storage
  // or the DB. No-op for any field left undefined (personal-expense
  // callers are unaffected).
  await transactionService.validateEnterpriseFields(workspaceId, {
    vendorId,
    employeeId,
    budgetId,
    transactionType,
    approvalStatus,
    paymentStatus,
  });

  // Categories are single-sourced from the Categories table (see
  // categoryService.js / PRD architecture: Categories -> Budgets ->
  // Transactions). We only ever accept a category_id from the client,
  // validate it belongs to this workspace, and derive the display name
  // from the validated record itself — never from client-supplied text.
  // The `category` text column is kept only as a denormalized cache for
  // Reports/Analytics (analyticsService.js still groups by it) and is
  // never independently trusted or user-editable.
  const category = await transactionService.assertCategoryInWorkspace(categoryId, workspaceId);

  let receiptUrl = null;
  if (req.file) {
    receiptUrl = await uploadToSupabaseStorage(supabaseAdmin, req.file, `receipts/${userId}`);
  }

  const payload = {
    user_id: userId,
    title: title || merchant || "Transaction",
    merchant: merchant || title,
    amount,
    type: type || "expense",
    transaction_type: transactionType || type || "expense",
    category: category?.name || "Uncategorized",
    category_id: category?.id || null,
    payment_method: paymentMethod || "Credit Card",
    transaction_date: date || new Date().toISOString(),
    notes: notes || "",
    receipt_url: receiptUrl,
    workspace_id: workspaceId,
    vendor_id: vendorId || null,
    employee_id: employeeId || null,
    budget_id: budgetId || null,
    reference_number: referenceNumber || null,
    invoice_number: invoiceNumber || null,
    approval_status: approvalStatus || null,
    payment_status: paymentStatus || null,
    // transaction_source defaults to 'manual' at the DB level
    // (migrations/002_enterprise_transactions.sql). Not set here yet —
    // once import/API/recurring creation paths exist, they should pass
    // their own source explicitly.
    // created_by intentionally left null: no middleware currently
    // resolves the acting employee record onto req.employee. Wire this
    // once that middleware exists rather than guessing at req.user.id
    // (user_id and employee_id are different entities in this schema).
  };

  const data = await transactionRepository.create(payload);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Transaction created successfully",
    data,
  });
});

// @desc    Update an existing transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const {
    merchant,
    title,
    amount,
    type,
    categoryId,
    paymentMethod,
    date,
    notes,
    vendorId,
    employeeId,
    budgetId,
    transactionType,
    referenceNumber,
    invoiceNumber,
    approvalStatus,
    paymentStatus,
  } = req.body;

  // Only validate enterprise fields that are actually being changed on
  // this update, same pattern as the rest of this function's undefined
  // checks below.
  if (
    vendorId !== undefined ||
    employeeId !== undefined ||
    budgetId !== undefined ||
    transactionType !== undefined ||
    approvalStatus !== undefined ||
    paymentStatus !== undefined
  ) {
    await transactionService.validateEnterpriseFields(req.workspace?.id, {
      vendorId,
      employeeId,
      budgetId,
      transactionType,
      approvalStatus,
      paymentStatus,
    });
  }

  // Same single-source-of-truth rule as createTransaction: only validate/
  // resolve category when the caller is actually changing it on this
  // update (categoryId !== undefined), same pattern as the enterprise
  // fields above.
  const category =
    categoryId !== undefined
      ? await transactionService.assertCategoryInWorkspace(categoryId, req.workspace?.id)
      : undefined;

  let receiptUrl;
  if (req.file) {
    receiptUrl = await uploadToSupabaseStorage(supabaseAdmin, req.file, `receipts/${userId}`);
  }

  const payload = {
    ...(title !== undefined && { title }),
    ...(merchant !== undefined && { merchant }),
    ...(amount !== undefined && { amount }),
    ...(type !== undefined && { type }),
    ...(categoryId !== undefined && {
      category: category?.name || "Uncategorized",
      category_id: category?.id || null,
    }),
    ...(paymentMethod !== undefined && { payment_method: paymentMethod }),
    ...(date !== undefined && { transaction_date: date }),
    ...(notes !== undefined && { notes }),
    ...(receiptUrl !== undefined && { receipt_url: receiptUrl }),
    ...(vendorId !== undefined && { vendor_id: vendorId }),
    ...(employeeId !== undefined && { employee_id: employeeId }),
    ...(budgetId !== undefined && { budget_id: budgetId }),
    ...(transactionType !== undefined && { transaction_type: transactionType }),
    ...(referenceNumber !== undefined && { reference_number: referenceNumber }),
    ...(invoiceNumber !== undefined && { invoice_number: invoiceNumber }),
    ...(approvalStatus !== undefined && { approval_status: approvalStatus }),
    ...(paymentStatus !== undefined && { payment_status: paymentStatus }),
    updated_at: new Date().toISOString(),
  };

  const data = await transactionRepository.updateForUser(id, userId, payload);

  if (!data) throw new ApiError(404, "Transaction not found");

  return sendSuccess(res, { message: "Transaction updated successfully", data });
});

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const data = await transactionRepository.deleteForUser(id, userId);

  if (!data) throw new ApiError(404, "Transaction not found");

  return sendSuccess(res, { message: "Transaction deleted successfully", data: { id } });
});

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};