const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { supabaseAdmin } = require("../config/supabase");
const attachmentRepository = require("../repositories/attachmentRepository");
const transactionRepository = require("../repositories/transactionRepository");
const { uploadPrivateFile, getSignedDocumentUrl } = require("../utils/upload");
const env = require("../config/env");

async function assertTransactionInWorkspace(transactionId, workspaceId) {
  const transaction = await transactionRepository.findByIdInWorkspaceForApproval(
    transactionId,
    workspaceId
  );
  if (!transaction) throw new ApiError(404, "Transaction not found");
  return transaction;
}

// @desc    List attachments for a transaction (each with a fresh signed URL)
// @route   GET /api/transactions/:transactionId/attachments
// @access  Private (transactions.read)
const listAttachments = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { transactionId } = req.params;
  await assertTransactionInWorkspace(transactionId, req.workspace.id);

  const attachments = await attachmentRepository.listByTransaction(transactionId);

  const withUrls = await Promise.all(
    attachments.map(async (a) => ({
      id: a.id,
      transactionId: a.transaction_id,
      fileName: a.file_name,
      mimeType: a.mime_type,
      uploadedBy: a.uploaded_by,
      createdAt: a.created_at,
      url: await getSignedDocumentUrl(supabaseAdmin, a.storage_path),
    }))
  );

  return sendSuccess(res, { message: "Attachments fetched successfully", data: withUrls });
});

// @desc    Upload an attachment for a transaction
// @route   POST /api/transactions/:transactionId/attachments
// @access  Private (transactions.edit)
const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { transactionId } = req.params;
  await assertTransactionInWorkspace(transactionId, req.workspace.id);

  if (!req.file) throw new ApiError(400, "A file is required");

  const storagePath = await uploadPrivateFile(
    supabaseAdmin,
    req.file,
    `transaction-attachments/${transactionId}`
  );

  const attachment = await attachmentRepository.create({
    transaction_id: transactionId,
    file_name: req.file.originalname,
    mime_type: req.file.mimetype,
    storage_path: storagePath,
    uploaded_by: req.user.id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Attachment uploaded successfully",
    data: attachment,
  });
});

// @desc    Delete a transaction attachment
// @route   DELETE /api/transactions/:transactionId/attachments/:attachmentId
// @access  Private (transactions.edit)
const deleteAttachment = asyncHandler(async (req, res) => {
  if (!req.workspace) {
    throw new ApiError(400, "No active workspace resolved for this request");
  }

  const { transactionId, attachmentId } = req.params;
  await assertTransactionInWorkspace(transactionId, req.workspace.id);

  const existing = await attachmentRepository.findByIdForTransaction(attachmentId, transactionId);
  if (!existing) throw new ApiError(404, "Attachment not found");

  // Best-effort storage cleanup — same fail-open-but-loud pattern as
  // employeeDocumentService.js's delete path in Sprint 2.
  try {
    const bucket = env.SUPABASE_STORAGE_BUCKET;
    await supabaseAdmin.storage.from(bucket).remove([existing.storage_path]);
  } catch (storageError) {
    // eslint-disable-next-line no-console
    console.error(
      `[attachmentController] Failed to remove storage object for attachment ${attachmentId}:`,
      storageError.message
    );
  }

  const deleted = await attachmentRepository.deleteForTransaction(attachmentId, transactionId);

  return sendSuccess(res, {
    message: "Attachment deleted successfully",
    data: { id: deleted.id },
  });
});

module.exports = { listAttachments, uploadAttachment, deleteAttachment };