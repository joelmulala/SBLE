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

const normalizeCourseId = (payload = {}) => {
  const rawValue = payload.courseId ?? payload.course_id;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeExamUploadBody = (req, res, next) => {
  const courseId = normalizeCourseId(req.body);

  if (!courseId) {
    return res.status(400).json({ error: 'courseId is required' });
  }

  req.body.courseId = courseId;
  req.body.course_id = courseId;
  next();
};

const parseOptionalDate = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`${fieldName} must be a valid date/time`);
    err.status = 400;
    throw err;
  }

  return date;
};

const resolveDurationMinutes = (value, fallback = 120) => {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const err = new Error('duration_minutes must be a positive integer');
    err.status = 400;
    throw err;
  }
  return parsed;
};

const toDatabaseTimestamp = (date) => {
  if (!date) return null;

  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const getExamWindow = (exam, overrides = {}, { defaultStartNow = false } = {}) => {
  const startTime = parseOptionalDate(
    overrides.start_time ?? overrides.scheduled_at ?? exam?.scheduled_at ?? (defaultStartNow ? new Date() : null),
    'start_time'
  );
  const requestedEndTime = parseOptionalDate(overrides.end_time ?? null, 'end_time');
  const explicitDuration = overrides.duration_minutes;

  if (requestedEndTime && !startTime) {
    const err = new Error('start_time is required when end_time is provided');
    err.status = 400;
    throw err;
  }

  let durationMinutes = resolveDurationMinutes(explicitDuration ?? exam?.duration_minutes ?? 120, 120);

  if (startTime && requestedEndTime) {
    if (requestedEndTime.getTime() <= startTime.getTime()) {
      const err = new Error('end_time must be later than start_time');
      err.status = 400;
      throw err;
    }

    if (explicitDuration === undefined || explicitDuration === null || explicitDuration === '') {
      durationMinutes = Math.max(1, Math.ceil((requestedEndTime.getTime() - startTime.getTime()) / 60000));
    }
  }

  const endTime = requestedEndTime || (startTime ? new Date(startTime.getTime() + durationMinutes * 60000) : null);
  return { startTime, endTime, durationMinutes };
};

const decorateExam = (exam) => {
  const { startTime, endTime, durationMinutes } = getExamWindow(exam);
  exam.setDataValue('start_time', startTime);
  exam.setDataValue('end_time', endTime);
  exam.setDataValue('duration_minutes', durationMinutes);
  return exam;
};

const ensureExamWindowOpenForStudent = (exam) => {
  const now = new Date();
  const start = new Date(exam.start_time || exam.scheduled_at);
  const end = new Date(start.getTime() + Number(exam.duration_minutes || 0) * 60000);

  if (
    Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || now < start
    || now > end
  ) {
    const err = new Error('Exam not available');
    err.status = 403;
    throw err;
  }
};

// List exams visible to the current user
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
    if (role === 'student') {
      where.is_released = true;
    }

    const exams = await Exam.findAll({ where, order: [['scheduled_at', 'ASC'], ['created_at', 'DESC']] });
    const decorated = exams.map(decorateExam);

    if (role === 'student') {
      const now = Date.now();
      return res.json(decorated.filter((exam) => {
        const { startTime, endTime } = getExamWindow(exam);
        if (startTime && now < startTime.getTime()) return false;
        if (endTime && now >= endTime.getTime()) return false;
        return true;
      }));
    }

    res.json(decorated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// List exams for a course
router.get('/course/:courseId', ...guard, authorizeCourseAccess(req => req.params.courseId), async (req, res) => {
  try {
    const roles = req.user.roles || (req.user.role ? [req.user.role] : []);
    const isLecturer = roles.includes('lecturer') || roles.includes('admin');
    const where = { course_id: req.params.courseId };
    if (!isLecturer) where.is_released = true;

    const exams = await Exam.findAll({ where, order: [['scheduled_at', 'ASC'], ['created_at', 'DESC']] });
    const decorated = exams.map(decorateExam);

    if (!isLecturer) {
      const now = Date.now();
      return res.json(decorated.filter((exam) => {
        const { startTime, endTime } = getExamWindow(exam);
        if (startTime && now < startTime.getTime()) return false;
        if (endTime && now >= endTime.getTime()) return false;
        return true;
      }));
    }

    res.json(decorated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Upload exam paper with start/end window and duration controls
router.post('/upload', ...guard, requireLecturer,
  (req, res, next) => { req.uploadFolder = 'exams'; next(); },
  upload.single('file'),
  normalizeExamUploadBody,
  authorizeCourseAccess(req => req.body.courseId, { managerOnly: true, managerMessage: 'Forbidden: only the assigned lecturer or admin can manage this exam' }),
  audit('UPLOAD_EXAM', 'exam'),
  async (req, res) => {
    try {
      const { courseId, title } = req.body;
      const { startTime, durationMinutes } = getExamWindow(null, req.body, { defaultStartNow: true });
      const encryptedPath = await encryptFile(req.file.path);

      const exam = await Exam.create({
        course_id: courseId,
        title,
        file_path: encryptedPath,
        scheduled_at: toDatabaseTimestamp(startTime),
        duration_minutes: durationMinutes,
        created_by: req.user.id
      });

      res.status(201).json(decorateExam(exam));
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Release exam (make available to students within configured time window)
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
    const { startTime, durationMinutes } = getExamWindow(exam, req.body, { defaultStartNow: true });

    await exam.update({
      is_released: true,
      scheduled_at: toDatabaseTimestamp(startTime),
      duration_minutes: durationMinutes
    });

    // Notify enrolled students via email and SSE
    const enrollments = await Enrollment.findAll({
      where: { course_id: exam.course_id },
      include: [{ model: User, as: 'student', attributes: ['email', 'id'] }]
    });
    const emails = enrollments.map(e => e.student?.email).filter(Boolean);
    sendExamReleaseNotification(emails, exam.title, exam.Course?.title || '');
    broadcast('exam-released', { examId: exam.id, title: exam.title, courseId: exam.course_id });

    res.json(decorateExam(exam));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Download exam paper only within the allowed window for students
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
    const exam = decorateExam(req.exam);

    const roles = req.user.roles || (req.user.role ? [req.user.role] : []);
    const isLecturer = roles.includes('lecturer') || roles.includes('admin');
    if (!exam.is_released && !isLecturer) {
      return res.status(403).json({ error: 'Exam not yet released' });
    }

    if (!isLecturer) {
      ensureExamWindowOpenForStudent(exam);
    }

    res.setHeader('Content-Disposition', `attachment; filename="exam_${exam.id}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    await decryptFileToStream(exam.file_path, res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
