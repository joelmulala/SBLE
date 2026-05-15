const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser, authorizeCourseAccess } = require('../middleware/auth');
const { getCourseCommunicationHub } = require('../services/communication/communicationService');

const guard = [keycloak.protect(), attachUser];

router.get('/course/:courseId/hub', ...guard, authorizeCourseAccess((req) => req.params.courseId), async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const hub = await getCourseCommunicationHub(courseId, {
      userId: req.user.id,
      role: req.user.role
    });

    res.json(hub);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
