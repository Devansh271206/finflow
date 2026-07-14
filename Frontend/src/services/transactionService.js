import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "../lib/apiClient";

function normalizeTransaction(row) {
  return {
    id: row.id,
    merchant: row.merchant || row.title || "Unnamed transaction",
    amount: row.amount ?? 0,
    type: row.type || "expense",
    category: row.category || "Uncategorized",
    paymentMethod: row.payment_method || "Credit Card",
    status: "Completed",
    date: row.transaction_date || row.date || "",
    receiptImage: row.receipt_url || row.receiptImage || null,
    title: row.title || row.merchant || "Transaction",
    notes: row.notes || "",
    category_id: row.category_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildTransactionPayload(transaction) {
  return {
    title: transaction.merchant || transaction.title || "Transaction",
    merchant: transaction.merchant,
    amount: transaction.amount,
    type: transaction.type,
    paymentMethod: transaction.paymentMethod,
    date: transaction.date,
    notes: transaction.notes || "",
    category: transaction.category,
    receiptImage: transaction.receiptImage || null,
  };
}

export async function getTransactions() {
  try {
    const { data, error } = await apiGet("/transactions");

    if (error) {
      return { data: [], error };
    }

    const transactions = Array.isArray(data?.transactions) ? data.transactions : Array.isArray(data) ? data : [];
    return { data: transactions.map(normalizeTransaction), error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function addTransaction(transaction) {
  try {
    const payload = buildTransactionPayload(transaction);
    const hasFile = transaction.receiptImage instanceof File;

    if (hasFile) {
      const formData = new FormData();
      formData.append("receipt", transaction.receiptImage);
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        formData.append(key, value);
      });

      const { data, error } = await apiUpload("/transactions", formData, "POST");
      return { data: data ? normalizeTransaction(data) : null, error };
    }

    const { data, error } = await apiPost("/transactions", {
      ...payload,
      receiptImage: undefined,
    });
    return { data: data ? normalizeTransaction(data) : null, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteTransaction(id) {
  try {
    return apiDelete(`/transactions/${id}`);
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateTransaction(id, updates) {
  try {
    const payload = buildTransactionPayload(updates);
    const hasFile = updates.receiptImage instanceof File;

    if (hasFile) {
      const formData = new FormData();
      formData.append("receipt", updates.receiptImage);
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        formData.append(key, value);
      });

      const { data, error } = await apiUpload(`/transactions/${id}`, formData, "PUT");
      return { data: data ? normalizeTransaction(data) : null, error };
    }

    const { data, error } = await apiPut(`/transactions/${id}`, {
      ...payload,
      receiptImage: undefined,
    });
    return { data: data ? normalizeTransaction(data) : null, error };
  } catch (error) {
    return { data: null, error };
  }
}