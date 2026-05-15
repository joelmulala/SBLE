const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser, authorizeCourseAccess } = require('../middleware/auth');
const { Course } = require('../models');
const {
  getCourseGradebook,
  getGlobalGradebook,
  getStudentBreakdown,
  getCoursePerformance
} = require('../services/academic/gradebookService');

const guard = [keycloak.protect(), attachUser];

router.get('/', ...guard, async (req, res) => {
  try {
    const courses = await getGlobalGradebook(req.user.id, req.user.role);
    res.json({ courses });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/course/:courseId', ...guard, authorizeCourseAccess((req) => req.params.courseId), async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const course = await Course.findByPk(courseId, { attributes: ['id', 'title'] });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const viewerRole = req.user.role === 'student' ? 'student' : 'lecturer';
    const gradebook = await getCourseGradebook(courseId, {
      viewerUserId: req.user.id,
      viewerRole
    });

    res.json({
      course: { id: course.id, title: course.title },
      ...gradebook
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/course/:courseId/statistics', ...guard, authorizeCourseAccess((req) => req.params.courseId, {
  managerOnly: true,
  managerMessage: 'Forbidden: only the assigned lecturer can view gradebook statistics'
}), async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const gradebook = await getCourseGradebook(courseId, { viewerRole: 'lecturer' });
    res.json({
      courseId,
      statistics: gradebook.statistics,
      categories: gradebook.categories,
      weights: gradebook.weights
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/course/:courseId/student/:studentUserId', ...guard, authorizeCourseAccess((req) => req.params.courseId), async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    const { studentUserId } = req.params;

    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const isSelf = String(studentUserId) === String(req.user.id);
    const isManager = req.user.role === 'lecturer' || req.user.role === 'admin';

    if (!isSelf && !isManager) {
      return res.status(403).json({ error: 'Forbidden: cannot view another student\'s grades' });
    }

    if (req.user.role === 'student' && !isSelf) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const viewerRole = req.user.role === 'student' ? 'student' : 'lecturer';
    const breakdown = await getStudentBreakdown(courseId, studentUserId, { viewerRole });

    res.json({ courseId, student: breakdown });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/course/:courseId/performance', ...guard, authorizeCourseAccess((req) => req.params.courseId, {
  managerOnly: true,
  managerMessage: 'Forbidden: only the assigned lecturer can view performance analytics'
}), async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const payload = await getCoursePerformance(courseId);
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
