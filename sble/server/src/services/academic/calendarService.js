const { sequelize } = require('../../models');
const {
  buildAssignmentEvents,
  buildQuizEvents,
  buildExamEvents,
  buildLiveClassEvents,
  buildAnnouncementEvents,
  buildCustomEvents,
  buildModuleMilestones,
  eventInRange,
  sortEvents,
  computeSummary,
  isLecturerRole
} = require('./calendarEventBuilders');

async function resolveAccessibleCourseIds(userId, role, courseId) {
  if (courseId) {
    const id = Number.parseInt(courseId, 10);
    if (!Number.isInteger(id) || id <= 0) return [];
    const all = await resolveAccessibleCourseIds(userId, role);
    return all.includes(id) ? [id] : [];
  }

  if (role === 'admin') {
    const [rows] = await sequelize.query('SELECT id FROM courses WHERE is_active = true');
    return rows.map((r) => Number(r.id));
  }

  if (role === 'lecturer') {
    const [rows] = await sequelize.query(
      'SELECT id FROM courses WHERE lecturer_id = :userId AND is_active = true',
      { replacements: { userId } }
    );
    return rows.map((r) => Number(r.id));
  }

  const [rows] = await sequelize.query(
    'SELECT course_id AS id FROM enrollments WHERE student_id = :userId',
    { replacements: { userId } }
  );
  return rows.map((r) => Number(r.id));
}

