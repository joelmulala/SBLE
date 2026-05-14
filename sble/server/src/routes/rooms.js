const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, authorizeCourseAccess } = require('../middleware/auth');
const { Room, Course, Enrollment, User } = require('../models');
const { Op } = require('sequelize');
const { sendToUser } = require('../services/notifications/sseService');
const { isLiveKitConfigured } = require('../config/livekit');
const { issueLiveKitParticipantToken } = require('../services/classroom/livekitTokenService');
const attendanceService = require('../services/classroom/liveClassAttendanceService');
const livekitModerationService = require('../services/classroom/livekitModerationService');
const logger = require('../config/logger');

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

const courseInclude = {
  model: Course,
  attributes: ['id', 'title', 'lecturer_id', 'is_active'],
  include: [{ model: User, as: 'lecturer', attributes: ['id', 'full_name', 'email'] }]
};

const normalizeLecturerName = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.replace(/\s*[-–—]\s*$/, '').trim() || null;
};

const toRoomPayload = (room) => {
  if (!room) return null;
  const course = room.Course;
  const lecturerActive = Boolean(lecturerPresenceByRoom.get(room.room_token));
  const lecturerName = normalizeLecturerName(course?.lecturer?.full_name);

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
          lecturer_id: course.lecturer_id,
          lecturerName,
          lecturer_name: lecturerName
        }
      : null
  };
};

const closeRoomRecord = async (room, { notifyStudents = false } = {}) => {
  if (!room) return null;

  if (!room.is_active) {
    lecturerPresenceByRoom.set(room.room_token, false);
    return room;
  }

  await room.update({ is_active: false });
  lecturerPresenceByRoom.set(room.room_token, false);

  try {
    await attendanceService.finalizeSessionForRoom(room);
  } catch (err) {
    logger.warn('Live class attendance finalize failed', { roomId: room.id, err: err.message });
  }

  if (!notifyStudents) {
    return room;
  }

  const enrollments = await Enrollment.findAll({
    where: { course_id: room.course_id },
    include: [{ model: User, as: 'student', attributes: ['id'] }]
  });
  const courseTitle = room.Course?.title || 'your course';
  enrollments.forEach((enrollment) => {
    const studentId = enrollment.student?.id;
    if (!studentId) return;
    sendToUser(studentId, 'live-class-ended', {
      type: 'live_class_ended',
      courseId: room.course_id,
      course_id: room.course_id,
      roomId: room.room_token,
      room_id: room.room_token,
      message: `Live class ended for ${courseTitle}`
    });
  });

  return room;
};

