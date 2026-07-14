import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useApp } from "./AppContext";
import { listWorkspaces } from "../services/workspaceService";
import { setActiveWorkspaceId } from "../lib/apiClient";

const WorkspaceContext = createContext();

const ACTIVE_WORKSPACE_STORAGE_KEY = "finflow_active_workspace_id";

/**
 * WorkspaceProvider — Phase 1 addition.
 *
 * Fetches every workspace the authenticated user belongs to and tracks
 * which one is "active" (persisted locally, sent as X-Workspace-Id on
 * every API request via apiClient's setActiveWorkspaceId).
 *
 * Non-breaking by design: if a user has exactly one workspace (the common
 * case post-migration backfill — "workspace of one"), this resolves
 * silently and existing pages behave exactly as before. No existing page
 * needs to read from this context to keep working.
 */
export const WorkspaceProvider = ({ children }) => {
  const { user, authReady } = useApp();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    if (!user?.isAuthenticated) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await listWorkspaces();
    if (!error && Array.isArray(data)) {
      setWorkspaces(data);

      const stillValid = data.some((m) => m.workspace?.id === activeWorkspaceId);
      if (!stillValid && data.length > 0) {
        selectWorkspace(data[0].workspace?.id);
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (authReady) {
      refreshWorkspaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user]);

  const selectWorkspace = (workspaceId) => {
    setActiveWorkspaceIdState(workspaceId || null);
    try {
      if (workspaceId) {
        localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
      } else {
        localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
      }
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
  };

  // Keep apiClient's module-level workspace id in sync so every request
  // (including from existing services that don't know this context exists)
  // automatically carries the right X-Workspace-Id header.
  useEffect(() => {
    setActiveWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const activeMembership = workspaces.find(
    (m) => m.workspace?.id === activeWorkspaceId
  );

  const value = {
    workspaces,
    activeWorkspaceId,
    activeWorkspace: activeMembership?.workspace || null,
    activeCompany: activeMembership?.company || null,
    activeRole: activeMembership?.role || null,
    loading,
    selectWorkspace,
    refreshWorkspaces,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaceContext = () => useContext(WorkspaceContext);

export default WorkspaceContext;
