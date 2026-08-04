const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const employeeDocumentService = require("../services/employeeDocumentService");

// @desc    List documents for an employee (each with a fresh signed URL)
// @route   GET /api/employees/:employeeId/documents
// @access  Private (EMPLOYEES_READ)
const listDocuments = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;
  const data = await employeeDocumentService.listForEmployee(employeeId, req.workspace.id);

  return sendSuccess(res, { message: "Employee documents fetched successfully", data });
});

// @desc    Upload a document for an employee
// @route   POST /api/employees/:employeeId/documents
// @access  Private (EMPLOYEES_MANAGE)
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId } = req.params;
  const { documentType } = req.body;

  const data = await employeeDocumentService.uploadForEmployee(employeeId, req.workspace.id, {
    documentType,
    file: req.file,
    uploadedBy: req.user.id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Document uploaded successfully",
    data,
  });
});

// @desc    Delete an employee document
// @route   DELETE /api/employees/:employeeId/documents/:documentId
// @access  Private (EMPLOYEES_MANAGE)
const deleteDocument = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { employeeId, documentId } = req.params;
  const data = await employeeDocumentService.deleteForEmployee(
    employeeId,
    req.workspace.id,
    documentId
  );

  return sendSuccess(res, { message: "Document deleted successfully", data: { id: data.id } });
});

module.exports = { listDocuments, uploadDocument, deleteDocument };
