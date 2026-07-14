/**
 * Permission Service
 * ------------------------------------------------------------------
 * Resolves a role's permission set for use by authorize(). Adds a
 * short-lived in-memory cache keyed by role_id since role_permissions
 * rarely change and this is looked up on every authorized request.
 */

const roleRepository = require("../repositories/roleRepository");

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map(); // roleId -> { keys: string[], expiresAt: number }

async function getPermissionKeysForRole(roleId) {
  if (!roleId) return [];

  const cached = cache.get(roleId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const keys = await roleRepository.getPermissionKeysForRole(roleId);
  cache.set(roleId, { keys, expiresAt: Date.now() + CACHE_TTL_MS });
  return keys;
}

async function hasPermission(roleId, permissionKey) {
  const keys = await getPermissionKeysForRole(roleId);
  return keys.includes(permissionKey);
}

/** Invalidate cache for a role — call after any role_permissions edit. */
function invalidateRole(roleId) {
  cache.delete(roleId);
}

module.exports = { getPermissionKeysForRole, hasPermission, invalidateRole };
