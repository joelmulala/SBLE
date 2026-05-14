const router = require('express').Router();
const fs = require('fs');
const { Op } = require('sequelize');
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, requireStudent, authorizeCourseAccess, audit } = require('../middleware/auth');
const { upload } = require('../services/storage/uploadService');
const { encryptFile, decryptFileToStream } = require('../services/encryption/fileEncryption');
const { Assignment, Submission, User, Course, Enrollment } = require('../models');
const { sendGradeNotification } = require('../services/email/emailService');
const { sendToUser } = require('../services/notifications/sseService');
const { maskSubmissionForStudentView, submissionLocksStudentEdits } = require('../services/assessment/assignmentGradingView');

const guard = [keycloak.protect(), attachUser];

const isDeadlinePassed = (assignment) => assignment?.due_date && new Date(assignment.due_date).getTime() <= Date.now();

const hasLockedSubmission = async (assignmentId, studentId) => {
  const submission = await Submission.findOne({
    where: {
      assignment_id: assignmentId,
      student_id: studentId
    },
    order: [['last_updated_time', 'DESC'], ['submitted_at', 'DESC']]
  });

  return submissionLocksStudentEdits(submission);
};

const getLatestSubmission = async (assignmentId, studentId) => Submission.findOne({
  where: {
    assignment_id: assignmentId,
    student_id: studentId
  },
  order: [['last_updated_time', 'DESC'], ['submitted_at', 'DESC']]
});

const normalizeCourseId = (payload = {}) => {
  const rawValue = payload.courseId ?? payload.course_id;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeAssignmentPayload = (req, res, next) => {
  const courseId = normalizeCourseId(req.body);

  if (!courseId) {
    return res.status(400).json({ error: 'courseId is required' });
  }

  req.body.courseId = courseId;
  req.body.course_id = courseId;
  next();
};

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return fallback;
};

// List assignments visible to the current user
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

    const where = role === 'admin' ? {} : { course_id: { [Op.in]: courseIds } };
    const assignments = await Assignment.findAll({ where, order: [['created_at', 'DESC']] });
    res.json(assignments);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Create assignment with optional attachment
