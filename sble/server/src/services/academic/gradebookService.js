const { sequelize } = require('../../models');
const { ASSESSMENT_CATEGORIES, getCategoryWeights } = require('./gradeAggregationConfig');
const {
  GRADE_STATES,
  toRounded,
  submissionGradeReleased,
  resolveAssignmentGradeState,
  resolveQuizGradeState,
  resolveExamGradeState,
  buildLatestSubmissionMap,
  buildLatestQuizAttemptMap,
  averagePercent,
  computeWeightedTotal,
  classifyLetterGrade,
  computeCompletionRate,
  countGradeStates,
  getTrend
} = require('./gradeAggregationUtils');

async function fetchCourseAcademicData(courseId) {
  const [students] = await sequelize.query(`
    SELECT
      e.student_id AS user_id,
      COALESCE(NULLIF(TRIM(u.student_id), ''), u.id) AS student_id,
      u.full_name,
      u.email
    FROM enrollments e
    JOIN users u ON u.id = e.student_id
    WHERE e.course_id = :courseId
    ORDER BY COALESCE(NULLIF(TRIM(u.student_id), ''), u.id) ASC
  `, { replacements: { courseId } });

  const [assignments] = await sequelize.query(`
    SELECT id, title, due_date
    FROM assignments
    WHERE course_id = :courseId
    ORDER BY due_date ASC NULLS LAST, id ASC
  `, { replacements: { courseId } });

  const [quizzes] = await sequelize.query(`
    SELECT
      q.id,
      q.title,
      q.time_limit_minutes,
      COALESCE(SUM(COALESCE(qq.marks, 1)), 0)::numeric AS total_marks
    FROM quizzes q
    LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
    WHERE q.course_id = :courseId AND q.is_published = true
    GROUP BY q.id, q.title, q.time_limit_minutes
    ORDER BY q.id ASC
  `, { replacements: { courseId } });

  const [exams] = await sequelize.query(`
    SELECT id, title, scheduled_at, duration_minutes, is_released
    FROM exams
    WHERE course_id = :courseId
    ORDER BY scheduled_at ASC NULLS LAST, id ASC
  `, { replacements: { courseId } });

  const [assignmentSubmissions] = await sequelize.query(`
    SELECT
      s.id AS submission_id,
      s.assignment_id,
      s.student_id,
      s.grade,
      s.feedback,
      s.submitted_at,
      s.last_updated_time,
      s.grading_status,
      s.results_published_at
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE a.course_id = :courseId
  `, { replacements: { courseId } });

  const [quizAttempts] = await sequelize.query(`
    SELECT
      qa.id AS attempt_id,
      qa.quiz_id,
      qa.student_id,
      qa.score,
      qa.started_at,
      qa.submitted_at,
      qa.status,
      COALESCE((
        SELECT SUM(COALESCE(qq.marks, 1))
        FROM quiz_questions qq
        WHERE qq.quiz_id = qa.quiz_id
      ), 0)::numeric AS total_marks
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE q.course_id = :courseId AND q.is_published = true
  `, { replacements: { courseId } });

  const [discussionCounts] = await sequelize.query(`
    SELECT user_id, COUNT(*)::int AS post_count
    FROM discussions
    WHERE course_id = :courseId
    GROUP BY user_id
  `, { replacements: { courseId } });

  const [attendanceRows] = await sequelize.query(`
    SELECT
      e.student_id AS user_id,
      COUNT(DISTINCT lca.session_id)::int AS sessions_attended,
      (
        SELECT COUNT(*)::int
        FROM live_class_sessions lcs2
        WHERE lcs2.course_id = :courseId
      ) AS total_sessions
    FROM enrollments e
    LEFT JOIN live_class_sessions lcs ON lcs.course_id = e.course_id
    LEFT JOIN live_class_attendance lca
      ON lca.session_id = lcs.id AND lca.user_id = e.student_id
    WHERE e.course_id = :courseId
    GROUP BY e.student_id
  `, { replacements: { courseId } });

  return {
    students,
    assignments,
    quizzes,
    exams,
    assignmentSubmissions,
    quizAttempts,
    discussionCounts,
    attendanceRows
  };
}

