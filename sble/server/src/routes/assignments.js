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

const guard = [keycloak.protect(), attachUser];

const isDeadlinePassed = (assignment) => assignment?.due_date && new Date(assignment.due_date).getTime() <= Date.now();

const hasGradedSubmission = async (assignmentId, studentId) => {
  const gradedSubmission = await Submission.findOne({
    where: {
      assignment_id: assignmentId,
      student_id: studentId,
      grade: { [Op.not]: null }
    }
  });

  return Boolean(gradedSubmission);
};

const getLatestSubmission = async (assignmentId, studentId) => Submission.findOne({
  where: {
    assignment_id: assignmentId,
    student_id: studentId
  },
  order: [['last_updated_time', 'DESC'], ['submitted_at', 'DESC']]
});

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

// Create assignment
router.post('/', ...guard, requireLecturer, authorizeCourseAccess(req => req.body.course_id, { managerOnly: true }), async (req, res) => {
  try {
    const { course_id, title, description, due_date, allows_handwritten } = req.body;
    const assignment = await Assignment.create({
      course_id, title, description, due_date,
      allows_handwritten: allows_handwritten ?? true,
      created_by: req.user.id
    });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

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
      mySubmission: latestByAssignment.get(assignment.id) || null
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

      if (await hasGradedSubmission(req.params.id, req.user.id)) {
        return res.status(403).json({ error: 'Submission has already been graded and can no longer be modified' });
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

    if (
      submission.grade !== null
      && submission.grade !== undefined
      || await hasGradedSubmission(submission.assignment_id, req.user.id)
    ) {
      return res.status(403).json({ error: 'Submission has already been graded and can no longer be modified' });
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

// List submissions after deadline (lecturers only)
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
      const assignment = req.assignment;

      if (!isDeadlinePassed(assignment)) {
        return res.status(403).json({ error: 'Submissions cannot be viewed until the deadline has passed' });
      }

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
    const { grade, feedback } = req.body;
    const submission = req.submission;

    if (!isDeadlinePassed(submission.Assignment)) {
      return res.status(403).json({ error: 'Submissions cannot be viewed or graded until the deadline has passed' });
    }

    await submission.update({ grade, feedback, last_updated_time: new Date() });

    // Notify student via email and SSE
    if (submission.student) {
      sendGradeNotification(submission.student.email, submission.Assignment.title, grade, feedback);
      sendToUser(submission.student.id, 'grade', {
        message: `Your submission for "${submission.Assignment.title}" was graded: ${grade}`
      });
    }

    res.json(submission);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