function defaultRange() {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();
  to.setDate(to.getDate() + 120);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchCalendarData(courseIds, role) {
  if (!courseIds.length) {
    return {
      courses: [],
      assignments: [],
      quizzes: [],
      exams: [],
      rooms: [],
      announcements: [],
      customEvents: [],
      modules: []
    };
  }

  const replacements = { courseIds };
  const lecturerRole = isLecturerRole(role);

  const [courses] = await sequelize.query(`
    SELECT c.id, c.title, u.full_name AS lecturer_name
    FROM courses c
    JOIN users u ON u.id = c.lecturer_id
    WHERE c.id IN (:courseIds)
    ORDER BY c.title ASC
  `, { replacements });

  const [assignments] = await sequelize.query(`
    SELECT a.id, a.title, a.due_date, a.course_id, c.title AS course_title, u.full_name AS lecturer_name
    FROM assignments a
    JOIN courses c ON c.id = a.course_id
    JOIN users u ON u.id = c.lecturer_id
    WHERE a.course_id IN (:courseIds)
    ORDER BY a.due_date ASC NULLS LAST
  `, { replacements });

  const quizPublishedFilter = lecturerRole ? '' : 'AND q.is_published = true';
  const [quizzes] = await sequelize.query(`
    SELECT q.*, c.title AS course_title, u.full_name AS lecturer_name
    FROM quizzes q
    JOIN courses c ON c.id = q.course_id
    JOIN users u ON u.id = c.lecturer_id
    WHERE q.course_id IN (:courseIds) ${quizPublishedFilter}
    ORDER BY q.created_at ASC
  `, { replacements });

  const examReleasedFilter = lecturerRole ? '' : 'AND e.is_released = true';
  const [exams] = await sequelize.query(`
    SELECT e.*, c.title AS course_title, u.full_name AS lecturer_name
    FROM exams e
    JOIN courses c ON c.id = e.course_id
    JOIN users u ON u.id = c.lecturer_id
    WHERE e.course_id IN (:courseIds) ${examReleasedFilter}
    ORDER BY e.scheduled_at ASC NULLS LAST
  `, { replacements });

  const [rooms] = await sequelize.query(`
    SELECT r.id, r.title, r.created_at, r.is_active, r.room_token, r.course_id,
           c.title AS course_title, u.full_name AS lecturer_name
    FROM rooms r
    JOIN courses c ON c.id = r.course_id
    JOIN users u ON u.id = c.lecturer_id
    WHERE r.course_id IN (:courseIds)
    ORDER BY r.created_at DESC
    LIMIT 150
  `, { replacements });

  const announcementWhere = lecturerRole
    ? ''
    : `AND a.is_hidden = false AND (a.publish_at IS NULL OR a.publish_at <= NOW())`;

  const [announcements] = await sequelize.query(`
    SELECT a.id, a.title, a.publish_at, a.created_at, a.is_pinned, a.course_id,
           c.title AS course_title, u.full_name AS author_name
    FROM announcements a
    JOIN courses c ON c.id = a.course_id
    JOIN users u ON u.id = a.author_id
    WHERE a.course_id IN (:courseIds) ${announcementWhere}
    ORDER BY COALESCE(a.publish_at, a.created_at) DESC
    LIMIT 200
  `, { replacements });

  const customPublishedFilter = lecturerRole ? '' : 'AND ce.is_published = true';
  const [customEvents] = await sequelize.query(`
    SELECT ce.*, c.title AS course_title, u.full_name AS lecturer_name
    FROM calendar_custom_events ce
    JOIN courses c ON c.id = ce.course_id
    JOIN users u ON u.id = ce.author_id
    WHERE ce.course_id IN (:courseIds) ${customPublishedFilter}
    ORDER BY ce.starts_at ASC
  `, { replacements }).catch(() => [[]]);

  const modulePublishedFilter = lecturerRole ? '' : 'AND m.is_published = true';
  const [modules] = await sequelize.query(`
    SELECT m.id, m.title, m.description, m.course_id, m.is_published, m.created_at, m.updated_at,
           c.title AS course_title, u.full_name AS lecturer_name
    FROM course_modules m
    JOIN courses c ON c.id = m.course_id
    JOIN users u ON u.id = c.lecturer_id
    WHERE m.course_id IN (:courseIds) ${modulePublishedFilter}
    ORDER BY m.sort_order ASC
  `, { replacements }).catch(() => [[]]);

  return {
    courses,
    assignments,
    quizzes,
    exams,
    rooms,
    announcements,
    customEvents,
    modules
  };
}

async function getCalendarEvents(userId, role, { from, to, courseId } = {}) {
  const range = defaultRange();
  const rangeFrom = from || range.from;
  const rangeTo = to || range.to;

  const courseIds = await resolveAccessibleCourseIds(userId, role, courseId);
  const data = await fetchCalendarData(courseIds, role);

  const liveRooms = data.rooms.filter((r) => r.is_active);

  let events = [
    ...buildAssignmentEvents(data.assignments, role),
    ...buildQuizEvents(data.quizzes, role),
    ...buildExamEvents(data.exams, role),
    ...buildLiveClassEvents(liveRooms, role),
    ...buildAnnouncementEvents(data.announcements, role),
    ...buildCustomEvents(data.customEvents, role),
    ...buildModuleMilestones(data.modules, role)
  ];

  events = events.filter((event) => eventInRange(event, rangeFrom, rangeTo));
  events = sortEvents(events);

  const summary = computeSummary(events);

  return {
    events,
    courses: data.courses.map((c) => ({ id: Number(c.id), title: c.title, lecturerName: c.lecturer_name })),
    range: { from: rangeFrom, to: rangeTo },
    summary
  };
}

async function getUpcomingEvents(userId, role, { limit = 8, courseId } = {}) {
  const payload = await getCalendarEvents(userId, role, { courseId });
  const now = Date.now();

  const upcoming = payload.events.filter((event) => {
    const ts = new Date(event.startsAt || event.endsAt || 0).getTime();
    return ts >= now || (event.type === 'live_class' && event.meta?.isActive);
  });

  const overdue = payload.events.filter((event) => {
    if (event.type !== 'assignment_due' && event.type !== 'quiz_close') return false;
    const endTs = new Date(event.endsAt || event.startsAt).getTime();
    return endTs < now;
  });

  return {
    upcoming: upcoming.slice(0, limit),
    overdue: overdue.slice(0, limit),
    summary: payload.summary,
    courses: payload.courses
  };
}

async function createCustomEvent(courseId, authorId, payload) {
  const title = String(payload.title || '').trim();
  if (!title) {
    const err = new Error('Title is required');
    err.status = 400;
    throw err;
  }

  const startsAt = new Date(payload.starts_at || payload.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    const err = new Error('starts_at is required');
    err.status = 400;
    throw err;
  }

  let endsAt = null;
  if (payload.ends_at || payload.endsAt) {
    endsAt = new Date(payload.ends_at || payload.endsAt);
    if (Number.isNaN(endsAt.getTime())) {
      const err = new Error('ends_at must be a valid date');
      err.status = 400;
      throw err;
    }
  }

  const eventType = String(payload.event_type || payload.eventType || 'office_hours').toLowerCase();
  const allowed = ['office_hours', 'milestone'];
  if (!allowed.includes(eventType)) {
    const err = new Error(`event_type must be one of: ${allowed.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const [result] = await sequelize.query(`
    INSERT INTO calendar_custom_events
      (course_id, author_id, event_type, title, description, starts_at, ends_at, is_published)
    VALUES
      (:courseId, :authorId, :eventType, :title, :description, :startsAt, :endsAt, :isPublished)
    RETURNING *
  `, {
    replacements: {
      courseId,
      authorId,
      eventType,
      title: title.slice(0, 255),
      description: payload.description ? String(payload.description).slice(0, 4000) : null,
      startsAt,
      endsAt,
      isPublished: payload.is_published !== false && payload.is_published !== 'false'
    }
  });

  return result[0];
}

async function deleteCustomEvent(eventId, courseId) {
  const [rows] = await sequelize.query(`
    DELETE FROM calendar_custom_events
    WHERE id = :eventId AND course_id = :courseId
    RETURNING id
  `, { replacements: { eventId, courseId } });

  if (!rows.length) {
    const err = new Error('Calendar event not found');
    err.status = 404;
    throw err;
  }
}

module.exports = {
  getCalendarEvents,
  getUpcomingEvents,
  createCustomEvent,
  deleteCustomEvent,
  resolveAccessibleCourseIds
};
