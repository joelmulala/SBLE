const { EVENT_TYPES } = require('./calendarAggregationConfig');
const { getQuizWindow, getExamWindow } = require('./assessmentWindows');

const isLecturerRole = (role) => role === 'lecturer' || role === 'admin';

function courseHomeHref(role, courseId) {
  const prefix = isLecturerRole(role) ? 'lecturer' : 'student';
  return `/${prefix}/courses/${courseId}`;
}

function workspaceHref(role, courseId, segment) {
  if (!segment) return courseHomeHref(role, courseId);
  const prefix = isLecturerRole(role) ? 'lecturer' : 'student';
  return `/${prefix}/courses/${courseId}/${segment}`;
}

function baseEvent({
  id,
  type,
  title,
  startsAt,
  endsAt = null,
  courseId,
  courseTitle,
  lecturerName,
  resourceId = null,
  href = null,
  meta = {},
  visibility = 'visible'
}) {
  return {
    id,
    type,
    typeLabel: EVENT_TYPES[type]?.label || type,
    title,
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    courseId: Number(courseId),
    courseTitle,
    lecturerName: lecturerName || null,
    resourceId,
    href,
    meta,
    visibility
  };
}

function buildAssignmentEvents(assignments, role) {
  return assignments
    .filter((row) => row.due_date)
    .map((row) => baseEvent({
      id: `assignment-${row.id}`,
      type: 'assignment_due',
      title: row.title,
      startsAt: row.due_date,
      endsAt: row.due_date,
      courseId: row.course_id,
      courseTitle: row.course_title,
      lecturerName: row.lecturer_name,
      resourceId: row.id,
      href: workspaceHref(role, row.course_id, 'assignments'),
      meta: { dueDate: row.due_date }
    }));
}

function buildQuizEvents(quizzes, role) {
  const events = [];
  quizzes.forEach((row) => {
    const quiz = row;
    const { startTime, endTime } = getQuizWindow(quiz);
    if (!startTime && !endTime) return;

    if (startTime) {
      events.push(baseEvent({
        id: `quiz-open-${row.id}`,
        type: 'quiz_open',
        title: row.title,
        startsAt: startTime,
        endsAt: startTime,
        courseId: row.course_id,
        courseTitle: row.course_title,
        lecturerName: row.lecturer_name,
        resourceId: row.id,
        href: workspaceHref(role, row.course_id, 'quizzes'),
        meta: { isPublished: Boolean(row.is_published) },
        visibility: row.is_published || isLecturerRole(role) ? 'visible' : 'hidden'
      }));
    }

    if (endTime) {
      events.push(baseEvent({
        id: `quiz-close-${row.id}`,
        type: 'quiz_close',
        title: row.title,
        startsAt: endTime,
        endsAt: endTime,
        courseId: row.course_id,
        courseTitle: row.course_title,
        lecturerName: row.lecturer_name,
        resourceId: row.id,
        href: workspaceHref(role, row.course_id, 'quizzes'),
        meta: { isPublished: Boolean(row.is_published) },
        visibility: row.is_published || isLecturerRole(role) ? 'visible' : 'hidden'
      }));
    }
  });
  return events.filter((e) => e.visibility === 'visible');
}

function buildExamEvents(exams, role) {
  return exams
    .map((row) => {
      const { startTime, endTime, durationMinutes } = getExamWindow(row);
      if (!startTime) return null;

      const visible = row.is_released || isLecturerRole(role);
      if (!visible) return null;

      return baseEvent({
        id: `exam-${row.id}`,
        type: 'exam',
        title: row.title,
        startsAt: startTime,
        endsAt: endTime,
        courseId: row.course_id,
        courseTitle: row.course_title,
        lecturerName: row.lecturer_name,
        resourceId: row.id,
        href: workspaceHref(role, row.course_id, 'exams'),
        meta: { durationMinutes, isReleased: Boolean(row.is_released) }
      });
    })
    .filter(Boolean);
}

