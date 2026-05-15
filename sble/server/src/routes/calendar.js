const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, authorizeCourseAccess, audit } = require('../middleware/auth');
const {
  getCalendarEvents,
  getUpcomingEvents,
  createCustomEvent,
  deleteCustomEvent
} = require('../services/academic/calendarService');

const guard = [keycloak.protect(), attachUser];

router.get('/', ...guard, async (req, res) => {
  try {
    const { from, to, courseId } = req.query;
    const payload = await getCalendarEvents(req.user.id, req.user.role, { from, to, courseId });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/upcoming', ...guard, async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit || '8', 10);
    const { courseId } = req.query;
    const payload = await getUpcomingEvents(req.user.id, req.user.role, { limit, courseId });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/course/:courseId/events', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.courseId, { managerOnly: true }),
  audit('CREATE_CALENDAR_EVENT', 'calendar'),
  async (req, res) => {
    try {
      const created = await createCustomEvent(
        req.params.courseId,
        req.user.id,
        req.body
      );
      res.status(201).json(created);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.delete('/course/:courseId/events/:eventId', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.courseId, { managerOnly: true }),
  audit('DELETE_CALENDAR_EVENT', 'calendar'),
  async (req, res) => {
    try {
      await deleteCustomEvent(req.params.eventId, req.params.courseId);
      res.json({ success: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

module.exports = router;
