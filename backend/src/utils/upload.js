/**
 * Multer configuration for handling multipart/form-data file uploads
 * (e.g. transaction receipts, profile avatars) before they are pushed
 * to Supabase Storage by the relevant controller.
 *
 * Files are kept in memory (not written to disk) since we immediately
 * stream the buffer to Supabase Storage.
 */

const multer = require("multer");
const ApiError = require("./ApiError");
const env = require("../config/env");

const MAX_UPLOAD_SIZE = env.MAX_UPLOAD_SIZE;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new ApiError(415, `Unsupported file type: ${file.mimetype}`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter,
});

/**
 * Uploads a buffer to the configured Supabase Storage bucket and
 * returns its public URL.
 */
async function uploadToSupabaseStorage(supabaseAdmin, file, folder = "misc") {
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const fileExt = file.originalname.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExt}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new ApiError(500, `Failed to upload file: ${uploadError.message}`);
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * Uploads a buffer to the configured Supabase Storage bucket and
 * returns its storage path (NOT a public URL) — for content that
 * should never be reachable via a permanent public link (currently:
 * employee_documents, PRD §13.3's most sensitive data class). Pair
 * with getSignedDocumentUrl() to generate a short-lived, time-limited
 * URL on read. This is additive alongside uploadToSupabaseStorage()
 * above, not a replacement for it — transaction receipts/avatars keep
 * using the existing public-URL function unchanged.
 */
async function uploadPrivateFile(supabaseAdmin, file, folder = "misc") {
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const fileExt = file.originalname.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExt}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new ApiError(500, `Failed to upload file: ${uploadError.message}`);
  }

  return fileName;
}

// Default expiry for signed document URLs. Short enough that a leaked
// URL (e.g. pasted into a chat, cached in browser history) stops
// working quickly; long enough to cover a normal single view/download
// without needing a second request. A judgment call, not a spec'd
// value — revisit if real usage shows it's too tight or too loose.
const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

/**
 * Generates a fresh, time-limited signed URL for a private storage
 * object. Never cache/persist the result — call this again on every
 * read (see employeeDocumentService.js).
 */
async function getSignedDocumentUrl(supabaseAdmin, storagePath, expiresInSeconds = SIGNED_URL_EXPIRY_SECONDS) {
  const bucket = env.SUPABASE_STORAGE_BUCKET;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw new ApiError(500, `Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

module.exports = {
  upload,
  uploadToSupabaseStorage,
  uploadPrivateFile,
  getSignedDocumentUrl,
};