function buildStudentAcademicRecord(student, data, { maskUnpublished = false } = {}) {
  const studentDbId = student.user_id;
  const assignmentMap = buildLatestSubmissionMap(data.assignmentSubmissions);
  const quizMap = buildLatestQuizAttemptMap(data.quizAttempts);

  const discussionByUser = new Map(
    (data.discussionCounts || []).map((r) => [String(r.user_id), Number(r.post_count) || 0])
  );
  const attendanceByUser = new Map(
    (data.attendanceRows || []).map((r) => [String(r.user_id), r])
  );

  const assignmentItems = (data.assignments || []).map((assignment) => {
    const submission = assignmentMap.get(`${studentDbId}:${assignment.id}`);
    const resolved = resolveAssignmentGradeState(submission, assignment);
    if (maskUnpublished && !resolved.visible) {
      return {
        id: Number(assignment.id),
        title: assignment.title,
        dueDate: assignment.due_date,
        state: resolved.state === GRADE_STATES.GRADED ? GRADE_STATES.UNGRADED : resolved.state,
        score: null,
        percent: null,
        feedback: null,
        display: resolved.state === GRADE_STATES.MISSING ? '—' : 'Pending',
        isLate: resolved.isLate || false
      };
    }
    return {
      id: Number(assignment.id),
      title: assignment.title,
      dueDate: assignment.due_date,
      state: resolved.state,
      score: resolved.score,
      percent: resolved.percent,
      feedback: resolved.visible ? resolved.feedback : null,
      display: resolved.display,
      isLate: resolved.isLate || false
    };
  });

  const quizItems = (data.quizzes || []).map((quiz) => {
    const attempt = quizMap.get(`${studentDbId}:${quiz.id}`);
    const resolved = resolveQuizGradeState(attempt, {
      id: quiz.id,
      totalMarks: Number(quiz.total_marks) || 0
    });
    return {
      id: Number(quiz.id),
      title: quiz.title,
      state: resolved.state,
      score: resolved.score,
      percent: resolved.percent,
      maxScore: resolved.maxScore,
      display: resolved.display
    };
  });

  const examItems = (data.exams || []).map((exam) => {
    const resolved = resolveExamGradeState(exam);
    return {
      id: Number(exam.id),
      title: exam.title,
      scheduledAt: exam.scheduled_at,
      isReleased: Boolean(exam.is_released),
      state: resolved.state,
      score: resolved.score,
      percent: resolved.percent,
      display: resolved.display,
      placeholder: true
    };
  });

  const assignmentPercents = assignmentItems.map((item) => {
    if (item.state === GRADE_STATES.EXCUSED) return null;
    if (item.percent != null) return item.percent;
    if (item.state === GRADE_STATES.MISSING) return 0;
    return null;
  }).filter((v) => v != null);

  const quizPercents = quizItems.map((item) => {
    if (item.percent != null) return item.percent;
    if (item.state === GRADE_STATES.MISSING) return 0;
    return null;
  }).filter((v) => v != null);

  const assignmentAvg = averagePercent(assignmentPercents);
  const quizAvg = averagePercent(quizPercents);

  const attendanceRow = attendanceByUser.get(String(studentDbId)) || {};
  const sessionsAttended = Number(attendanceRow.sessions_attended) || 0;
  const totalSessions = Number(attendanceRow.total_sessions) || 0;
  const attendancePercent = totalSessions > 0
    ? toRounded((sessionsAttended / totalSessions) * 100)
    : null;

  const discussionPosts = discussionByUser.get(String(studentDbId)) || 0;
  const participationPercent = discussionPosts > 0
    ? Math.min(100, toRounded(discussionPosts * 10))
    : null;

  const categoryWeights = getCategoryWeights();
  const categoryScores = {
    assignments: {
      weight: categoryWeights.assignments,
      average: assignmentAvg,
      itemCount: assignmentItems.length,
      completedCount: assignmentItems.filter((i) => i.state !== GRADE_STATES.MISSING).length,
      gradedCount: assignmentItems.filter((i) => [GRADE_STATES.GRADED, GRADE_STATES.LATE].includes(i.state)).length
    },
    quizzes: {
      weight: categoryWeights.quizzes,
      average: quizAvg,
      itemCount: quizItems.length,
      completedCount: quizItems.filter((i) => i.state === GRADE_STATES.GRADED).length,
      gradedCount: quizItems.filter((i) => i.state === GRADE_STATES.GRADED).length
    },
    exams: {
      weight: categoryWeights.exams,
      average: null,
      itemCount: examItems.length,
      completedCount: examItems.filter((i) => i.isReleased).length,
      placeholder: true
    },
    participation: {
      weight: categoryWeights.participation,
      average: participationPercent,
      itemCount: 1,
      completedCount: discussionPosts > 0 ? 1 : 0,
      placeholder: true,
      meta: { discussionPosts }
    },
    attendance: {
      weight: categoryWeights.attendance,
      average: attendancePercent,
      itemCount: totalSessions,
      completedCount: sessionsAttended,
      placeholder: true,
      meta: { sessionsAttended, totalSessions }
    }
  };

  const gradableResult = computeWeightedTotal({
    assignments: categoryScores.assignments,
    quizzes: categoryScores.quizzes
  });
  const finalScore = gradableResult.weightedAverage;
  const activeWeight = gradableResult.activeWeight;
  const letter = classifyLetterGrade(finalScore);

  const requiredItems = assignmentItems.length + quizItems.length + examItems.length;
  const completedItems = assignmentItems.filter((i) => i.state !== GRADE_STATES.MISSING).length
    + quizItems.filter((i) => i.state === GRADE_STATES.GRADED).length
    + examItems.filter((i) => i.isReleased).length;

  const scoredEvents = [];
  assignmentItems.forEach((item) => {
    if (item.percent != null) {
      scoredEvents.push({ score: item.percent, timestamp: item.dueDate });
    }
  });
  quizItems.forEach((item) => {
    if (item.percent != null) {
      scoredEvents.push({ score: item.percent, timestamp: new Date().toISOString() });
    }
  });

  return {
    userId: studentDbId,
    studentId: student.student_id,
    fullName: student.full_name,
    email: student.email,
    categories: {
      assignments: { items: assignmentItems, ...categoryScores.assignments },
      quizzes: { items: quizItems, ...categoryScores.quizzes },
      exams: { items: examItems, ...categoryScores.exams },
      participation: categoryScores.participation,
      attendance: categoryScores.attendance
    },
    summary: {
      assignmentAvg,
      quizAvg,
      examAvg: null,
      participationPercent,
      attendancePercent,
      weightedAverage: finalScore,
      totalScore: finalScore,
      activeWeight,
      completionRate: computeCompletionRate({ requiredItems, completedItems }),
      letter: letter.letter,
      status: letter.status,
      trend: getTrend(scoredEvents),
      itemsRequired: requiredItems,
      itemsCompleted: completedItems
    },
    gradeStates: {
      assignments: countGradeStates(assignmentItems),
      quizzes: countGradeStates(quizItems),
      exams: countGradeStates(examItems)
    }
  };
}

