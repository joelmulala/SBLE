const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser, requireRole, audit } = require('../middleware/auth');
const { upload } = require('../services/storage/uploadService');
const { encryptFile } = require('../services/encryption/fileEncryption');
const { Assignment, Submission, User } = require('../models');
const { sendGradeNotification } = require('../services/email/emailService');
const { sendToUser } = require('../services/notifications/sseService');

const guard = [keycloak.protect(), attachUser];

// Create assignment
router.post('/', ...guard, requireRole('lecturer', 'admin'), async (req, res) => {
  try {
    const { course_id, title, description, due_date, allows_handwritten } = req.body;
    const assignment = await Assignment.create({
      course_id, title, description, due_date,
      allows_handwritten: allows_handwritten ?? true,
      created_by: req.user.id
    });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get assignments for a course
router.get('/course/:courseId', ...guard, async (req, res) => {
  try {
    const assignments = await Assignment.findAll({ where: { course_id: req.params.courseId } });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit assignment (supports scanned/handwritten PDF/image upload)
router.post('/:id/submit', ...guard,
  (req, res, next) => { req.uploadFolder = 'submissions'; next(); },
  upload.single('file'),
  audit('SUBMIT_ASSIGNMENT', 'submission'),
  async (req, res) => {
    try {
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
      res.status(500).json({ error: err.message });
    }
  }
);

// Grade a submission (lecturers only)
router.patch('/submissions/:id/grade', ...guard, requireRole('lecturer', 'admin'), async (req, res) => {
  try {
    const { grade, feedback } = req.body;
    const submission = await Submission.findByPk(req.params.id, {
      include: [
        { model: Assignment, attributes: ['title'] },
        { model: User, as: 'student', attributes: ['email', 'id'] }
      ]
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
