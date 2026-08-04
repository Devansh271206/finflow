import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useWorkspaceContext } from "./WorkspaceContext";
import { listTeams } from "../services/teamService";

const TeamContext = createContext();

/**
 * TeamProvider — Sprint 8 addition.
 *
 * Fetches the active workspace's teams from GET /api/teams whenever the
 * active workspace changes, so pages that need a team picker (Teams.jsx
 * now; Employee create/edit forms in a later sprint, per PRD §15.20)
 * don't each re-fetch independently. Mirrors DepartmentContext's shape
 * and lifecycle exactly — purely additive, no existing page needs to
 * read from this context to keep working.
 */
export const TeamProvider = ({ children }) => {
  const { activeWorkspaceId } = useWorkspaceContext() || {};
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshTeams = useCallback(async () => {
    if (!activeWorkspaceId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await listTeams();
    if (!error && Array.isArray(data)) {
      setTeams(data);
    } else {
      setTeams([]);
    }
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!activeWorkspaceId) {
        setTeams([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await listTeams();
      if (!cancelled) {
        if (!error && Array.isArray(data)) {
          setTeams(data);
        } else {
          setTeams([]);
        }
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  const activeTeams = teams.filter((t) => t.is_active);

  const teamsByDepartment = useCallback(
    (departmentId) => teams.filter((t) => t.department_id === departmentId),
    [teams]
  );

  const value = {
    teams,
    activeTeams,
    loading,
    refreshTeams,
    teamsByDepartment,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const useTeamContext = () => useContext(TeamContext);

export default TeamContext;