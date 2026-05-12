const keycloak = require('../config/keycloak');
const { AuditLog, Course, Enrollment } = require('../models');

// Protect route — authenticated via Keycloak in production or JWT in dev fallback mode
const protect = keycloak.protect();

const getUserRole = (req) => req.user?.role
  || req.user?.roles?.[0]
  || req.kauth?.grant?.access_token?.content?.realm_access?.roles?.[0]
  || null;

const getUserRoles = (req) => {
  const userRole = getUserRole(req);
  const directRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
  const tokenRoles = req.kauth?.grant?.access_token?.content?.realm_access?.roles || [];
  return [...new Set([...(userRole ? [userRole] : []), ...directRoles, ...tokenRoles])];
};

const hasAnyRole = (req, ...roles) => {
  const userRole = getUserRole(req);
  if (userRole && roles.includes(userRole)) return true;
  return roles.some(role => getUserRoles(req).includes(role));
};

// Role-based guard
const requireRole = (...roles) => (req, res, next) => {
  if (!hasAnyRole(req, ...roles)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  }

  if (req.user && !req.user.role) {
    req.user.role = getUserRole(req);
  }

  next();
};

const requireLecturer = requireRole('lecturer', 'admin');
const requireStudent = requireRole('student');

const authorizeCourseAccess = (resolveCourseId, { managerOnly = false, managerMessage } = {}) => async (req, res, next) => {
  try {
    const courseId = typeof resolveCourseId === 'function'
      ? await resolveCourseId(req)
      : resolveCourseId;

    const course = await Course.findByPk(courseId);
    if (!course || !course.is_active) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const userRole = getUserRole(req);
    const userId = req.user?.id;

    if (userRole === 'admin') {
      req.course = course;
      return next();
    }

    if (userRole === 'lecturer') {
      if (String(course.lecturer_id) !== String(userId)) {
        return res.status(403).json({
          error: managerOnly
            ? (managerMessage || 'Forbidden: only the assigned lecturer or admin can manage this resource')
            : 'Forbidden: course not assigned to this lecturer'
        });
      }

      req.course = course;
      return next();
    }

    if (!managerOnly && userRole === 'student') {
      const enrollment = await Enrollment.findOne({
        where: { course_id: courseId, student_id: userId }
      });

      if (enrollment) {
        req.course = course;
        return next();
      }
    }

    return res.status(403).json({
      error: managerOnly
        ? (managerMessage || 'Forbidden: only the assigned lecturer or admin can manage this resource')
        : 'Forbidden: not enrolled in this course'
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

// Attach user info from authenticated token to req.user
const attachUser = (req, res, next) => {
  if (req.user?.id) return next();

  const token = req.kauth?.grant?.access_token?.content;
  if (token) {
    const roles = token.realm_access?.roles || [];
    req.user = {
      id: token.sub,
      email: token.email,
      name: token.name,
      role: roles[0] || null,
      roles
    };
  }
  next();
};

// Audit logging middleware
const audit = (action, resourceType) => async (req, res, next) => {
  try {
    await AuditLog.create({
      user_id: req.user?.id,
      action,
      resource_type: resourceType,
      resource_id: req.params?.id || null,
      ip_address: req.ip
    });
  } catch (_) { /* non-blocking */ }
  next();
};

module.exports = {
  protect,
  requireRole,
  requireLecturer,
  requireStudent,
  authorizeCourseAccess,
  attachUser,
  audit
};
