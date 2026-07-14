import { apiGet } from "../lib/apiClient";

export async function getCategories() {
  try {
    return await apiGet("/categories");
  } catch (error) {
    return { data: [], error };
  }
}