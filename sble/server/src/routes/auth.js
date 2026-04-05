const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { signToken } = require('../config/auth');
const { attachUser } = require('../middleware/auth');
const { User } = require('../models');

const authDisabled = process.env.AUTH_DISABLED === 'true';
const tempPasswords = {
  admin: process.env.TEMP_ADMIN_PASSWORD,
  lecturer: process.env.TEMP_LECTURER_PASSWORD,
  student: process.env.TEMP_STUDENT_PASSWORD
};

// Temporary JWT login while Keycloak is disabled
router.post('/login', async (req, res) => {
  try {
    if (!authDisabled) {
      return res.status(400).json({ error: 'Temporary login is disabled. Use Keycloak authentication.' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email, is_active: true } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const expectedPassword = tempPasswords[user.role] || tempPasswords.student;
    if (!expectedPassword) {
      return res.status(500).json({ error: 'Temporary login passwords are not configured in the environment' });
    }

    if (password !== expectedPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const roles = [user.role];
    const token = signToken({
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
      roles
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        roles
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync authenticated user into local DB on first login
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
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      roles: req.user.roles || [user.role]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
