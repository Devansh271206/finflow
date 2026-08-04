/**
 * Employee Document Repository
 * ------------------------------------------------------------------
 * Thin data-access layer wrapping Supabase client calls for
 * `employee_documents`. storage_path (not a URL) is stored — signed,
 * time-limited URLs are generated on read via
 * utils/upload.js:getSignedDocumentUrl(), never stored as a permanent
 * link. See migration 007 for the full rationale.
 *
 * Table: employee_documents
 * Columns: id, employee_id, document_type, storage_path, uploaded_by,
 *          created_at
 *
 * No update() exposed — a document is replaced by uploading a new one
 * and deleting the old, not edited in place. Deliberately no
 * workspace_id column (matches PRD-documented shape); callers
 * (employeeDocumentService) must confirm the parent employee belongs
 * to the caller's workspace first.
 */

const { supabaseAdmin } = require("../config/supabase");

const SELECT_COLUMNS = "id, employee_id, document_type, storage_path, uploaded_by, created_at";

async function listByEmployee(employeeId) {
  const { data, error } = await supabaseAdmin
    .from("employee_documents")
    .select(SELECT_COLUMNS)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function findByIdForEmployee(id, employeeId) {
  const { data, error } = await supabaseAdmin
    .from("employee_documents")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(payload) {
  const { data, error } = await supabaseAdmin
    .from("employee_documents")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function deleteForEmployee(id, employeeId) {
  const { data, error } = await supabaseAdmin
    .from("employee_documents")
    .delete()
    .eq("id", id)
    .eq("employee_id", employeeId)
    .select("id, storage_path")
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { listByEmployee, findByIdForEmployee, create, deleteForEmployee };
