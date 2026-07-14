/**
 * Transaction Controller
 * ------------------------------------------------------------------
 * Table: transactions
 * Columns: id, user_id, title, merchant, amount, type ('income'|'expense'),
 *          category, category_id, payment_method, transaction_date,
 *          notes, receipt_url, created_at, updated_at
 */

const { supabaseAdmin } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { uploadToSupabaseStorage } = require("../utils/upload");
const { applyWorkspaceScope, workspaceIdForInsert } = require("../utils/workspaceScope");

const SELECT_COLUMNS =
  "id, user_id, title, merchant, amount, type, category, category_id, payment_method, transaction_date, notes, receipt_url, created_at, updated_at";

/**
 * Resolves a free-text category name to a category_id owned by the user,
 * mirroring the lookup logic the frontend previously performed directly
 * against Supabase.
 */
async function resolveCategoryId(categoryName, userId) {
  if (!categoryName) return null;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .or(`name.eq.${categoryName},title.eq.${categoryName}`)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

// @desc    Get all transactions for the authenticated user
// @route   GET /api/transactions
// @access  Private
// Supports optional query params: type, category_id, from, to, page, limit
const getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { type, category_id, from, to, page = 1, limit = 50 } = req.query;

  let query = supabaseAdmin
    .from("transactions")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false });

  query = applyWorkspaceScope(query, req);

  if (type) query = query.eq("type", type);
  if (category_id) query = query.eq("category_id", category_id);
  if (from) query = query.gte("transaction_date", from);
  if (to) query = query.lte("transaction_date", to);

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(parseInt(limit, 10) || 50, 200);
  const start = (pageNum - 1) * pageSize;
  const end = start + pageSize - 1;
  query = query.range(start, end);

  const { data, error, count } = await query;

  if (error) throw new ApiError(500, "Failed to fetch transactions", error.message);

  return sendSuccess(res, {
    message: "Transactions fetched successfully",
    data: {
      transactions: data || [],
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: count ?? data?.length ?? 0,
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

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to fetch transaction", error.message);
  if (!data) throw new ApiError(404, "Transaction not found");

  return sendSuccess(res, { message: "Transaction fetched successfully", data });
});

// @desc    Create a new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { merchant, title, amount, type, category, paymentMethod, date, notes } = req.body;

  const categoryId = await resolveCategoryId(category, userId);

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
    category: category || "Uncategorized",
    category_id: categoryId,
    payment_method: paymentMethod || "Credit Card",
    transaction_date: date || new Date().toISOString(),
    notes: notes || "",
    receipt_url: receiptUrl,
    workspace_id: workspaceIdForInsert(req),
  };

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .insert([payload])
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw new ApiError(500, "Failed to create transaction", error.message);

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
  const { merchant, title, amount, type, category, paymentMethod, date, notes } = req.body;

  const categoryId = category ? await resolveCategoryId(category, userId) : undefined;

  let receiptUrl;
  if (req.file) {
    receiptUrl = await uploadToSupabaseStorage(supabaseAdmin, req.file, `receipts/${userId}`);
  }

  const payload = {
    ...(title !== undefined && { title }),
    ...(merchant !== undefined && { merchant }),
    ...(amount !== undefined && { amount }),
    ...(type !== undefined && { type }),
    ...(category !== undefined && { category }),
    ...(categoryId !== undefined && { category_id: categoryId }),
    ...(paymentMethod !== undefined && { payment_method: paymentMethod }),
    ...(date !== undefined && { transaction_date: date }),
    ...(notes !== undefined && { notes }),
    ...(receiptUrl !== undefined && { receipt_url: receiptUrl }),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to update transaction", error.message);
  if (!data) throw new ApiError(404, "Transaction not found");

  return sendSuccess(res, { message: "Transaction updated successfully", data });
});

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to delete transaction", error.message);
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
