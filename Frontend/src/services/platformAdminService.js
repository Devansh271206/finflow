import { apiGet, apiPost, apiDelete } from "../lib/apiClient";

/**
 * Platform Admin Service (frontend)
 * ------------------------------------------------------------------
 * Thin client for /api/platform/* — mirrors platformAdminController.js
 * one-to-one, same { data, error } return shape every other frontend
 * service uses (via apiClient.js).
 *
 * Note: these endpoints are NOT workspace-scoped — no X-Workspace-Id
 * header applies (apiClient.js still attaches one if a workspace is
 * currently active in the app, but requirePlatformAdmin on the backend
 * ignores it entirely, so this is harmless either way).
 */

export async function getPlatformDashboard() {
  try {
    return await apiGet("/platform/dashboard");
  } catch (error) {
    return { data: null, error };
  }
}

export async function getPlatformAnalytics() {
  try {
    return await apiGet("/platform/analytics");
  } catch (error) {
    return { data: null, error };
  }
}

export async function getOrganizations(status) {
  try {
    return await apiGet("/platform/organizations", status ? { status } : undefined);
  } catch (error) {
    return { data: null, error };
  }
}

export async function getOrganization(id) {
  try {
    return await apiGet(`/platform/organizations/${id}`);
  } catch (error) {
    return { data: null, error };
  }
}

export async function createOrganization(payload) {
  try {
    return await apiPost("/platform/organizations", payload);
  } catch (error) {
    return { data: null, error };
  }
}

export async function activateOrganization(id) {
  try {
    return await apiPost(`/platform/organizations/${id}/activate`);
  } catch (error) {
    return { data: null, error };
  }
}

export async function suspendOrganization(id) {
  try {
    return await apiPost(`/platform/organizations/${id}/suspend`);
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteOrganization(id) {
  try {
    return await apiDelete(`/platform/organizations/${id}`);
  } catch (error) {
    return { data: null, error };
  }
}
