const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../../config/logger');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');

// Ensure local upload directory exists (used as fallback or primary)
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// MinIO client — only initialised if MINIO_ENDPOINT is configured
let minioClient = null;
if (process.env.MINIO_ENDPOINT) {
  const Minio = require('minio');
  minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
  });
  logger.info('MinIO storage enabled');
} else {
  logger.warn('MINIO_ENDPOINT not set — using local disk storage');
}

const BUCKET = process.env.MINIO_BUCKET || 'sble-uploads';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(UPLOAD_DIR, req.uploadFolder || 'misc');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const ext = /^\.[a-z0-9]{1,10}$/.test(rawExt) ? rawExt : '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/**
 * Upload a file to MinIO if configured, otherwise keep it on local disk.
 * Returns the final storage path/key.
 */
const storeFile = async (localPath, folder = 'misc') => {
  if (!minioClient) return localPath; // local disk — path is already correct

  const objectName = `${folder}/${path.basename(localPath)}`;
  const exists = await minioClient.bucketExists(BUCKET).catch(() => false);
  if (!exists) await minioClient.makeBucket(BUCKET);

  await minioClient.fPutObject(BUCKET, objectName, localPath);
  fs.unlinkSync(localPath); // remove temp local file after upload
  logger.info(`Stored file in MinIO: ${objectName}`);
  return objectName; // return the MinIO object key
};

/**
 * Stream a file to a response — from MinIO if configured, otherwise local disk.
 */
const assertLocalPathSafe = (storagePath) => {
  const resolved = path.resolve(storagePath);
  const root = path.resolve(UPLOAD_DIR);
  if (!resolved.startsWith(root)) {
    const err = new Error('Invalid file path');
    err.status = 400;
    throw err;
  }
  return resolved;
};

const streamFile = async (storagePath, res) => {
  if (!minioClient) {
    const safePath = assertLocalPathSafe(storagePath);
    if (!fs.existsSync(safePath)) {
      const err = new Error('File not found');
      err.status = 404;
      throw err;
    }
    fs.createReadStream(safePath).pipe(res);
    return;
  }
  const stream = await minioClient.getObject(BUCKET, storagePath);
  stream.pipe(res);
};

module.exports = { upload, UPLOAD_DIR, storeFile, streamFile, ALLOWED_TYPES, assertLocalPathSafe };
