import { apiDelete, apiGet, apiPost, apiPut } from "../lib/apiClient";

function normalizeGoal(row) {
  return {
    id: row.id,
    name: row.title || row.name || "Untitled Goal",
    target: Number(row.target_amount ?? row.target ?? 0),
    current: Number(row.saved_amount ?? row.current ?? 0),
    category: row.category || "General",
    estimatedCompletion: row.deadline
      ? new Date(row.deadline).toLocaleString("en-IN", { month: "short", year: "numeric" })
      : "Flexible",
    status: row.status || "active",
    milestones: row.milestones || [{ name: "Initiate Target", achieved: true }],
    deadline: row.deadline,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getGoals() {
  try {
    const { data, error } = await apiGet("/goals");

    if (error) {
      return { data: [], error };
    }

    const goals = Array.isArray(data) ? data : [];
    return { data: goals.map(normalizeGoal), error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function addGoal(goal) {
  try {
    const payload = {
      name: goal.name,
      target: Number(goal.target || 0),
      deadline: goal.deadline || null,
      category: goal.category || "General",
    };

    const { data, error } = await apiPost("/goals", payload);
    return { data: data ? normalizeGoal(data) : null, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function addGoalFunds(id, amount) {
  try {
    const { data, error } = await apiPut(`/goals/${id}`, { addFunds: Number(amount || 0) });
    return { data: data ? normalizeGoal(data) : null, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteGoal(id) {
  try {
    return apiDelete(`/goals/${id}`);
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateGoal(id, updates) {
  try {
    const payload = {
      name: updates.name,
      target: updates.target,
      category: updates.category,
      deadline: updates.deadline || null,
      status: updates.status,
      savedAmount: updates.saved_amount ?? updates.current,
    };

    const { data, error } = await apiPut(`/goals/${id}`, payload);
    return { data: data ? normalizeGoal(data) : null, error };
  } catch (error) {
    return { data: null, error };
  }
}
