const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, authorizeCourseAccess } = require('../middleware/auth');
const { Room, Course, Enrollment, User } = require('../models');
const { Op } = require('sequelize');
const { sendToUser } = require('../services/notifications/sseService');

const guard = [keycloak.protect(), attachUser];
const lecturerPresenceByRoom = new Map();

const requireCourseId = (req, res, next) => {
  const courseId = req.body.courseId || req.body.course_id;
  if (!courseId) {
    return res.status(400).json({ error: 'courseId is required' });
  }
  return next();
};

const resolveRole = (req) => {
  const directRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (directRoles.includes('admin')) return 'admin';
  if (directRoles.includes('lecturer')) return 'lecturer';
  if (directRoles.includes('student')) return 'student';
  return req.user?.role || 'student';
};

const toRoomPayload = (room) => {
  if (!room) return null;
  const course = room.Course;
  const lecturerActive = Boolean(lecturerPresenceByRoom.get(room.room_token));

  return {
    id: room.id,
    roomId: room.room_token,
    room_id: room.room_token,
    courseId: room.course_id,
    course_id: room.course_id,
    createdBy: room.created_by,
    created_by: room.created_by,
    isActive: room.is_active,
    is_active: room.is_active,
    lecturerActive,
    lecturer_active: lecturerActive,
    createdAt: room.created_at,
    created_at: room.created_at,
    title: room.title,
    course: course
      ? {
          id: course.id,
          title: course.title,
          lecturer_id: course.lecturer_id
        }
      : null
  };
};

const createRoomHandler = async (req, res) => {
  try {
    const courseId = req.body.courseId || req.body.course_id;
    const title = String(req.body.title || '').trim();
    const room = await Room.create({
      course_id: courseId,
      title: title || `Live Class ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      room_token: uuidv4(),
      created_by: req.user.id,
      is_active: true
    });

    lecturerPresenceByRoom.set(room.room_token, false);

    const hydrated = await Room.findByPk(room.id, {
      include: [{ model: Course, attributes: ['id', 'title', 'lecturer_id'] }]
    });

    // Notify enrolled students in real-time when a live class starts.
    const enrollments = await Enrollment.findAll({
      where: { course_id: room.course_id },
      include: [{ model: User, as: 'student', attributes: ['id'] }]
    });

    const roomPayload = toRoomPayload(hydrated);
    const message = `Live class started for ${hydrated?.Course?.title || 'your course'}`;
    enrollments.forEach((enrollment) => {
      const studentId = enrollment.student?.id;
      if (!studentId) return;

      sendToUser(studentId, 'live-class-started', {
        type: 'live_class_started',
        courseId: roomPayload.courseId,
        course_id: roomPayload.courseId,
        roomId: roomPayload.roomId,
        room_id: roomPayload.roomId,
        message
      });
    });

    res.status(201).json(roomPayload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getRoomForRole = async (roomToken, user, role) => {
  const room = await Room.findOne({
    where: { room_token: roomToken, is_active: true },
    include: [{ model: Course, attributes: ['id', 'title', 'lecturer_id', 'is_active'] }]
  });

  if (!room || !room.Course || !room.Course.is_active) {
    return { error: { status: 404, message: 'Room not found or inactive' } };
  }

  if (role === 'admin') {
    return { room };
  }

  if (role === 'lecturer') {
    if (String(room.Course.lecturer_id) !== String(user.id)) {
      return { error: { status: 403, message: 'Forbidden: room is not assigned to this lecturer' } };
    }
    return { room };
  }

  const enrollment = await Enrollment.findOne({
    where: { course_id: room.course_id, student_id: user.id }
  });

  if (!enrollment) {
    return { error: { status: 403, message: 'Forbidden: only enrolled students can join this room' } };
  }

  if (!lecturerPresenceByRoom.get(room.room_token)) {
    return { error: { status: 409, message: 'Waiting for lecturer to start class' } };
  }

  return { room };
};

// Create a course-linked live class room (lecturers/admin only)
router.post('/create', ...guard, requireLecturer,
  requireCourseId,
  authorizeCourseAccess(req => req.body.courseId || req.body.course_id, { managerOnly: true }),
  createRoomHandler);

// Backward-compatible alias.
router.post('/', ...guard, requireLecturer,
  requireCourseId,
  authorizeCourseAccess(req => req.body.courseId || req.body.course_id, { managerOnly: true }),
  createRoomHandler);

// Get active rooms visible to the authenticated user.
router.get('/active', ...guard, async (req, res) => {
  try {
    const role = resolveRole(req);
    const where = { is_active: true };

    if (role === 'lecturer') {
      const ownedCourses = await Course.findAll({
        where: { lecturer_id: req.user.id, is_active: true },
        attributes: ['id']
      });
      where.course_id = { [Op.in]: ownedCourses.map((course) => course.id) };
    }

    if (role === 'student') {
      const enrollments = await Enrollment.findAll({
        where: { student_id: req.user.id },
        attributes: ['course_id']
      });
      where.course_id = { [Op.in]: enrollments.map((enrollment) => enrollment.course_id) };
    }

    const rooms = await Room.findAll({
      where,
      include: [{ model: Course, attributes: ['id', 'title', 'lecturer_id'] }],
      order: [['created_at', 'DESC']]
    });

    res.json(rooms.map(toRoomPayload));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active rooms for a course
router.get('/course/:courseId', ...guard, authorizeCourseAccess(req => req.params.courseId), async (req, res) => {
  try {
    const rooms = await Room.findAll({
      where: { course_id: req.params.courseId, is_active: true },
      include: [{ model: Course, attributes: ['id', 'title', 'lecturer_id'] }],
      order: [['created_at', 'DESC']]
    });
    res.json(rooms.map(toRoomPayload));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lecturer heartbeat/presence for moderator-first join policy.
router.post('/:roomId/presence', ...guard, requireLecturer, async (req, res) => {
  try {
    const role = resolveRole(req);
    const result = await getRoomForRole(req.params.roomId, req.user, role);
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    const isActive = req.body?.active !== false;
    lecturerPresenceByRoom.set(req.params.roomId, isActive);

    return res.json({
      roomId: req.params.roomId,
      lecturerActive: isActive,
      lecturer_active: isActive
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Validate room access for join flow.
router.get('/:roomId/access', ...guard, async (req, res) => {
  try {
    const role = resolveRole(req);
    const result = await getRoomForRole(req.params.roomId, req.user, role);
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    return res.json(toRoomPayload(result.room));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Close a room
router.patch('/:id/close', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const room = await Room.findByPk(req.params.id);
    if (!room) {
      const err = new Error('Room not found');
      err.status = 404;
      throw err;
    }
    req.room = room;
    return room.course_id;
  }, { managerOnly: true }), async (req, res) => {
  try {
    const room = req.room;
    await room.update({ is_active: false });
    lecturerPresenceByRoom.set(room.room_token, false);
    const hydrated = await Room.findByPk(room.id, {
      include: [{ model: Course, attributes: ['id', 'title', 'lecturer_id'] }]
    });
    res.json(toRoomPayload(hydrated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
