const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser } = require('../middleware/auth');
const { User } = require('../models');

// Sync Keycloak user into local DB on first login
router.post('/sync', keycloak.protect(), attachUser, async (req, res) => {
  try {
    const { id, email, name, roles } = req.user;
    const role = roles.includes('lecturer') ? 'lecturer'
      : roles.includes('admin') ? 'admin' : 'student';

    const [user, created] = await User.findOrCreate({
      where: { id },
      defaults: { email, full_name: name, role }
    });

    res.json({ user, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user profile
router.get('/me', keycloak.protect(), attachUser, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