function buildLiveClassEvents(rooms, role) {
  return rooms.map((row) => baseEvent({
    id: `live-${row.id}`,
    type: 'live_class',
    title: row.title || 'Live class',
    startsAt: row.created_at,
    endsAt: null,
    courseId: row.course_id,
    courseTitle: row.course_title,
    lecturerName: row.lecturer_name,
    resourceId: row.id,
    href: `/room/${row.id}`,
    meta: { isActive: Boolean(row.is_active), roomToken: row.room_token }
  }));
}

function buildAnnouncementEvents(announcements, role) {
  return announcements.map((row) => {
    const at = row.publish_at || row.created_at;
    return baseEvent({
      id: `announcement-${row.id}`,
      type: 'announcement',
      title: row.title,
      startsAt: at,
      endsAt: at,
      courseId: row.course_id,
      courseTitle: row.course_title,
      lecturerName: row.author_name,
      resourceId: row.id,
      href: workspaceHref(role, row.course_id, 'communications'),
      meta: { isPinned: Boolean(row.is_pinned), scheduled: Boolean(row.publish_at) }
    });
  });
}

function buildCustomEvents(rows, role) {
  return rows
    .filter((row) => isLecturerRole(role) || row.is_published)
    .map((row) => baseEvent({
      id: `custom-${row.id}`,
      type: row.event_type === 'milestone' ? 'milestone' : 'office_hours',
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at || row.starts_at,
      courseId: row.course_id,
      courseTitle: row.course_title,
      lecturerName: row.lecturer_name,
      resourceId: row.id,
      href: workspaceHref(role, row.course_id, 'communications'),
      meta: { description: row.description, custom: true }
    }));
}

function buildModuleMilestones(modules, role) {
  return modules
    .filter((row) => isLecturerRole(role) || row.is_published)
    .map((row) => baseEvent({
      id: `module-${row.id}`,
      type: 'milestone',
      title: row.title,
      startsAt: row.updated_at || row.created_at,
      endsAt: row.updated_at || row.created_at,
      courseId: row.course_id,
      courseTitle: row.course_title,
      lecturerName: row.lecturer_name,
      resourceId: row.id,
      href: courseHomeHref(role, row.course_id),
      meta: { moduleDescription: row.description }
    }));
}

function eventInRange(event, from, to) {
  const start = event.startsAt ? new Date(event.startsAt).getTime() : null;
  const end = event.endsAt ? new Date(event.endsAt).getTime() : start;
  const fromTs = from ? new Date(from).getTime() : null;
  const toTs = to ? new Date(to).getTime() : null;
  if (!fromTs && !toTs) return true;
  if (start == null && end == null) return true;
  const effectiveStart = start ?? end;
  const effectiveEnd = end ?? start;
  if (fromTs && effectiveEnd < fromTs) return false;
  if (toTs && effectiveStart > toTs) return false;
  return true;
}

function sortEvents(events) {
  return events.sort((a, b) => {
    const aTs = new Date(a.startsAt || 0).getTime();
    const bTs = new Date(b.startsAt || 0).getTime();
    return aTs - bTs;
  });
}

function computeSummary(events, now = new Date()) {
  const nowTs = now.getTime();
  let upcoming = 0;
  let overdue = 0;
  let liveNow = 0;

  events.forEach((event) => {
    const startTs = event.startsAt ? new Date(event.startsAt).getTime() : null;
    const endTs = event.endsAt ? new Date(event.endsAt).getTime() : startTs;

    if (event.type === 'live_class' && event.meta?.isActive) {
      liveNow += 1;
    }

    if (event.type === 'assignment_due' || event.type === 'quiz_close') {
      if (endTs && endTs < nowTs) overdue += 1;
      else if (startTs && startTs >= nowTs) upcoming += 1;
    } else if (startTs && startTs >= nowTs) {
      upcoming += 1;
    }
  });

  return { upcoming, overdue, liveNow };
}

module.exports = {
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
};
