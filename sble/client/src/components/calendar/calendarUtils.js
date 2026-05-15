export const TYPE_LABELS = {
  assignment_due: 'Assignment due',
  quiz_open: 'Quiz opens',
  quiz_close: 'Quiz closes',
  exam: 'Exam',
  live_class: 'Live class',
  announcement: 'Announcement',
  office_hours: 'Office hours',
  milestone: 'Module milestone'
};

export const TYPE_CSS = {
  assignment_due: 'typeAssignment',
  quiz_open: 'typeQuiz',
  quiz_close: 'typeQuizClose',
  exam: 'typeExam',
  live_class: 'typeLive',
  announcement: 'typeAnnouncement',
  office_hours: 'typeOffice',
  milestone: 'typeMilestone'
};

export function badgeVariant(type) {
  if (type === 'assignment_due' || type === 'quiz_close') return 'warning';
  if (type === 'exam') return 'danger';
  if (type === 'live_class') return 'info';
  if (type === 'quiz_open') return 'success';
  return 'neutral';
}

export function getEventStatus(event, now = new Date()) {
  const nowTs = now.getTime();
  const startTs = event.startsAt ? new Date(event.startsAt).getTime() : null;
  const endTs = event.endsAt ? new Date(event.endsAt).getTime() : startTs;

  if (event.type === 'live_class' && event.meta?.isActive) {
    return 'live';
  }

  if ((event.type === 'assignment_due' || event.type === 'quiz_close') && endTs && endTs < nowTs) {
    return 'overdue';
  }

  if (startTs && startTs > nowTs) {
    return 'upcoming';
  }

  if (endTs && endTs >= nowTs && startTs && startTs <= nowTs) {
    return 'active';
  }

  return 'past';
}

export function formatEventTime(event) {
  if (!event.startsAt) return '—';
  const start = new Date(event.startsAt);
  const end = event.endsAt && event.endsAt !== event.startsAt ? new Date(event.endsAt) : null;
  const time = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (!end) return time;
  const endTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${time} – ${endTime}`;
}

export function formatEventDate(value) {
  if (!value) return 'Unscheduled';
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export const calendarBasePath = (isLecturer) => (isLecturer ? '/lecturer/calendar' : '/student/calendar');
