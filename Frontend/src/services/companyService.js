import { apiGet, apiPost, apiPatch } from "../lib/apiClient";

export async function listCompanies() {
  return apiGet("/companies");
}

export async function getCompany(id) {
  return apiGet(`/companies/${id}`);
}

export async function createCompany(payload) {
  return apiPost("/companies", payload);
}

export async function updateCompany(id, payload) {
  return apiPatch(`/companies/${id}`, payload);
}