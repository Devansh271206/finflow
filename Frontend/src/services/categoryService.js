import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "../lib/apiClient";

export async function getCategories(filters = {}) {
  try {
    return await apiGet("/categories", filters);
  } catch (error) {
    return { data: [], error };
  }
}

export async function getCategory(id) {
  return apiGet(`/categories/${id}`);
}

export async function createCategory({ name, description, icon, color, type, departmentId, expenseType }) {
  return apiPost("/categories", {
    name,
    description,
    icon,
    color,
    type,
    department_id: departmentId || undefined,
    expense_type: expenseType,
  });
}

export async function updateCategory(id, { name, description, icon, color, departmentId, expenseType }) {
  return apiPut(`/categories/${id}`, {
    name,
    description,
    icon,
    color,
    department_id: departmentId,
    expense_type: expenseType,
  });
}

export async function activateCategory(id) {
  return apiPatch(`/categories/${id}/status`, { status: "active" });
}

export async function deactivateCategory(id) {
  return apiPatch(`/categories/${id}/status`, { status: "inactive" });
}

export async function deleteCategory(id) {
  return apiDelete(`/categories/${id}`);
}

export async function reorderCategories(orderedIds) {
  return apiPatch("/categories/reorder", { ordered_ids: orderedIds });
}