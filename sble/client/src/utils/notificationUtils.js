const CATEGORY_ORDER = ['live', 'academic', 'communication', 'other'];

export const NOTIFICATION_CATEGORY_LABELS = {
  live: 'Live classes',
  academic: 'Grades & assessments',
  communication: 'Announcements',
  other: 'Updates'
};

export function getNotificationCategory(type = '') {
  const t = String(type).toLowerCase();
  if (t.includes('live_class') || t === 'live') return 'live';
  if (['grade', 'exam', 'assignment', 'quiz'].includes(t)) return 'academic';
  if (['announcement', 'discussion_reply', 'discussion'].includes(t)) return 'communication';
  return 'other';
}

export function getNotificationTitle(notification) {
  if (notification.title) return notification.title;
  const t = String(notification.type || '').toLowerCase();
  if (t === 'grade') return 'Grade published';
  if (t === 'exam') return 'Exam released';
  if (t.includes('live_class_started')) return 'Live class started';
  if (t.includes('live_class_ended')) return 'Live class ended';
  if (t === 'announcement') return 'New announcement';
  if (t === 'discussion_reply') return 'Discussion reply';
  return 'Academic update';
}

export function getNotificationMessage(notification) {
  return notification.message || notification.body || getNotificationTitle(notification);
}

export function resolveNotificationPath(notification, { isLecturer } = {}) {
  if (!notification) return null;
  const prefix = isLecturer ? '/lecturer' : '/student';
  const cid = notification.courseId || notification.course_id;
  const type = String(notification.type || '').toLowerCase();
  const roomId = notification.roomId || notification.room_id;

  if (type.includes('live_class_started') && roomId) {
    return `/room/${encodeURIComponent(roomId)}`;
  }
  if (roomId && (type.includes('live') || type.includes('ready'))) {
    return `/room/${encodeURIComponent(roomId)}`;
  }
  if (type === 'announcement' || type === 'discussion_reply') {
    if (cid) return `${prefix}/courses/${cid}/communications`;
    return null;
  }
  if (type === 'grade') {
    if (cid) return `${prefix}/courses/${cid}/gradebook`;
    return `${prefix}/gradebook`;
  }
  if (type === 'exam') {
    if (cid) return `${prefix}/courses/${cid}/exams`;
    return `${prefix}/courses`;
  }
  if (cid) return `${prefix}/courses/${cid}`;
  return null;
}

export function groupNotificationsByCategory(notifications) {
  const groups = new Map();
  notifications.forEach((n) => {
    const cat = getNotificationCategory(n.type);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(n);
  });
  return CATEGORY_ORDER
    .filter((cat) => groups.has(cat))
    .map((cat) => ({
      id: cat,
      label: NOTIFICATION_CATEGORY_LABELS[cat],
      items: groups.get(cat)
    }));
}
