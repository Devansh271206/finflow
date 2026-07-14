import { apiGet, apiPost, apiPatch } from "../lib/apiClient";

export async function listCompanies() {
  return apiGet("/api/companies");
}

export async function getCompany(id) {
  return apiGet(`/api/companies/${id}`);
}

export async function createCompany(payload) {
  return apiPost("/api/companies", payload);
}

export async function updateCompany(id, payload) {
  return apiPatch(`/api/companies/${id}`, payload);
}
