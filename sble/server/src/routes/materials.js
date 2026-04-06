const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, authorizeCourseAccess, audit } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../services/storage/uploadService');
const { encryptFile, decryptFileToStream } = require('../services/encryption/fileEncryption');
const { Material, Course, Enrollment } = require('../models');

const guard = [keycloak.protect(), attachUser];

const normalizeCourseId = (payload = {}) => {
  const rawValue = payload.courseId ?? payload.course_id;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeMaterialUploadBody = (req, res, next) => {
  const courseId = normalizeCourseId(req.body);

  if (!courseId) {
    return res.status(400).json({ error: 'courseId is required' });
  }

  req.body.courseId = courseId;
  req.body.course_id = courseId;
  next();
};

// List materials visible to the current user
router.get('/', ...guard, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let courseIds = [];

    if (role === 'lecturer') {
      const courses = await Course.findAll({
        where: { lecturer_id: userId, is_active: true },
        attributes: ['id']
      });
      courseIds = courses.map((course) => course.id);
    } else if (role === 'student') {
      const enrollments = await Enrollment.findAll({
        where: { student_id: userId },
        attributes: ['course_id']
      });
      courseIds = enrollments.map((enrollment) => enrollment.course_id);
    }

    const where = role === 'admin' ? {} : { course_id: courseIds };
    const materials = await Material.findAll({ where, order: [['created_at', 'DESC']] });
    res.json(materials);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Upload learning material (lecturers only) — encrypted at rest
router.post('/upload', ...guard, requireLecturer,
  (req, res, next) => { req.uploadFolder = 'materials'; next(); },
  upload.single('file'),
  normalizeMaterialUploadBody,
  authorizeCourseAccess(req => req.body.courseId, { managerOnly: true }),
  audit('UPLOAD_MATERIAL', 'material'),
  async (req, res) => {
    try {
      const courseId = req.body.courseId;
      const { title } = req.body;
      const encryptedPath = await encryptFile(req.file.path);

      const material = await Material.create({
        course_id: courseId,
        title,
        file_path: encryptedPath,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        uploaded_by: req.user.id
      });

      res.status(201).json(material);
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// List materials for a course
router.get('/course/:courseId', ...guard, authorizeCourseAccess(req => req.params.courseId), async (req, res) => {
  try {
    const materials = await Material.findAll({ where: { course_id: req.params.courseId } });
    res.json(materials);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Download/stream decrypted material
router.get('/:id/download', ...guard,
  authorizeCourseAccess(async (req) => {
    const material = await Material.findByPk(req.params.id);
    if (!material) {
      const err = new Error('Material not found');
      err.status = 404;
      throw err;
    }
    req.material = material;
    return material.course_id;
  }),
  audit('DOWNLOAD_MATERIAL', 'material'), async (req, res) => {
  try {
    const material = req.material;

    res.setHeader('Content-Disposition', `attachment; filename="${material.file_name}"`);
    res.setHeader('Content-Type', material.file_type || 'application/octet-stream');

    await decryptFileToStream(material.file_path, res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
