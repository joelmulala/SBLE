const SEGMENT_LABELS = {
  dashboard: 'Dashboard',
  courses: 'Courses',
  materials: 'Materials',
  assignments: 'Assignments',
  quizzes: 'Quizzes',
  exams: 'Exams',
  gradebook: 'Gradebook',
  communications: 'Communication',
  calendar: 'Calendar',
  enrollment: 'Enrollment',
  performance: 'Performance',
  rooms: 'Live classes',
  room: 'Live classroom',
  users: 'Users'
};

export function resolvePageTitle(pathname) {
  if (pathname.includes('/dashboard')) return 'Dashboard';
  if (pathname.match(/\/courses\/[^/]+$/)) return 'Course overview';
  if (pathname.includes('/courses')) return 'Courses';
  if (pathname.includes('/materials')) return 'Materials';
  if (pathname.includes('/assignments')) return 'Assignments';
  if (pathname.includes('/quizzes')) return 'Quizzes';
  if (pathname.includes('/exams')) return 'Exams';
  if (pathname.includes('/performance')) return 'Performance';
  if (pathname.includes('/gradebook')) return 'Gradebook';
  if (pathname.includes('/calendar')) return 'Calendar';
  if (pathname.includes('/communications')) return 'Communication';
  if (pathname.includes('/enrollment')) return 'Enrollment';
  if (pathname.includes('/room')) return 'Live classroom';
  if (pathname.includes('/users')) return 'User management';
  return 'Workspace';
}

export function buildBreadcrumbs(pathname, { isLecturer, courseTitle } = {}) {
  const crumbs = [];
  const prefix = isLecturer ? '/lecturer' : '/student';
  const dashTo = isLecturer ? '/lecturer/dashboard' : '/student/dashboard';

  crumbs.push({ label: 'Dashboard', to: dashTo });

  const courseMatch = pathname.match(/\/courses\/([^/]+)(?:\/([^/]+))?/);
  if (courseMatch) {
    const [, courseId, segment] = courseMatch;
    crumbs.push({ label: 'Courses', to: `${prefix}/courses` });
    crumbs.push({
      label: courseTitle || 'Course',
      to: `${prefix}/courses/${courseId}`
    });
    if (segment && SEGMENT_LABELS[segment]) {
      crumbs.push({
        label: SEGMENT_LABELS[segment],
        to: `${prefix}/courses/${courseId}/${segment}`
      });
    }
    return crumbs;
  }

  if (pathname.includes('/courses')) {
    crumbs.push({ label: 'Courses', to: `${prefix}/courses` });
    return crumbs;
  }

  if (pathname.includes('/calendar')) {
    crumbs.push({ label: 'Calendar', to: `${prefix}/calendar` });
    return crumbs;
  }

  if (pathname.includes('/gradebook')) {
    crumbs.push({ label: 'Gradebook', to: `${prefix}/gradebook` });
    return crumbs;
  }

  if (pathname.includes('/rooms') || pathname.includes('/room/')) {
    crumbs.push({ label: 'Live classes', to: '/rooms' });
    return crumbs;
  }

  if (pathname.includes('/users')) {
    crumbs.push({ label: 'User management', to: '/users' });
    return crumbs;
  }

  return crumbs;
}

export function getWorkspaceRoleMode(roles) {
  if (roles.isAdmin) return 'admin';
  if (roles.isLecturer) return 'lecturer';
  return 'student';
}
