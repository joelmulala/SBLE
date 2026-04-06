const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const keycloak = require('../config/keycloak');
const { attachUser, requireRole } = require('../middleware/auth');
const { User } = require('../models');

const guard = [keycloak.protect(), attachUser, requireRole('admin')];
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

const validatePayload = (payload, { isUpdate = false, existingUser = null } = {}) => {
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

  if (payload.role === 'admin' && existingUser?.role !== 'admin') {
    errors.push('Admin accounts are managed separately and cannot be created here');
  }

  if (existingUser?.role === 'admin' && payload.role !== 'admin') {
    errors.push('The primary admin role cannot be changed here');
  }

  if (!isUpdate && payload.role === 'student') {
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

  return [...new Set(errors)];
};

const buildPayload = (body, existingUser = null) => {
  const requestedRole = normalizeText(body?.role);
  const role = existingUser?.role === 'admin' ? 'admin' : (requestedRole || existingUser?.role || 'student');

  return {
    full_name: normalizeText(body?.full_name),
    email: normalizeEmail(body?.email),
    role,
    student_id: role === 'student' ? normalizeText(body?.student_id) : null,
    program: role === 'student' ? normalizeText(body?.program) : null,
    year_of_study: role === 'student' ? normalizeInteger(body?.year_of_study) : null,
    semester: role === 'student' ? normalizeInteger(body?.semester) : null,
    mode: role === 'student' ? normalizeText(body?.mode) : null,
    institution: role === 'lecturer' ? normalizeText(body?.institution) : null,
    staff_email: role === 'lecturer' ? normalizeEmail(body?.staff_email) : null,
    is_active: body?.is_active === undefined ? true : Boolean(body.is_active)
  };
};

const getDefaultPasswordForRole = (role) => {
  if (role === 'lecturer') return process.env.TEMP_LECTURER_PASSWORD || null;
  if (role === 'student') return process.env.TEMP_STUDENT_PASSWORD || null;
  if (role === 'admin') return process.env.TEMP_ADMIN_PASSWORD || null;
  return null;
};

router.get('/', ...guard, async (req, res) => {
  try {
    const users = await User.findAll({
      order: [['role', 'ASC'], ['full_name', 'ASC'], ['email', 'ASC']]
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', ...guard, async (req, res) => {
  try {
    const payload = buildPayload(req.body);
    const errors = validatePayload(payload);

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
      ...payload
    });

    res.status(201).json({
      user,
      default_password: payload.role === 'lecturer' ? getDefaultPasswordForRole('lecturer') : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', ...guard, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const payload = buildPayload(req.body, user);
    const errors = validatePayload(payload, { isUpdate: true, existingUser: user });
    if (errors.length) {
      return res.status(400).json({ error: errors[0], details: errors });
    }

    const existingEmail = await User.findOne({ where: { email: payload.email } });
    if (existingEmail && String(existingEmail.id) !== String(user.id)) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    if (payload.student_id) {
      const existingStudent = await User.findOne({ where: { student_id: payload.student_id } });
      if (existingStudent && String(existingStudent.id) !== String(user.id)) {
        return res.status(409).json({ error: 'student_id already exists' });
      }
    }

    if (payload.staff_email) {
      const existingStaff = await User.findOne({ where: { staff_email: payload.staff_email } });
      if (existingStaff && String(existingStaff.id) !== String(user.id)) {
        return res.status(409).json({ error: 'staff_email already exists' });
      }
    }

    await user.update(payload);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', ...guard, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (String(user.id) === String(req.user?.id)) {
      return res.status(400).json({ error: 'You cannot delete your own admin account' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be deleted here' });
    }

    await user.destroy();
    res.json({ deleted: true, user_id: user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/reset-password', ...guard, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'lecturer') {
      return res.status(400).json({ error: 'Default password reset is available for lecturer accounts only' });
    }

    const defaultPassword = getDefaultPasswordForRole('lecturer');
    if (!defaultPassword) {
      return res.status(500).json({ error: 'TEMP_LECTURER_PASSWORD is not configured' });
    }

    res.json({
      user_id: user.id,
      email: user.email,
      role: user.role,
      default_password: defaultPassword,
      message: 'Lecturer default password is ready to share securely'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
