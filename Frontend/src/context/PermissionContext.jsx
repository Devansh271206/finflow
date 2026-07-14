import React, { createContext, useContext, useState, useEffect } from "react";
import { useWorkspaceContext } from "./WorkspaceContext";
import { apiGet } from "../lib/apiClient";

const PermissionContext = createContext();

/**
 * PermissionProvider — Phase 1 addition.
 *
 * Fetches the resolved permission set (role + permission keys) for the
 * user's active workspace membership from GET /api/roles/me, whenever the
 * active workspace changes. Purely additive — existing pages that don't
 * call usePermissions() are unaffected. Per PRD §11, this is UX-only:
 * the backend (authorize middleware) is the real enforcement point.
 */
export const PermissionProvider = ({ children }) => {
  const { activeWorkspaceId } = useWorkspaceContext() || {};
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [departmentId, setDepartmentId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPermissions() {
      setLoading(true);
      const { data, error } = await apiGet("/roles/me");
      if (!cancelled) {
        if (!error && data) {
          setRole(data.role || null);
          setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
          setDepartmentId(data.departmentId || null);
        } else {
          setRole(null);
          setPermissions([]);
          setDepartmentId(null);
        }
        setLoading(false);
      }
    }

    if (activeWorkspaceId) {
      fetchPermissions();
    } else {
      setRole(null);
      setPermissions([]);
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  const can = (permissionKey) => permissions.includes(permissionKey);

  const value = { role, permissions, departmentId, loading, can };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissionContext = () => useContext(PermissionContext);

export default PermissionContext;