function buildCourseGradebook(data, { viewerUserId = null, viewerRole = 'lecturer', maskUnpublished = false } = {}) {
  const students = viewerRole === 'student' && viewerUserId
    ? data.students.filter((s) => String(s.user_id) === String(viewerUserId))
    : data.students;

  const shouldMask = maskUnpublished || viewerRole === 'student';
  const rows = students.map((student) => buildStudentAcademicRecord(student, data, { maskUnpublished: shouldMask }));

  const statistics = viewerRole !== 'student'
    ? buildCourseStatistics(data, rows)
    : null;

  return {
    schemaVersion: 2,
    categories: ASSESSMENT_CATEGORIES,
    weights: getCategoryWeights(),
    columns: {
      assignments: (data.assignments || []).map((a) => ({
        id: Number(a.id),
        title: a.title,
        dueDate: a.due_date
      })),
      quizzes: (data.quizzes || []).map((q) => ({
        id: Number(q.id),
        title: q.title,
        totalMarks: Number(q.total_marks) || 0
      })),
      exams: (data.exams || []).map((e) => ({
        id: Number(e.id),
        title: e.title,
        scheduledAt: e.scheduled_at,
        isReleased: Boolean(e.is_released)
      }))
    },
    rows,
    statistics
  };
}

function buildCourseStatistics(data, rows) {
  const allAssignmentStates = rows.flatMap((r) => r.categories.assignments.items || []);
  const allQuizStates = rows.flatMap((r) => r.categories.quizzes.items || []);
  const scores = rows.map((r) => r.summary.weightedAverage).filter((s) => s != null);

  const gradingProgress = {
    assignments: {
      total: (data.assignments || []).length * (data.students || []).length,
      submitted: allAssignmentStates.filter((i) => i.state !== GRADE_STATES.MISSING).length,
      graded: allAssignmentStates.filter((i) => [GRADE_STATES.GRADED, GRADE_STATES.LATE].includes(i.state)).length,
      pending: allAssignmentStates.filter((i) => [GRADE_STATES.UNGRADED, GRADE_STATES.IN_PROGRESS].includes(i.state)).length,
      missing: allAssignmentStates.filter((i) => i.state === GRADE_STATES.MISSING).length
    },
    quizzes: {
      total: (data.quizzes || []).length * (data.students || []).length,
      completed: allQuizStates.filter((i) => i.state === GRADE_STATES.GRADED).length,
      missing: allQuizStates.filter((i) => i.state === GRADE_STATES.MISSING).length
    }
  };

  return {
    studentsEnrolled: (data.students || []).length,
    classAverage: scores.length ? toRounded(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    passCount: scores.filter((s) => s >= 50).length,
    failCount: scores.filter((s) => s < 50).length,
    passRatePercent: scores.length
      ? toRounded((scores.filter((s) => s >= 50).length / scores.length) * 100)
      : null,
    gradingProgress,
    distribution: {
      A: scores.filter((s) => s >= 75).length,
      B: scores.filter((s) => s >= 60 && s < 75).length,
      C: scores.filter((s) => s >= 50 && s < 60).length,
      D: scores.filter((s) => s >= 40 && s < 50).length,
      F: scores.filter((s) => s < 40).length
    }
  };
}

/**
 * Performance payload for /courses/:id/performance — single source of truth.
 */
function buildPerformancePayload(data) {
  const gradebook = buildCourseGradebook(data, { viewerRole: 'lecturer' });
  const performance = gradebook.rows.map((row) => {
    const score = row.summary.weightedAverage;
    const letter = classifyLetterGrade(score);
    return {
      studentId: row.studentId,
      student_id: row.studentId,
      assignmentAvg: row.summary.assignmentAvg,
      quizAvg: row.summary.quizAvg,
      examAvg: row.summary.examAvg,
      completionRate: row.summary.completionRate,
      finalScore: score,
      average_score: score,
      percentage: score,
      grade: letter.letter,
      status: letter.status === 'excellent' || letter.status === 'good' ? 'Green' : letter.status === 'satisfactory' || letter.status === 'at_risk' ? 'Amber' : 'Red',
      category: letter.status === 'excellent' || letter.status === 'good' ? 'Green' : letter.status === 'satisfactory' || letter.status === 'at_risk' ? 'Orange' : 'Red',
      trend: row.summary.trend
    };
  });

  const stats = gradebook.statistics;
  const assignmentStates = gradebook.rows.flatMap((r) => r.categories.assignments.items);
  const quizStates = gradebook.rows.flatMap((r) => r.categories.quizzes.items);

  const releasedGrades = assignmentStates
    .filter((i) => i.percent != null)
    .map((i) => Number(i.percent));
  const quizPercents = quizStates
    .filter((i) => i.percent != null)
    .map((i) => Number(i.percent));

  const assessment_metrics = {
    students_enrolled: stats.studentsEnrolled,
    assignments_in_course: (data.assignments || []).length,
    published_quizzes_in_course: (data.quizzes || []).length,
    assignment_submission_rows: assignmentStates.filter((i) => i.state !== GRADE_STATES.MISSING).length,
    assignment_grades_released: releasedGrades.length,
    assignment_pass_count: releasedGrades.filter((g) => g >= 50).length,
    assignment_fail_count: releasedGrades.filter((g) => g < 50).length,
    average_released_assignment_grade: releasedGrades.length
      ? toRounded(releasedGrades.reduce((a, b) => a + b, 0) / releasedGrades.length)
      : null,
    quiz_completed_attempts: quizStates.filter((i) => i.state === GRADE_STATES.GRADED).length,
    quiz_pass_count: quizPercents.filter((g) => g >= 50).length,
    quiz_fail_count: quizPercents.filter((g) => g < 50).length,
    average_quiz_percent: quizPercents.length
      ? toRounded(quizPercents.reduce((a, b) => a + b, 0) / quizPercents.length)
      : null,
    assignment_pass_rate_percent: releasedGrades.length
      ? toRounded((releasedGrades.filter((g) => g >= 50).length / releasedGrades.length) * 100)
      : null,
    quiz_pass_rate_percent: quizPercents.length
      ? toRounded((quizPercents.filter((g) => g >= 50).length / quizPercents.length) * 100)
      : null,
    class_average: stats.classAverage,
    pass_rate_percent: stats.passRatePercent
  };

  return { performance, assessment_metrics, gradebook };
}

async function getCourseGradebook(courseId, options = {}) {
  const data = await fetchCourseAcademicData(courseId);
  return buildCourseGradebook(data, options);
}

async function getCoursePerformance(courseId) {
  const data = await fetchCourseAcademicData(courseId);
  return buildPerformancePayload(data);
}

async function getStudentBreakdown(courseId, studentUserId, { viewerRole = 'lecturer' } = {}) {
  const data = await fetchCourseAcademicData(courseId);
  const student = data.students.find((s) => String(s.user_id) === String(studentUserId));
  if (!student) {
    const err = new Error('Student not enrolled in this course');
    err.status = 404;
    throw err;
  }
  const maskUnpublished = viewerRole === 'student';
  return buildStudentAcademicRecord(student, data, { maskUnpublished });
}

async function getGlobalGradebook(userId, role) {
  let courseList = [];

  if (role === 'admin') {
    const [courses] = await sequelize.query(
      'SELECT id, title FROM courses WHERE is_active = true ORDER BY title ASC'
    );
    courseList = courses;
  } else if (role === 'lecturer') {
    const [courses] = await sequelize.query(`
      SELECT id, title FROM courses WHERE lecturer_id = :userId AND is_active = true ORDER BY title ASC
    `, { replacements: { userId } });
    courseList = courses;
  } else {
    const [courses] = await sequelize.query(`
      SELECT c.id, c.title
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.student_id = :userId AND c.is_active = true
      ORDER BY c.title ASC
    `, { replacements: { userId } });
    courseList = courses;
  }

  const viewerRole = role === 'student' ? 'student' : 'lecturer';

  return Promise.all(courseList.map(async (course) => {
    const gradebook = await getCourseGradebook(course.id, {
      viewerUserId: role === 'student' ? userId : null,
      viewerRole
    });
    const myRow = role === 'student'
      ? gradebook.rows.find((r) => String(r.userId) === String(userId))
      : null;

    return {
      courseId: course.id,
      courseTitle: course.title,
      summary: myRow?.summary || null,
      ...gradebook
    };
  }));
}

module.exports = {
  fetchCourseAcademicData,
  buildCourseGradebook,
  buildStudentAcademicRecord,
  buildPerformancePayload,
  getCourseGradebook,
  getCoursePerformance,
  getStudentBreakdown,
  getGlobalGradebook,
  submissionGradeReleased
};
