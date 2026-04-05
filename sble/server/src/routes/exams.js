const router = require('express').Router();
const fs = require('fs');
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, authorizeCourseAccess, audit } = require('../middleware/auth');
const { upload } = require('../services/storage/uploadService');
const { encryptFile, decryptFileToStream } = require('../services/encryption/fileEncryption');
const { Exam, Enrollment, User, Course } = require('../models');
const { sendExamReleaseNotification } = require('../services/email/emailService');
const { broadcast } = require('../services/notifications/sseService');

const guard = [keycloak.protect(), attachUser];

// List exams for a course
router.get('/course/:courseId', ...guard, authorizeCourseAccess(req => req.params.courseId), async (req, res) => {
  try {
    const isLecturer = req.user.roles.includes('lecturer') || req.user.roles.includes('admin');
    const where = { course_id: req.params.courseId };
    if (!isLecturer) where.is_released = true;
    const exams = await Exam.findAll({ where });
    res.json(exams);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Upload exam paper (encrypted — not released until scheduled time)
router.post('/upload', ...guard, requireLecturer,
  authorizeCourseAccess(req => req.body.course_id, { managerOnly: true, managerMessage: 'Forbidden: only the assigned lecturer or admin can manage this exam' }),
  (req, res, next) => { req.uploadFolder = 'exams'; next(); },
  upload.single('file'),
  audit('UPLOAD_EXAM', 'exam'),
  async (req, res) => {
    try {
      const { course_id, title, scheduled_at, duration_minutes } = req.body;
      const encryptedPath = await encryptFile(req.file.path);

      const exam = await Exam.create({
        course_id, title,
        file_path: encryptedPath,
        scheduled_at, duration_minutes,
        created_by: req.user.id
      });

      res.status(201).json(exam);
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Release exam (make available to students)
router.patch('/:id/release', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const exam = await Exam.findByPk(req.params.id, {
      include: [{ model: Course, attributes: ['title', 'id'] }]
    });
    if (!exam) {
      const err = new Error('Exam not found');
      err.status = 404;
      throw err;
    }
    req.exam = exam;
    return exam.course_id;
  }, { managerOnly: true, managerMessage: 'Forbidden: only the assigned lecturer or admin can manage this exam' }),
  async (req, res) => {
  try {
    const exam = req.exam;
    await exam.update({ is_released: true });

    // Notify enrolled students via email and SSE
    const enrollments = await Enrollment.findAll({
      where: { course_id: exam.course_id },
      include: [{ model: User, as: 'student', attributes: ['email', 'id'] }]
    });
    const emails = enrollments.map(e => e.student?.email).filter(Boolean);
    sendExamReleaseNotification(emails, exam.title, exam.Course?.title || '');
    broadcast('exam-released', { examId: exam.id, title: exam.title, courseId: exam.course_id });

    res.json(exam);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Download exam paper (only if released or lecturer)
router.get('/:id/download', ...guard,
  authorizeCourseAccess(async (req) => {
    const exam = await Exam.findByPk(req.params.id);
    if (!exam) {
      const err = new Error('Exam not found');
      err.status = 404;
      throw err;
    }
    req.exam = exam;
    return exam.course_id;
  }),
  audit('DOWNLOAD_EXAM', 'exam'), async (req, res) => {
  try {
    const exam = req.exam;

    const isLecturer = req.user.roles.includes('lecturer') || req.user.roles.includes('admin');
    if (!exam.is_released && !isLecturer) {
      return res.status(403).json({ error: 'Exam not yet released' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="exam_${exam.id}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    await decryptFileToStream(exam.file_path, res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
