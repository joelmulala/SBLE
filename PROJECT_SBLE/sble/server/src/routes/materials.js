const router = require('express').Router();
const path = require('path');
const keycloak = require('../config/keycloak');
const { attachUser, requireRole, audit } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../services/storage/uploadService');
const { encryptFile, decryptFileToStream } = require('../services/encryption/fileEncryption');
const { Material } = require('../models');

const guard = [keycloak.protect(), attachUser];

// Upload learning material (lecturers only) — encrypted at rest
router.post('/upload', ...guard, requireRole('lecturer', 'admin'),
  (req, res, next) => { req.uploadFolder = 'materials'; next(); },
  upload.single('file'),
  audit('UPLOAD_MATERIAL', 'material'),
  async (req, res) => {
    try {
      const { course_id, title } = req.body;
      const encryptedPath = await encryptFile(req.file.path);

      const material = await Material.create({
        course_id,
        title,
        file_path: encryptedPath,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        uploaded_by: req.user.id
      });

      res.status(201).json(material);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// List materials for a course
router.get('/course/:courseId', ...guard, async (req, res) => {
  try {
    const materials = await Material.findAll({ where: { course_id: req.params.courseId } });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download/stream decrypted material
router.get('/:id/download', ...guard, audit('DOWNLOAD_MATERIAL', 'material'), async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    res.setHeader('Content-Disposition', `attachment; filename="${material.file_name}"`);
    res.setHeader('Content-Type', material.file_type || 'application/octet-stream');

    await decryptFileToStream(material.file_path, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
