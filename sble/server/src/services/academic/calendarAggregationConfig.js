const EVENT_TYPES = {
  assignment_due: { label: 'Assignment due', category: 'deadline', priority: 2 },
  quiz_open: { label: 'Quiz opens', category: 'assessment', priority: 3 },
  quiz_close: { label: 'Quiz closes', category: 'deadline', priority: 2 },
  exam: { label: 'Exam', category: 'assessment', priority: 1 },
  live_class: { label: 'Live class', category: 'live', priority: 1 },
  announcement: { label: 'Announcement', category: 'communication', priority: 4 },
  office_hours: { label: 'Office hours', category: 'milestone', priority: 5 },
  milestone: { label: 'Course milestone', category: 'milestone', priority: 5 }
};

const DEADLINE_TYPES = new Set(['assignment_due', 'quiz_close']);

function isDeadlineType(type) {
  return DEADLINE_TYPES.has(type);
}

module.exports = {
  EVENT_TYPES,
  isDeadlineType
};
