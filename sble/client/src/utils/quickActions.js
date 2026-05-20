export function getQuickActions({ isAdmin, isLecturer, firstCourseId, hasLiveSession }) {
  if (isAdmin) {
    return [
      { id: 'users', label: 'Manage users', description: 'Accounts and roles', to: '/users', primary: true },
      { id: 'enrollment', label: 'Enrollment', description: 'Roster and course access', to: '/lecturer/enrollment' },
      { id: 'courses', label: 'Course catalog', description: 'Programs and structure', to: '/lecturer/courses' },
      { id: 'live', label: 'Live classrooms', description: 'Active sessions', to: '/rooms', highlight: hasLiveSession }
    ];
  }

  if (isLecturer) {
    const courseBase = firstCourseId ? `/lecturer/courses/${firstCourseId}` : '/lecturer/courses';
    return [
      {
        id: 'assignment',
        label: 'Create assignment',
        description: firstCourseId ? 'In your course' : 'Open a course first',
        to: `${courseBase}/assignments`,
        primary: true
      },
      {
        id: 'live',
        label: 'Start live class',
        description: 'Open classroom hub',
        to: '/rooms',
        highlight: hasLiveSession
      },
      {
        id: 'grade',
        label: 'Grade submissions',
        description: 'Course gradebook',
        to: firstCourseId ? `${courseBase}/assignments` : '/lecturer/gradebook'
      }
    ];
  }

  const courseBase = firstCourseId ? `/student/courses/${firstCourseId}` : '/student/courses';
  return [
    {
      id: 'continue',
      label: 'Continue course',
      description: firstCourseId ? 'Resume learning' : 'Browse courses',
      to: courseBase,
      primary: true
    },
    {
      id: 'live',
      label: 'Join live session',
      description: 'Active classes',
      to: '/rooms',
      highlight: hasLiveSession
    },
    {
      id: 'grades',
      label: 'View grades',
      description: 'Academic record',
      to: '/student/gradebook'
    }
  ];
}
