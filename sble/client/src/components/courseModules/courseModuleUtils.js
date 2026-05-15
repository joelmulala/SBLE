const TYPE_LABELS = {
  material: 'Material',
  assignment: 'Assignment',
  quiz: 'Quiz',
  exam: 'Exam',
  link: 'Link',
  communications: 'Announcements',
  live: 'Live class'
};

const WORKSPACE_PATH = {
  material: 'materials',
  assignment: 'assignments',
  quiz: 'quizzes',
  exam: 'exams'
};

export function itemTypeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export function resolveItemHref({ type, id, courseId, rolePrefix, meta }) {
  if (!courseId) return null;

  if (type === 'communications') {
    return `/${rolePrefix}/courses/${courseId}/communications`;
  }

  if (type === 'live') {
    if (meta?.linkUrl) return meta.linkUrl;
    if (meta?.roomId) return `/room/${meta.roomId}`;
    return `/${rolePrefix}/courses/${courseId}`;
  }

  if (type === 'link' && meta?.linkUrl) {
    return meta.linkUrl;
  }

  const segment = WORKSPACE_PATH[type];
  if (segment) {
    return `/${rolePrefix}/courses/${courseId}/${segment}`;
  }

  return null;
}

export function countModuleItems(module) {
  return Array.isArray(module?.items) ? module.items.length : 0;
}

export function countUnassigned(unassigned = {}) {
  return Object.values(unassigned).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}
