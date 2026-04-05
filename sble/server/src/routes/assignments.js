const router = require('express').Router();
const fs = require('fs');
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, requireStudent, authorizeCourseAccess, audit } = require('../middleware/auth');
const { upload } = require('../services/storage/uploadService');
const { encryptFile } = require('../services/encryption/fileEncryption');
const { Assignment, Submission, User } = require('../models');
const { sendGradeNotification } = require('../services/email/emailService');
const { sendToUser } = require('../services/notifications/sseService');

const guard = [keycloak.protect(), attachUser];

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
    const assignments = await Assignment.findAll({ where: { course_id: req.params.courseId } });
    res.json(assignments);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Submit assignment (supports scanned/handwritten PDF/image upload)
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
      const { submission_type } = req.body;
      let file_path = null;
      let file_name = null;

      if (req.file) {
        file_path = await encryptFile(req.file.path);
        file_name = req.file.originalname;
      }

      const submission = await Submission.create({
        assignment_id: req.params.id,
        student_id: req.user.id,
        file_path,
        file_name,
        submission_type: submission_type || 'typed'
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

// Grade a submission (lecturers only)
router.patch('/submissions/:id/grade', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const submission = await Submission.findByPk(req.params.id, {
      include: [
        { model: Assignment, attributes: ['title', 'course_id'] },
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
    await submission.update({ grade, feedback });

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
