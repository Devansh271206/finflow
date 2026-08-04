/**
 * Employee Document Service
 * ------------------------------------------------------------------
 * Business logic for employee_documents. Handles the actual Supabase
 * Storage upload (via the new uploadPrivateFile() helper in
 * utils/upload.js — signed-URL pattern, not the existing public-URL
 * uploadToSupabaseStorage()) and generates a fresh signed URL on every
 * read rather than storing/returning a permanent link.
 */

const { supabaseAdmin } = require("../config/supabase");
const employeeDocumentRepository = require("../repositories/employeeDocumentRepository");
const employeeRepository = require("../repositories/employeeRepository");
const { uploadPrivateFile, getSignedDocumentUrl } = require("../utils/upload");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const VALID_DOCUMENT_TYPES = [
  "offer_letter",
  "id_proof",
  "contract",
  "certification",
  "other",
];

async function assertEmployeeInWorkspace(employeeId, workspaceId) {
  const employee = await employeeRepository.findByIdInWorkspace(employeeId, workspaceId);
  if (!employee) throw new ApiError(404, "Employee not found");
  return employee;
}

/**
 * Lists an employee's documents with a freshly-generated signed URL
 * attached to each — URLs are never persisted, only the storage_path
 * is, so every list/read call issues new signed URLs.
 */
async function listForEmployee(employeeId, workspaceId) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);

  const documents = await employeeDocumentRepository.listByEmployee(employeeId);

  const withUrls = await Promise.all(
    documents.map(async (doc) => ({
      id: doc.id,
      employeeId: doc.employee_id,
      documentType: doc.document_type,
      uploadedBy: doc.uploaded_by,
      createdAt: doc.created_at,
      url: await getSignedDocumentUrl(supabaseAdmin, doc.storage_path),
    }))
  );

  return withUrls;
}

async function uploadForEmployee(employeeId, workspaceId, { documentType, file, uploadedBy }) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);

  if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
    throw new ApiError(
      400,
      `documentType must be one of: ${VALID_DOCUMENT_TYPES.join(", ")}`
    );
  }
  if (!file) throw new ApiError(400, "A file is required");

  const storagePath = await uploadPrivateFile(supabaseAdmin, file, `employee-documents/${employeeId}`);

  return employeeDocumentRepository.create({
    employee_id: employeeId,
    document_type: documentType,
    storage_path: storagePath,
    uploaded_by: uploadedBy,
  });
}

async function deleteForEmployee(employeeId, workspaceId, documentId) {
  await assertEmployeeInWorkspace(employeeId, workspaceId);

  const existing = await employeeDocumentRepository.findByIdForEmployee(documentId, employeeId);
  if (!existing) throw new ApiError(404, "Document not found");

  // Best-effort storage cleanup — a failed storage delete should not
  // block the metadata row from being removed, but shouldn't be silent
  // either. Mirrors the audit-log failure handling in
  // salaryHistoryService.js.
  try {
    const bucket = env.SUPABASE_STORAGE_BUCKET;
    await supabaseAdmin.storage.from(bucket).remove([existing.storage_path]);
  } catch (storageError) {
    // eslint-disable-next-line no-console
    console.error(
      `[employeeDocumentService] Failed to remove storage object for document ${documentId}:`,
      storageError.message
    );
  }

  return employeeDocumentRepository.deleteForEmployee(documentId, employeeId);
}

module.exports = {
  VALID_DOCUMENT_TYPES,
  listForEmployee,
  uploadForEmployee,
  deleteForEmployee,
};