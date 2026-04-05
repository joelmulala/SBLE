const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser, requireRole, audit } = require('../middleware/auth');
const { Course, Enrollment, User } = require('../models');

const guard = [keycloak.protect(), attachUser];

// Get all courses (students see enrolled, lecturers see their own)
router.get('/', ...guard, async (req, res) => {
  try {
    const { id, roles } = req.user;
    let courses;
    if (roles.includes('admin') || roles.includes('lecturer')) {
      courses = await Course.findAll({ where: { lecturer_id: id, is_active: true } });
    } else {
      const enrollments = await Enrollment.findAll({ where: { student_id: id }, include: [Course] });
      courses = enrollments.map(e => e.Course);
    }
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create course (lecturers/admins only)
router.post('/', ...guard, requireRole('lecturer', 'admin'), audit('CREATE_COURSE', 'course'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const course = await Course.create({ title, description, lecturer_id: req.user.id });
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enroll student in course
router.post('/:id/enroll', ...guard, async (req, res) => {
  try {
    const enrollment = await Enrollment.create({
      course_id: req.params.id,
      student_id: req.user.id
    });
    res.status(201).json(enrollment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single course
router.get('/:id', ...guard, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id, { include: [{ model: User, as: 'lecturer' }] });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
