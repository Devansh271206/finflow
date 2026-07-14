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

const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE) || 5 * 1024 * 1024; // 5MB default

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
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "finflow-uploads";
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

module.exports = { upload, uploadToSupabaseStorage };
