import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useWorkspaceContext } from "./WorkspaceContext";
import { listDepartments } from "../services/departmentService";

const DepartmentContext = createContext();

/**
 * DepartmentProvider — Phase 2.1 addition.
 *
 * Fetches the active workspace's departments from GET /api/departments
 * whenever the active workspace changes, so pages that need a department
 * picker (Departments.jsx now; Transactions/Budgets forms in a later
 * phase) don't each re-fetch independently. Purely additive — mirrors
 * PermissionContext's shape and lifecycle exactly, and no existing page
 * needs to read from this context to keep working.
 */
export const DepartmentProvider = ({ children }) => {
  const { activeWorkspaceId } = useWorkspaceContext() || {};
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshDepartments = useCallback(async () => {
    if (!activeWorkspaceId) {
      setDepartments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await listDepartments();
    if (!error && Array.isArray(data)) {
      setDepartments(data);
    } else {
      setDepartments([]);
    }
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!activeWorkspaceId) {
        setDepartments([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await listDepartments();
      if (!cancelled) {
        if (!error && Array.isArray(data)) {
          setDepartments(data);
        } else {
          setDepartments([]);
        }
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  const activeDepartments = departments.filter((d) => d.is_active);

  const value = {
    departments,
    activeDepartments,
    loading,
    refreshDepartments,
  };

  return (
    <DepartmentContext.Provider value={value}>
      {children}
    </DepartmentContext.Provider>
  );
};

export const useDepartmentContext = () => useContext(DepartmentContext);

export default DepartmentContext;