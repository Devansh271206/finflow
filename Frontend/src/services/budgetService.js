import { apiGet, apiPost, apiPut, apiDelete } from "../lib/apiClient";
import { getTransactions } from "./transactionService";

export async function createBudget(budget) {
  try {
    return await apiPost("/budgets", budget);
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteBudget(id) {
  try {
    return await apiDelete(`/budgets/${id}`);
  } catch (error) {
    return { data: null, error };
  }
}

export async function getBudgets() {
  try {
    const [{ data: budgetsData, error: budgetsError }, { data: transactionsData, error: transactionsError }] = await Promise.all([
      apiGet("/budgets"),
      getTransactions(),
    ]);

    if (budgetsError || transactionsError) {
      return { data: [], error: budgetsError || transactionsError };
    }

    const budgets = Array.isArray(budgetsData) ? budgetsData : [];
    const transactions = Array.isArray(transactionsData) ? transactionsData : [];

    return {
      data: budgets.map((budget) => ({
        ...budget,
        limit: Number(budget.limit ?? budget.monthly_limit ?? 0),
        spent: Number(budget.spent ?? 0),
        monthly_limit: Number(budget.monthly_limit ?? budget.limit ?? 0),
      })),
      error: null,
    };
  } catch (error) {
    return { data: [], error };
  }
}

export async function updateBudget(id, updates) {
  try {
    const payload = {
      ...(updates.categoryId !== undefined && { categoryId: updates.categoryId }),
      limit: updates.limit ?? updates.monthly_limit,
      ...(updates.month !== undefined && { month: updates.month }),
      ...(updates.year !== undefined && { year: updates.year }),
    };

    return await apiPut(`/budgets/${id}`, payload);
  } catch (error) {
    return { data: null, error };
  }
}