import { apiGet } from "../lib/apiClient";

function normalizeTransaction(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    merchant: row.merchant || row.title || "Unnamed transaction",
    title: row.title || row.merchant || "Transaction",
    amount: Number(row.amount ?? 0),
    type: row.type || "expense",
    category: row.category || "Uncategorized",
    category_id: row.category_id || null,
    payment_method: row.payment_method || "Credit Card",
    transaction_date: row.transaction_date || row.date || row.created_at || "",
    notes: row.notes || "",
    receipt_url: row.receipt_url || row.receiptImage || null,
    status: row.status || "Completed",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getDashboardData() {
  try {
    const { data, error } = await apiGet("/dashboard");

    if (error) {
      return { data: [], error };
    }

    const recentTransactions = Array.isArray(data?.recentTransactions) ? data.recentTransactions : [];
    return {
      data: recentTransactions.map(normalizeTransaction),
      error: null,
    };
  } catch (error) {
    return { data: [], error };
  }
}