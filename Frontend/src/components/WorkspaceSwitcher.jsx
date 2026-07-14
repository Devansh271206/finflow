import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Building2 } from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspace";

/**
 * WorkspaceSwitcher — Phase 1 addition.
 *
 * Self-contained dropdown; not wired into DashboardLayout automatically
 * (per "no existing UI changes" instruction). Drop it into the sidebar or
 * header wherever desired, e.g.:
 *
 *   import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
 *   <WorkspaceSwitcher />
 *
 * Renders nothing if the user has zero or exactly one workspace, so it's
 * safe to mount even before multi-workspace usage is common.
 */
const WorkspaceSwitcher = () => {
  const { workspaces, activeWorkspaceId, activeWorkspace, selectWorkspace, loading } =
    useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading || workspaces.length <= 1) {
    return null;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-all duration-200"
      >
        <Building2 size={16} className="text-[#10b981]" />
        <span className="truncate max-w-[140px] font-medium">
          {activeWorkspace?.name || "Select workspace"}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 rounded-xl bg-[#111827] border border-white/10 shadow-xl z-50 overflow-hidden"
          >
            {workspaces.map((m) => (
              <button
                key={m.workspace?.id}
                type="button"
                onClick={() => {
                  selectWorkspace(m.workspace?.id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.workspace?.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {m.company?.name} · {m.role?.name}
                  </p>
                </div>
                {m.workspace?.id === activeWorkspaceId && (
                  <Check size={16} className="text-[#10b981] shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkspaceSwitcher;
