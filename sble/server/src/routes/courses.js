const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, requireStudent, authorizeCourseAccess, audit } = require('../middleware/auth');
const { Course, Enrollment, User, Discussion } = require('../models');

const guard = [keycloak.protect(), attachUser];

const sanitizeMessage = (value) => String(value || '')
  .replace(/[<>]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// Get all courses (admins see all, lecturers see their own, students see enrolled)
router.get('/', ...guard, async (req, res) => {
  try {
    const { id, role } = req.user;
    let courses;

    if (role === 'admin') {
      courses = await Course.findAll({
        where: { is_active: true },
        include: [{ model: User, as: 'lecturer' }]
      });
    } else if (role === 'lecturer') {
      courses = await Course.findAll({
        where: { lecturer_id: id, is_active: true },
        include: [{ model: User, as: 'lecturer' }]
      });
    } else {
      const enrollments = await Enrollment.findAll({
        where: { student_id: id },
        include: [{ model: Course, include: [{ model: User, as: 'lecturer' }] }]
      });
      courses = enrollments.map(e => e.Course).filter(Boolean);
    }

    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create course (lecturers/admins only)
router.post('/', ...guard, requireLecturer, audit('CREATE_COURSE', 'course'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const course = await Course.create({ title, description, lecturer_id: req.user.id });
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enroll student in course (students only)
router.post('/:id/enroll', ...guard, requireStudent, audit('ENROLL_COURSE', 'course'), async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course || !course.is_active) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [enrollment, created] = await Enrollment.findOrCreate({
      where: {
        course_id: req.params.id,
        student_id: req.user.id
      },
      defaults: {
        course_id: req.params.id,
        student_id: req.user.id
      }
    });

    if (!created) {
      return res.status(409).json({ error: 'Already enrolled in this course' });
    }

    res.status(201).json(enrollment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update course (assigned lecturer/admin only)
router.put('/:id', ...guard, requireLecturer, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (req.user.role === 'lecturer' && String(course.lecturer_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: course not assigned to this lecturer' });
    }

    const { title, description } = req.body;

    if (title !== undefined && (!String(title).trim() || String(title).trim().length < 3)) {
      return res.status(400).json({ error: 'Title must be at least 3 characters long' });
    }

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be a string' });
    }

    await course.update({
      title: title !== undefined ? String(title).trim() : course.title,
      description: description !== undefined ? description.trim() : course.description
    });

    const updatedCourse = await Course.findByPk(req.params.id, {
      include: [{ model: User, as: 'lecturer' }]
    });

    res.json(updatedCourse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List course discussions (course members only)
router.get('/:id/discussions', ...guard, authorizeCourseAccess(req => req.params.id), async (req, res) => {
  try {
    const discussions = await Discussion.findAll({
      where: { course_id: req.params.id },
      include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }],
      order: [['created_at', 'ASC']]
    });

    res.json(discussions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post to course discussions (course members only)
router.post('/:id/discussions', ...guard, authorizeCourseAccess(req => req.params.id), audit('CREATE_DISCUSSION', 'discussion'), async (req, res) => {
  try {
    const message = sanitizeMessage(req.body?.message);
    if (!message) {
      return res.status(400).json({ error: 'Message must not be empty' });
    }

    const discussion = await Discussion.create({
      course_id: req.params.id,
      user_id: req.user.id,
      message
    });

    const createdDiscussion = await Discussion.findByPk(discussion.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }]
    });

    res.status(201).json(createdDiscussion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single course with RBAC-aware access control
router.get('/:id', ...guard, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id, { include: [{ model: User, as: 'lecturer' }] });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { role } = req.user;
    if (role === 'admin') return res.json(course);

    if (role === 'lecturer') {
      if (String(course.lecturer_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden: course not assigned to this lecturer' });
      }
      return res.json(course);
    }

    const enrollment = await Enrollment.findOne({
      where: { course_id: req.params.id, student_id: req.user.id }
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Forbidden: not enrolled in this course' });
    }

    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
