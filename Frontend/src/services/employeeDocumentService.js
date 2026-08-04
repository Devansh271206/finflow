import { apiGet, apiUpload, apiDelete } from "../lib/apiClient";

/**
 * List documents for an employee. Each item includes a `url` that is a
 * freshly-generated, short-lived signed URL (currently ~5 minutes) —
 * never cache/reuse it; re-fetch the list if the user revisits after a
 * while (see backend utils/upload.js:getSignedDocumentUrl).
 */
export async function listEmployeeDocuments(employeeId) {
  return apiGet(`/employees/${employeeId}/documents`);
}

/**
 * Upload a document for an employee.
 * @param {string} employeeId
 * @param {File} file
 * @param {string} documentType - one of: offer_letter, id_proof,
 *   contract, certification, other
 */
export async function uploadEmployeeDocument(employeeId, file, documentType) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);
  return apiUpload(`/employees/${employeeId}/documents`, formData);
}

export async function deleteEmployeeDocument(employeeId, documentId) {
  return apiDelete(`/employees/${employeeId}/documents/${documentId}`);
}
