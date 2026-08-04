import { apiGet, apiUpload, apiDelete } from "../lib/apiClient";

/**
 * Transaction-level attachments (Sprint 4) — distinct from a
 * transaction's single receiptImage field. Each item includes a `url`
 * that is a freshly-generated, short-lived signed URL (same ~5 minute
 * pattern as employeeDocumentService.js) — never cache/reuse it.
 */
export async function listTransactionAttachments(transactionId) {
  return apiGet(`/transactions/${transactionId}/attachments`);
}

export async function uploadTransactionAttachment(transactionId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload(`/transactions/${transactionId}/attachments`, formData);
}

export async function deleteTransactionAttachment(transactionId, attachmentId) {
  return apiDelete(`/transactions/${transactionId}/attachments/${attachmentId}`);
}
