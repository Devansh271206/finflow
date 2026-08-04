import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useWorkspaceContext } from "./WorkspaceContext";
import { getSelfEmployee, listEmployees } from "../services/employeeService";

const EmployeeContext = createContext();

export const EmployeeProvider = ({ children }) => {
  const { activeWorkspaceId } = useWorkspaceContext() || {};
  
  // selfEmployee holds the current user's profile for the active workspace
  const [selfEmployee, setSelfEmployee] = useState(null);
  const [selfLoading, setSelfLoading] = useState(true);

  // activeEmployees holds a lightweight list of active employees for picker dropdowns
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const refreshSelf = useCallback(async () => {
    if (!activeWorkspaceId) {
      setSelfEmployee(null);
      setSelfLoading(false);
      return;
    }
    setSelfLoading(true);
    const { data, error } = await getSelfEmployee();
    if (!error) {
      setSelfEmployee(data);
    } else {
      setSelfEmployee(null);
    }
    setSelfLoading(false);
  }, [activeWorkspaceId]);

  const refreshActiveEmployees = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setListLoading(true);
    // Fetch a large page of active employees for dropdown usage
    const { data, error } = await listEmployees({ status: 'active', pageSize: 1000 });
    if (!error && data?.items) {
      setActiveEmployees(data.items);
    } else {
      setActiveEmployees([]);
    }
    setListLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!activeWorkspaceId) {
        setSelfEmployee(null);
        setActiveEmployees([]);
        setSelfLoading(false);
        return;
      }
      
      setSelfLoading(true);
      setListLoading(true);

      const [selfRes, listRes] = await Promise.all([
        getSelfEmployee(),
        listEmployees({ status: 'active', pageSize: 1000 })
      ]);

      if (!cancelled) {
        setSelfEmployee(!selfRes.error ? selfRes.data : null);
        setActiveEmployees(!listRes.error && listRes.data?.items ? listRes.data.items : []);
        setSelfLoading(false);
        setListLoading(false);
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  const value = {
    selfEmployee,
    selfLoading,
    refreshSelf,
    activeEmployees,
    listLoading,
    refreshActiveEmployees,
  };

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployeeContext = () => useContext(EmployeeContext);

export default EmployeeContext;
