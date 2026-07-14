import { usePermissionContext } from "../context/PermissionContext";

/**
 * usePermissions — thin hook wrapper over PermissionContext, matching the
 * PRD §11 naming (hooks/usePermissions.ts). UX-only gating; the backend
 * authorize() middleware is the actual enforcement point.
 *
 * Usage:
 *   const { can } = usePermissions();
 *   {can("vendors.manage") && <button>Add vendor</button>}
 */
export function usePermissions() {
  const ctx = usePermissionContext();
  if (!ctx) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return ctx;
}

export default usePermissions;