router.post('/', ...guard, requireLecturer,
  (req, res, next) => { req.uploadFolder = 'assignments'; next(); },
  upload.single('file'),
  normalizeAssignmentPayload,
  authorizeCourseAccess(req => req.body.course_id, { managerOnly: true }),
  async (req, res) => {
    let encryptedPath = null;

    try {
      const { course_id, title, description, due_date, allows_handwritten } = req.body;

      if (req.file?.path) {
        encryptedPath = await encryptFile(req.file.path);
      }

      const assignment = await Assignment.create({
        course_id,
        title,
        description,
        due_date: due_date || null,
        file_path: encryptedPath,
        file_name: req.file?.originalname || null,
        file_type: req.file?.mimetype || null,
        is_encrypted: Boolean(encryptedPath),
        allows_handwritten: parseBoolean(allows_handwritten, true),
        created_by: req.user.id
      });

      res.status(201).json(assignment);
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (encryptedPath && fs.existsSync(encryptedPath)) {
        fs.unlinkSync(encryptedPath);
      }
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.get('/:id/download', ...guard,
  authorizeCourseAccess(async (req) => {
    const assignment = await Assignment.findByPk(req.params.id);
    if (!assignment) {
      const err = new Error('Assignment not found');
      err.status = 404;
      throw err;
    }
    req.assignment = assignment;
    return assignment.course_id;
  }),
  audit('DOWNLOAD_ASSIGNMENT', 'assignment'),
  async (req, res) => {
    try {
      const assignment = req.assignment;

      if (!assignment.file_path || !fs.existsSync(assignment.file_path)) {
        return res.status(404).json({ error: 'No assignment file is available for download' });
      }

      const fileName = assignment.file_name || `assignment-${assignment.id}`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', assignment.file_type || 'application/octet-stream');

      await decryptFileToStream(assignment.file_path, res);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Get assignments for a course
router.get('/course/:courseId', ...guard, authorizeCourseAccess(req => req.params.courseId), async (req, res) => {
  try {
    const assignments = await Assignment.findAll({
      where: { course_id: req.params.courseId },
      order: [['created_at', 'DESC']]
    });

    if (req.user.role !== 'student' || assignments.length === 0) {
      return res.json(assignments);
    }

    const submissions = await Submission.findAll({
      where: {
        student_id: req.user.id,
        assignment_id: { [Op.in]: assignments.map((assignment) => assignment.id) }
      },
      order: [['last_updated_time', 'DESC'], ['submitted_at', 'DESC']]
    });

    const latestByAssignment = new Map();
    submissions.forEach((submission) => {
      if (!latestByAssignment.has(submission.assignment_id)) {
        latestByAssignment.set(submission.assignment_id, submission.toJSON());
      }
    });

    res.json(assignments.map((assignment) => ({
      ...assignment.toJSON(),
      mySubmission: maskSubmissionForStudentView(latestByAssignment.get(assignment.id) || null)
    })));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Submit or resubmit assignment before deadline (students only)
router.post('/:id/submit', ...guard, requireStudent,
  authorizeCourseAccess(async (req) => {
    const assignment = await Assignment.findByPk(req.params.id);
    if (!assignment) {
      const err = new Error('Assignment not found');
      err.status = 404;
      throw err;
    }
    req.assignment = assignment;
    return assignment.course_id;
  }),
  (req, res, next) => { req.uploadFolder = 'submissions'; next(); },
  upload.single('file'),
  audit('SUBMIT_ASSIGNMENT', 'submission'),
  async (req, res) => {
    try {
      const assignment = req.assignment;

      if (isDeadlinePassed(assignment)) {
        return res.status(403).json({ error: 'Submission deadline has passed' });
      }

      if (await hasLockedSubmission(req.params.id, req.user.id)) {
        return res.status(403).json({ error: 'This submission has been graded and can no longer be modified' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'A submission file is required' });
      }

      const { submission_type } = req.body;
      const file_path = await encryptFile(req.file.path);
      const file_name = req.file.originalname;
      const timestamp = new Date();
      const existingSubmission = await getLatestSubmission(req.params.id, req.user.id);

      if (existingSubmission) {
        if (existingSubmission.file_path && fs.existsSync(existingSubmission.file_path)) {
          fs.unlinkSync(existingSubmission.file_path);
        }

        await existingSubmission.update({
          file_path,
          file_name,
          submission_type: submission_type || existingSubmission.submission_type || 'typed',
          submitted_at: timestamp,
          last_updated_time: timestamp
        });

        return res.json(existingSubmission);
      }

      const submission = await Submission.create({
        assignment_id: req.params.id,
        student_id: req.user.id,
        file_path,
        file_name,
        submission_type: submission_type || 'typed',
        submitted_at: timestamp,
        last_updated_time: timestamp
      });

      res.status(201).json(submission);
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Delete own submission before deadline (students only)
router.delete('/submissions/:id', ...guard, requireStudent,
  authorizeCourseAccess(async (req) => {
    const submission = await Submission.findByPk(req.params.id, {
      include: [{ model: Assignment, attributes: ['id', 'course_id', 'due_date'] }]
    });
    if (!submission) {
      const err = new Error('Submission not found');
      err.status = 404;
      throw err;
    }
    req.submission = submission;
    return submission.Assignment.course_id;
  }),
  audit('DELETE_SUBMISSION', 'submission'), async (req, res) => {
  try {
    const submission = req.submission;

    if (String(submission.student_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: you can only delete your own submission' });
    }

    if (submissionLocksStudentEdits(submission)) {
      return res.status(403).json({ error: 'This submission has been graded and can no longer be modified' });
    }

    if (isDeadlinePassed(submission.Assignment)) {
      return res.status(403).json({ error: 'Submission deadline has passed' });
    }

    if (submission.file_path && fs.existsSync(submission.file_path)) {
      fs.unlinkSync(submission.file_path);
    }

    await submission.destroy();
    res.json({ deleted: true, submission_id: Number(req.params.id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Download submission file (lecturers/admins only)
router.get('/submissions/:id/download', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const submission = await Submission.findByPk(req.params.id, {
      include: [{ model: Assignment, attributes: ['id', 'course_id'] }]
    });
    if (!submission) {
      const err = new Error('Submission not found');
      err.status = 404;
      throw err;
    }
    req.submission = submission;
    return submission.Assignment.course_id;
  }, { managerOnly: true, managerMessage: 'Forbidden: only the assigned lecturer or admin can download this submission' }),
  audit('DOWNLOAD_SUBMISSION', 'submission'), async (req, res) => {
  try {
    const submission = req.submission;

    if (!submission.file_path || !fs.existsSync(submission.file_path)) {
      return res.status(404).json({ error: 'Submission file not found' });
    }

    const fileName = submission.file_name || `submission-${submission.id}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    await decryptFileToStream(submission.file_path, res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// List submissions anytime for the assigned lecturer/admin
router.get('/:id/submissions', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const assignment = await Assignment.findByPk(req.params.id);
    if (!assignment) {
      const err = new Error('Assignment not found');
      err.status = 404;
      throw err;
    }
    req.assignment = assignment;
    return assignment.course_id;
  }, { managerOnly: true, managerMessage: 'Forbidden: only the assigned lecturer or admin can view these submissions' }),
  async (req, res) => {
    try {
      const submissions = await Submission.findAll({
        where: { assignment_id: req.params.id },
        include: [{ model: User, as: 'student', attributes: ['id', 'full_name', 'email'] }],
        order: [['last_updated_time', 'DESC'], ['submitted_at', 'DESC']]
      });

      res.json(submissions);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Grade a submission (lecturers only)
router.patch('/submissions/:id/grade', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const submission = await Submission.findByPk(req.params.id, {
      include: [
        { model: Assignment, attributes: ['title', 'course_id', 'due_date'] },
        { model: User, as: 'student', attributes: ['email', 'id'] }
      ]
    });
    if (!submission) {
      const err = new Error('Submission not found');
      err.status = 404;
      throw err;
    }
    req.submission = submission;
    return submission.Assignment.course_id;
  }, { managerOnly: true, managerMessage: 'Forbidden: only the assigned lecturer or admin can grade this assignment' }),
  async (req, res) => {
  try {
    const { grade, feedback, publish } = req.body;
    const submission = req.submission;

    const gradeNum = grade === '' || grade === undefined || grade === null ? null : Number(grade);
    if (publish && (gradeNum === null || Number.isNaN(gradeNum))) {
      return res.status(400).json({ error: 'Enter a numeric grade before publishing results to students.' });
    }

    let nextStatus = submission.grading_status || 'pending';
    if (publish) nextStatus = 'published';
    else if (gradeNum != null && !Number.isNaN(gradeNum)) nextStatus = 'graded';

    await submission.update({
      grade: gradeNum != null && !Number.isNaN(gradeNum) ? gradeNum : submission.grade,
      feedback: feedback !== undefined ? feedback : submission.feedback,
      grading_status: nextStatus,
      results_published_at: publish ? new Date() : submission.results_published_at,
      last_updated_time: new Date()
    });

    // Notify student via email and SSE when results are published
    if (publish && submission.student) {
      sendGradeNotification(
        submission.student.email,
        submission.Assignment.title,
        gradeNum,
        feedback !== undefined ? feedback : submission.feedback
      );
      sendToUser(submission.student.id, 'grade', {
        message: `Your results for "${submission.Assignment.title}" are now available (grade: ${gradeNum}).`
      });
    }

    res.json(submission);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