const createRoomHandler = async (req, res) => {
  try {
    const courseId = req.body.courseId || req.body.course_id;
    const title = String(req.body.title || '').trim();
    // Enforce only one active meeting per lecturer
    const activeRoom = await Room.findOne({
      where: {
        created_by: req.user.id,
        is_active: true
      }
    });
    if (activeRoom) {
      // Auto-close stale rooms where lecturer is no longer present.
      if (lecturerPresenceByRoom.get(activeRoom.room_token)) {
        return res.status(409).json({ error: 'You already have an active meeting. Please close it before starting a new one.' });
      }
      await closeRoomRecord(activeRoom, { notifyStudents: false });
    }

    const room = await Room.create({
      course_id: courseId,
      title: title || `Live Class ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      room_token: uuidv4(),
      created_by: req.user.id,
      is_active: true
    });

    lecturerPresenceByRoom.set(room.room_token, false);

    const hydrated = await Room.findByPk(room.id, {
      include: [courseInclude]
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

const getRoomForRole = async (roomToken, user, role, opts = {}) => {
  const room = await Room.findOne({
    where: { room_token: roomToken },
    include: [courseInclude]
  });

  if (!room || !room.Course) {
    return { error: { status: 404, message: 'Room not found' } };
  }

  if (!room.Course.is_active) {
    return { error: { status: 403, message: 'Class has ended' } };
  }

  if (!room.is_active) {
    return { error: { status: 403, message: 'Class has ended' } };
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

  if (!lecturerPresenceByRoom.get(room.room_token) && !opts.allowStudentLobby) {
    return { error: { status: 409, message: 'Waiting for lecturer to start class' } };
  }

  return { room };
};

/** Room read for post-close session summary (lecturer course ownership). */
const getRoomForAttendanceRead = async (roomToken, user, role) => {
  const room = await Room.findOne({
    where: { room_token: String(roomToken || '').trim() },
    include: [courseInclude]
  });
  if (!room || !room.Course) {
    return { error: { status: 404, message: 'Room not found' } };
  }
  if (role === 'admin') {
    return { room };
  }
  if (role === 'lecturer' && String(room.Course.lecturer_id) === String(user.id)) {
    return { room };
  }
  return { error: { status: 403, message: 'Forbidden' } };
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
      include: [courseInclude],
      order: [['created_at', 'DESC']]
    });
    if (role === 'student') {
      // Student view: only one active room per lecturer (latest first).
      const latestByLecturer = new Map();
      rooms.forEach((room) => {
        const lecturerId = room.Course?.lecturer_id;
        if (!lecturerId) return;
        if (!latestByLecturer.has(String(lecturerId))) {
          latestByLecturer.set(String(lecturerId), room);
        }
      });
      return res.json(Array.from(latestByLecturer.values()).map(toRoomPayload));
    }

    return res.json(rooms.map(toRoomPayload));
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

// LiveKit token — registered before `/:roomId/*` routes so path `.../livekit-token` is never shadowed.
router.post('/:roomToken/livekit-token', ...guard, async (req, res) => {
  try {
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ error: 'LiveKit is not configured on this server' });
    }

    const roomToken = String(req.params.roomToken || '').trim();
    const role = resolveRole(req);
    const result = await getRoomForRole(roomToken, req.user, role, { allowStudentLobby: false });
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    const classroomRole = role === 'admin' ? 'admin' : (role === 'lecturer' ? 'lecturer' : 'student');
    const payload = await issueLiveKitParticipantToken({
      room: result.room,
      user: req.user,
      classroomRole
    });
    return res.json(payload);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
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

    const isActive = Object.prototype.hasOwnProperty.call(req.body || {}, 'active')
      ? Boolean(req.body.active)
      : true;
    lecturerPresenceByRoom.set(req.params.roomId, isActive);

    if (isActive && result.room) {
      const room = result.room;
      try {
        const enrollments = await Enrollment.findAll({
          where: { course_id: room.course_id },
          include: [{ model: User, as: 'student', attributes: ['id'] }]
        });
        enrollments.forEach((enrollment) => {
          const studentId = enrollment.student?.id;
          if (!studentId) return;
          sendToUser(studentId, 'live-class-ready', {
            type: 'live_class_ready',
            roomId: req.params.roomId,
            room_id: req.params.roomId,
            courseId: room.course_id,
            course_id: room.course_id
          });
        });
      } catch (_) {
        /* non-fatal */
      }
    }

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
    const result = await getRoomForRole(req.params.roomId, req.user, role, { allowStudentLobby: true });
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    return res.json(toRoomPayload(result.room));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:roomId/session/ping', ...guard, async (req, res) => {
  try {
    const role = resolveRole(req);
    const result = await getRoomForRole(req.params.roomId, req.user, role, { allowStudentLobby: false });
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    const metrics = req.body?.metrics && typeof req.body.metrics === 'object' ? req.body.metrics : {};
    const out = await attendanceService.recordPing({
      room: result.room,
      user: req.user,
      role,
      metrics
    });
    return res.json({ ok: true, ...out });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:roomId/session/leave', ...guard, async (req, res) => {
  try {
    const role = resolveRole(req);
    const result = await getRoomForRole(req.params.roomId, req.user, role, { allowStudentLobby: true });
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    await attendanceService.recordLeave({ room: result.room, user: req.user });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:roomId/session/summary', ...guard, requireLecturer, async (req, res) => {
  try {
    const role = resolveRole(req);
    const result = await getRoomForAttendanceRead(req.params.roomId, req.user, role);
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    const summary = await attendanceService.getOpenSessionSummaryForLecturer(result.room);
    if (!summary) {
      return res.status(404).json({ error: 'No attendance session found for this class' });
    }
    return res.json(summary);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:roomId/session/live', ...guard, requireLecturer, async (req, res) => {
  try {
    const role = resolveRole(req);
    const result = await getRoomForRole(req.params.roomId, req.user, role, { allowStudentLobby: true });
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    const metrics = await attendanceService.getLiveMetrics(result.room);
    return res.json(metrics);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:roomId/livekit-moderate', ...guard, requireLecturer, async (req, res) => {
  try {
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ error: 'LiveKit is not configured on this server' });
    }
    const role = resolveRole(req);
    const result = await getRoomForRole(req.params.roomId, req.user, role, { allowStudentLobby: false });
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    const action = String(req.body?.action || '').trim();
    const participantIdentity = req.body?.participantIdentity != null
      ? String(req.body.participantIdentity).trim()
      : '';

    const allowed = ['mute_microphone', 'camera_off', 'stop_screen_share', 'remove_participant', 'reclaim_presentations'];
    if (!allowed.includes(action)) {
      return res.status(400).json({ error: 'Invalid moderation action' });
    }

    if (action !== 'reclaim_presentations' && !participantIdentity) {
      return res.status(400).json({ error: 'participantIdentity is required' });
    }

    if (action === 'remove_participant' && participantIdentity === req.user.id) {
      return res.status(400).json({ error: 'Use Leave class to exit the session' });
    }

    const roomName = String(req.params.roomId || '').trim();
    const out = await livekitModerationService.moderateParticipant({
      roomName,
      targetIdentity: participantIdentity,
      action,
      lecturerIdentity: req.user.id
    });
    return res.json(out);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

const closeRoomByToken = async (roomToken) => {
  const token = String(roomToken || '').trim();
  const room = await Room.findOne({
    where: { room_token: token },
    include: [courseInclude]
  });
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }
  return closeRoomRecord(room, { notifyStudents: true });
};

// Close a room (room_token is the live room id used in URLs and Jitsi)
router.patch('/:roomToken/close', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const room = await Room.findOne({ where: { room_token: String(req.params.roomToken || '').trim() } });
    if (!room) {
      const err = new Error('Room not found');
      err.status = 404;
      throw err;
    }
    req.room = room;
    return room.course_id;
  }, { managerOnly: true }), async (req, res) => {
  try {
    const room = await closeRoomByToken(req.params.roomToken);
    const hydrated = await Room.findByPk(room.id, {
      include: [courseInclude]
    });
    res.json(toRoomPayload(hydrated));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

logger.info('[SBLE DEBUG] rooms router module loaded', { file: require('path').resolve(__filename) });

module.exports = router;
