export const COURSE_LEARNING_NAV = [
  { id: 'home', label: 'Learning path', segment: '' },
  { id: 'materials', label: 'Materials', segment: 'materials' },
  { id: 'assignments', label: 'Assignments', segment: 'assignments' },
  { id: 'quizzes', label: 'Quizzes', segment: 'quizzes' },
  { id: 'exams', label: 'Exams', segment: 'exams' },
  { id: 'communications', label: 'Communication', segment: 'communications' },
  { id: 'gradebook', label: 'Gradebook', segment: 'gradebook' }
];

export const COURSE_LECTURER_EXTRA = [
  { id: 'enrollment', label: 'Enrollment', segment: 'enrollment' },
  { id: 'performance', label: 'Performance', segment: 'performance' }
];

export function getCourseNavItems(isLecturer) {
  if (isLecturer) {
    return [
      ...COURSE_LEARNING_NAV.slice(0, 1),
      ...COURSE_LECTURER_EXTRA.slice(0, 1),
      ...COURSE_LEARNING_NAV.slice(1),
      COURSE_LECTURER_EXTRA[1]
    ];
  }
  return COURSE_LEARNING_NAV;
}

export function coursePath(rolePrefix, courseId, segment) {
  const base = `/${rolePrefix}/courses/${courseId}`;
  return segment ? `${base}/${segment}` : base;
}

export function detectActiveSegment(pathname, courseId) {
  if (!courseId) return 'home';
  const base = `/courses/${courseId}`;
  const idx = pathname.indexOf(base);
  if (idx === -1) return 'home';
  const rest = pathname.slice(idx + base.length).replace(/^\//, '');
  if (!rest) return 'home';
  return rest.split('/')[0];
}
