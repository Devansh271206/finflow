import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Building2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useWorkspace } from "../hooks/useWorkspace";
import { listCompanies } from "../services/companyService";
import { createWorkspace } from "../services/workspaceService";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { Select, SelectItem } from "./ui/Select";

/**
 * WorkspaceSwitcher — Phase 1 addition, extended in Phase 2.1 with a
 * "Create Workspace" flow (previously there was no UI path to create a
 * second workspace at all).
 *
 * Mount wherever desired, e.g. in DashboardLayout's header:
 *   import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
 *   <WorkspaceSwitcher />
 *
 * Unlike the original Phase 1 version, this now renders even when the
 * user has 0 or 1 workspace, since "create a new one" needs to be
 * reachable regardless of how many workspaces already exist.
 */
const WorkspaceSwitcher = () => {
  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    selectWorkspace,
    refreshWorkspaces,
    loading,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openCreateModal = async () => {
    setOpen(false);
    setNewWorkspaceName("");
    setIsCreateOpen(true);

    // A workspace belongs to a company (PRD §5.1). Most users only ever
    // own one company (created at signup), so default to it; if they own
    // multiple, let them pick.
    const { data, error } = await listCompanies();
    if (!error && Array.isArray(data)) {
      setCompanies(data);
      if (data.length > 0) {
        setCompanyId((prev) => prev || data[0].id);
      }
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setCreating(true);
    const { data, error } = await createWorkspace({
      // Only send companyId when the user owns companies — otherwise the
      // backend auto-creates a company for them.
      companyId: companies.length ? companyId : null,
      name: newWorkspaceName.trim(),
    });
    setCreating(false);

    if (error) {
      toast.error(error.message || "Failed to create workspace.");
      return;
    }

    toast.success("Workspace created!");
    setIsCreateOpen(false);
    setNewWorkspaceName("");

    await refreshWorkspaces();
    if (data?.id) {
      selectWorkspace(data.id);
    }
  };

  if (loading) {
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
            {workspaces.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-500">
                No workspaces yet.
              </div>
            )}

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

            <div className="h-[1px] bg-white/5" />

            <button
              type="button"
              onClick={openCreateModal}
              className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-[#10b981] hover:bg-[#10b981]/10 transition-colors"
            >
              <Plus size={16} />
              Create Workspace
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Workspace"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {companies.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Company
              </label>
              <Select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          {companies.length === 0 && (
            <p className="text-xs text-slate-500">
              You don't own a company yet — we'll create one for you automatically
              when the workspace is created.
            </p>
          )}

          <Input
            label="Workspace Name"
            placeholder="e.g. Sandbox, Production"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            autoFocus
            required
          />

          <Button
            type="submit"
            className="w-full justify-center"
            loading={creating}
            disabled={creating}
          >
            Create Workspace
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default WorkspaceSwitcher;