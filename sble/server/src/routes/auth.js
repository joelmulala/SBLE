const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
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

const VALID_ROLES = ['student', 'lecturer', 'admin'];
const VALID_MODES = ['Full-time', 'Evening', 'ODL'];

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const normalizeEmail = (value) => normalizeText(value)?.toLowerCase() || null;

const normalizeInteger = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
};

const validateRegistrationPayload = (payload) => {
  const errors = [];

  if (!payload.full_name || payload.full_name.length < 3) {
    errors.push('full_name must be at least 3 characters long');
  }

  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.push('A valid email is required');
  }

  if (!VALID_ROLES.includes(payload.role)) {
    errors.push('role must be student, lecturer, or admin');
  }

  if (payload.role === 'admin') {
    errors.push('Admin accounts cannot be self-registered');
  }

  if (payload.role === 'student') {
    if (!payload.student_id) errors.push('student_id is required for students');
    if (!payload.program) errors.push('program is required for students');
    if (!Number.isInteger(payload.year_of_study) || payload.year_of_study < 1) {
      errors.push('year_of_study must be a positive integer');
    }
    if (!Number.isInteger(payload.semester) || payload.semester < 1) {
      errors.push('semester must be a positive integer');
    }
    if (!VALID_MODES.includes(payload.mode)) {
      errors.push('mode must be Full-time, Evening, or ODL');
    }
  }

  if (payload.role === 'lecturer') {
    if (!payload.institution) errors.push('institution is required for lecturers');
    if (!payload.staff_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.staff_email)) {
      errors.push('A valid staff_email is required for lecturers');
    }
  }

  return errors;
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

// Temporary registration while Keycloak is disabled
router.post('/register', async (req, res) => {
  try {
    if (!authDisabled) {
      return res.status(400).json({ error: 'Temporary registration is disabled. Use Keycloak provisioning.' });
    }

    const payload = {
      full_name: normalizeText(req.body?.full_name),
      email: normalizeEmail(req.body?.email),
      role: normalizeText(req.body?.role) || 'student',
      student_id: normalizeText(req.body?.student_id),
      program: normalizeText(req.body?.program),
      year_of_study: normalizeInteger(req.body?.year_of_study),
      semester: normalizeInteger(req.body?.semester),
      mode: normalizeText(req.body?.mode),
      institution: normalizeText(req.body?.institution),
      staff_email: normalizeEmail(req.body?.staff_email)
    };

    const errors = validateRegistrationPayload(payload);
    if (errors.length) {
      return res.status(400).json({ error: errors[0], details: errors });
    }

    const existingEmail = await User.findOne({ where: { email: payload.email } });
    if (existingEmail) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    if (payload.student_id) {
      const existingStudent = await User.findOne({ where: { student_id: payload.student_id } });
      if (existingStudent) {
        return res.status(409).json({ error: 'student_id already exists' });
      }
    }

    if (payload.staff_email) {
      const existingStaff = await User.findOne({ where: { staff_email: payload.staff_email } });
      if (existingStaff) {
        return res.status(409).json({ error: 'staff_email already exists' });
      }
    }

    const user = await User.create({
      id: uuidv4(),
      full_name: payload.full_name,
      email: payload.email,
      role: payload.role,
      student_id: payload.role === 'student' ? payload.student_id : null,
      program: payload.role === 'student' ? payload.program : null,
      year_of_study: payload.role === 'student' ? payload.year_of_study : null,
      semester: payload.role === 'student' ? payload.semester : null,
      mode: payload.role === 'student' ? payload.mode : null,
      institution: payload.role === 'lecturer' ? payload.institution : null,
      staff_email: payload.role === 'lecturer' ? payload.staff_email : null,
      is_active: true
    });

    res.status(201).json({ user });
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
      defaults: {
        email,
        full_name: name,
        role,
        student_id: normalizeText(req.body?.student_id),
        program: normalizeText(req.body?.program),
        year_of_study: normalizeInteger(req.body?.year_of_study),
        semester: normalizeInteger(req.body?.semester),
        mode: normalizeText(req.body?.mode),
        institution: normalizeText(req.body?.institution),
        staff_email: normalizeEmail(req.body?.staff_email)
      }
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
