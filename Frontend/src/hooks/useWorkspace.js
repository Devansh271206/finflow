import { useWorkspaceContext } from "../context/WorkspaceContext";

/**
 * useWorkspace — thin hook wrapper over WorkspaceContext, matching the
 * PRD §11 frontend architecture naming (hooks/useWorkspace.ts).
 */
export function useWorkspace() {
  const ctx = useWorkspaceContext();
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

export default useWorkspace;
