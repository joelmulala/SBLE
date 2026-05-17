const router = require('express').Router();
const fs = require('fs');
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, authorizeCourseAccess, audit } = require('../middleware/auth');
const { upload } = require('../services/storage/uploadService');
const { encryptFile, decryptFileToStream } = require('../services/encryption/fileEncryption');
const { Exam, ExamStudentAccess, Enrollment, User, Course } = require('../models');
const { requireNonemptyTitle } = require('../utils/validation');
const { parseDbDate, toSequelizeDate } = require('../utils/datetime');
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
  return parseDbDate(value, fieldName);
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

const getExamRow = (exam) => (exam?.get ? exam.get({ plain: true }) : exam);

const getExamWindow = (exam, overrides = {}, { defaultStartNow = false } = {}) => {
  const row = getExamRow(exam);
  const startTime = parseOptionalDate(
    overrides.start_time
      ?? overrides.scheduled_at
      ?? row?.start_time
      ?? row?.scheduled_at
      ?? (defaultStartNow ? new Date() : null),
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

  const now = Date.now();
  let window_status = 'open';
  if (startTime && now < startTime.getTime()) window_status = 'upcoming';
  else if (endTime && now >= endTime.getTime()) window_status = 'ended';
  exam.setDataValue('window_status', window_status);

  return exam;
};

const filterExamsForStudent = (exams) => exams.filter((exam) => exam.is_released);

const attachStudentExamAccess = async (exams, studentId) => {
  if (!exams.length) return exams;
  const ids = exams.map((e) => e.id);
  const rows = await ExamStudentAccess.findAll({
    where: { student_id: studentId, exam_id: ids }
  });
  const byExam = new Map(rows.map((r) => [r.exam_id, r]));
  exams.forEach((exam) => {
    const row = byExam.get(exam.id);
    exam.setDataValue('myAccess', row ? { accessed_at: row.accessed_at } : null);
  });
  return exams;
};

const ensureExamWindowOpenForStudent = (exam) => {
  const { startTime, endTime } = getExamWindow(exam);
  const now = Date.now();

  if (startTime && now < startTime.getTime()) {
    const err = new Error('Exam not available yet');
    err.status = 403;
    throw err;
  }

  if (endTime && now >= endTime.getTime()) {
    const err = new Error('Exam window has ended');
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
      return res.json(filterExamsForStudent(decorated));
    }

    res.json(decorated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// List exams for a course
router.get('/course/:courseId', ...guard, authorizeCourseAccess(req => req.params.courseId), async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isFinite(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const roles = req.user.roles || (req.user.role ? [req.user.role] : []);
    const isLecturer = roles.includes('lecturer') || roles.includes('admin');
    const where = { course_id: courseId };
    if (!isLecturer) where.is_released = true;

    const exams = await Exam.findAll({ where, order: [['scheduled_at', 'ASC'], ['created_at', 'DESC']] });
    let decorated = exams.map(decorateExam);

    if (!isLecturer) {
      decorated = filterExamsForStudent(decorated);
      decorated = await attachStudentExamAccess(decorated, req.user.id);
      return res.json(decorated);
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
      if (!req.file?.path) {
        return res.status(400).json({ error: 'A file is required' });
      }

      const courseId = req.body.courseId;
      const title = requireNonemptyTitle(req.body.title);
      const { startTime, durationMinutes } = getExamWindow(null, req.body, { defaultStartNow: true });
      const encryptedPath = await encryptFile(req.file.path);

      const exam = await Exam.create({
        course_id: courseId,
        title,
        file_path: encryptedPath,
        scheduled_at: toSequelizeDate(startTime, 'start_time'),
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
      scheduled_at: toSequelizeDate(startTime, 'start_time'),
      duration_minutes: durationMinutes
    });
    await exam.reload();

    try {
      const enrollments = await Enrollment.findAll({
        where: { course_id: exam.course_id },
        include: [{ model: User, as: 'student', attributes: ['email', 'id'] }]
      });
      const emails = enrollments.map((e) => e.student?.email).filter(Boolean);
      sendExamReleaseNotification(emails, exam.title, exam.Course?.title || '').catch(() => {});
      broadcast('exam-released', { examId: exam.id, title: exam.title, courseId: exam.course_id });
    } catch (notifyErr) {
      // Release must succeed even if notifications fail
    }

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
      await ExamStudentAccess.findOrCreate({
        where: { exam_id: exam.id, student_id: req.user.id },
        defaults: { accessed_at: new Date() }
      });
    }

    res.setHeader('Content-Disposition', `attachment; filename="exam_${exam.id}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    await decryptFileToStream(exam.file_path, res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id/participants', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const exam = await Exam.findByPk(req.params.id);
    if (!exam) {
      const err = new Error('Exam not found');
      err.status = 404;
      throw err;
    }
    return exam.course_id;
  }, { managerOnly: true }), async (req, res) => {
  try {
    const exam = await Exam.findByPk(req.params.id);
    const accesses = await ExamStudentAccess.findAll({
      where: { exam_id: req.params.id },
      include: [{ model: User, as: 'student', attributes: ['id', 'full_name', 'email', 'student_id'] }],
      order: [['accessed_at', 'DESC']]
    });

    const enrollmentCount = await Enrollment.count({ where: { course_id: exam.course_id } });

    res.json({
      enrollmentCount,
      participants: accesses.map((row) => ({
        id: row.id,
        accessed_at: row.accessed_at,
        student: row.student ? {
          id: row.student.id,
          full_name: row.student.full_name,
          email: row.student.email,
          student_id: row.student.student_id
        } : null
      }))
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
