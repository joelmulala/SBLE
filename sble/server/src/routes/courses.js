const router = require('express').Router();
const multer = require('multer');
const { Op } = require('sequelize');
const keycloak = require('../config/keycloak');
const logger = require('../config/logger');
const { attachUser, requireLecturer, requireStudent, authorizeCourseAccess, audit } = require('../middleware/auth');
const { Course, Enrollment, User, Discussion, sequelize } = require('../models');

const guard = [keycloak.protect(), attachUser];
const PERFORMANCE_SERVICE_URL = process.env.PERFORMANCE_SERVICE_URL || 'http://localhost:8000/analyze-performance';
const PERFORMANCE_SERVICE_TIMEOUT_MS = Number.parseInt(process.env.PERFORMANCE_SERVICE_TIMEOUT_MS || '3000', 10);
const ASSIGNMENT_WEIGHT = 0.4;
const QUIZ_WEIGHT = 0.2;
const EXAM_WEIGHT = 0.4;

const toRounded = (value, precision = 2) => {
  const numeric = Number(value) || 0;
  return Number(numeric.toFixed(precision));
};

const classifyGrade = (finalScore) => {
  const score = Number(finalScore) || 0;

  if (score >= 75) return { grade: 'A', status: 'Green', category: 'Green' };
  if (score >= 60) return { grade: 'B', status: 'Green', category: 'Green' };
  if (score >= 50) return { grade: 'C', status: 'Amber', category: 'Orange' };
  if (score >= 40) return { grade: 'D', status: 'Amber', category: 'Orange' };
  return { grade: 'F', status: 'Red', category: 'Red' };
};

const submissionGradeReleasedForMetrics = (submission) => {
  if (!submission) return false;
  if (submission.grading_status === 'published' || submission.results_published_at) return true;
  if (submission.grade != null && (submission.grading_status == null || submission.grading_status === '')) return true;
  return false;
};

const getTrend = (scoredEvents = []) => {
  if (!Array.isArray(scoredEvents) || scoredEvents.length < 2) {
    return 'stable';
  }

  const sorted = [...scoredEvents]
    .filter((event) => Number.isFinite(event?.score) && event?.timestamp)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (sorted.length < 2) return 'stable';

  const windowed = sorted.slice(-3);
  const first = Number(windowed[0].score) || 0;
  const last = Number(windowed[windowed.length - 1].score) || 0;
  const delta = last - first;

  if (delta >= 5) return 'improving';
  if (delta <= -5) return 'declining';
  return 'stable';
};

const calculateWeightedPerformance = ({
  students,
  assignments,
  quizzes,
  exams,
  assignmentSubmissions,
  quizAttempts
}) => {
  const assignmentIds = assignments.map((assignment) => Number(assignment.id));
  const quizDefs = quizzes.map((quiz) => ({
    id: Number(quiz.id),
    totalMarks: Number(quiz.total_marks) || 0
  }));
  const examIds = exams.map((exam) => Number(exam.id));

  const assignmentLatest = new Map();
  assignmentSubmissions.forEach((row) => {
    const key = `${row.student_id}:${row.assignment_id}`;
    const previous = assignmentLatest.get(key);
    const currentTs = new Date(row.last_updated_time || row.submitted_at || 0).getTime();
    const previousTs = previous ? new Date(previous.last_updated_time || previous.submitted_at || 0).getTime() : -1;
    if (!previous || currentTs >= previousTs) {
      assignmentLatest.set(key, row);
    }
  });

  const quizLatest = new Map();
  quizAttempts.forEach((row) => {
    const key = `${row.student_id}:${row.quiz_id}`;
    const previous = quizLatest.get(key);
    const currentTs = new Date(row.submitted_at || row.started_at || 0).getTime();
    const previousTs = previous ? new Date(previous.submitted_at || previous.started_at || 0).getTime() : -1;
    if (!previous || currentTs >= previousTs) {
      quizLatest.set(key, row);
    }
  });

  const totalItems = assignmentIds.length + quizDefs.length + examIds.length;

  const performance = students.map((student) => {
    const studentDbId = student.user_id;
    const studentId = student.student_id;

    const assignmentPercentages = assignmentIds.map((assignmentId) => {
      const submission = assignmentLatest.get(`${studentDbId}:${assignmentId}`);
      if (!submission || !submissionGradeReleasedForMetrics(submission)) return 0;
      const rawGrade = Number(submission.grade);
      const normalized = Number.isFinite(rawGrade) ? Math.max(0, Math.min(100, rawGrade)) : 0;
      return normalized;
    });

    const quizPercentages = quizDefs.map((quiz) => {
      const attempt = quizLatest.get(`${studentDbId}:${quiz.id}`);
      if (!attempt) return 0;
      const score = Number(attempt.score) || 0;
      const totalMarks = Number(quiz.totalMarks) || 0;
      if (totalMarks <= 0) return 0;
      return Math.max(0, Math.min(100, (score / totalMarks) * 100));
    });

    // Exam submissions are not currently tracked per student in this schema.
    // Missing submissions are treated as 0 by design.
    const examPercentages = examIds.map(() => 0);

    const assignmentSubmitted = assignmentIds.filter((assignmentId) => assignmentLatest.has(`${studentDbId}:${assignmentId}`)).length;
    const quizSubmitted = quizDefs.filter((quiz) => quizLatest.has(`${studentDbId}:${quiz.id}`)).length;
    const examSubmitted = 0;
    const submittedItems = assignmentSubmitted + quizSubmitted + examSubmitted;

    const assignmentAvg = assignmentPercentages.length
      ? assignmentPercentages.reduce((sum, value) => sum + value, 0) / assignmentPercentages.length
      : 0;
    const quizAvg = quizPercentages.length
      ? quizPercentages.reduce((sum, value) => sum + value, 0) / quizPercentages.length
      : 0;
    const examAvg = examPercentages.length
      ? examPercentages.reduce((sum, value) => sum + value, 0) / examPercentages.length
      : 0;

    const completionRate = totalItems > 0 ? submittedItems / totalItems : 1;
    const weightedScore = (assignmentAvg * ASSIGNMENT_WEIGHT)
      + (quizAvg * QUIZ_WEIGHT)
      + (examAvg * EXAM_WEIGHT);
    const finalScore = weightedScore * completionRate;

    const events = [];
    assignmentIds.forEach((assignmentId) => {
      const submission = assignmentLatest.get(`${studentDbId}:${assignmentId}`);
      if (submission && submissionGradeReleasedForMetrics(submission)) {
        events.push({
          score: Number(submission.grade) || 0,
          timestamp: submission.last_updated_time || submission.submitted_at
        });
      }
    });
    quizDefs.forEach((quiz) => {
      const attempt = quizLatest.get(`${studentDbId}:${quiz.id}`);
      if (attempt) {
        const totalMarks = Number(quiz.totalMarks) || 0;
        const score = totalMarks > 0 ? ((Number(attempt.score) || 0) / totalMarks) * 100 : 0;
        events.push({
          score,
          timestamp: attempt.submitted_at || attempt.started_at
        });
      }
    });

    const trend = getTrend(events);
    const graded = classifyGrade(finalScore);
    const roundedAssignmentAvg = toRounded(assignmentAvg);
    const roundedQuizAvg = toRounded(quizAvg);
    const roundedExamAvg = toRounded(examAvg);
    const roundedCompletionRate = toRounded(completionRate, 4);
    const roundedFinalScore = toRounded(finalScore);

    return {
      studentId,
      assignmentAvg: roundedAssignmentAvg,
      quizAvg: roundedQuizAvg,
      examAvg: roundedExamAvg,
      completionRate: roundedCompletionRate,
      finalScore: roundedFinalScore,
      grade: graded.grade,
      status: graded.status,
      trend,

      // Backward compatibility for existing frontend visualizations.
      student_id: studentId,
      average_score: roundedFinalScore,
      category: graded.category,
      percentage: roundedFinalScore
    };
  });

  return { performance };
};

const sanitizeMessage = (value) => String(value || '')
  .replace(/[<>]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsv = file?.mimetype === 'text/csv'
      || file?.mimetype === 'application/vnd.ms-excel'
      || file?.originalname?.toLowerCase().endsWith('.csv');

    if (!isCsv) return cb(new Error('Only CSV files are allowed'));
    cb(null, true);
  }
});

const uploadEnrollmentCsv = (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

const getManagedCourse = async (courseId, user) => {
  const course = await Course.findByPk(courseId);
  if (!course || !course.is_active) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }

  if (user.role === 'admin') {
    return course;
  }

  if (user.role !== 'lecturer') {
    const err = new Error('Forbidden: only the assigned lecturer can manage enrollments');
    err.status = 403;
    throw err;
  }

  if (String(course.lecturer_id) !== String(user.id)) {
    const err = new Error('Forbidden: course not assigned to this lecturer');
    err.status = 403;
    throw err;
  }

  return course;
};

const findStudentRecord = async (identifier) => {
  const value = String(identifier || '').trim();
  if (!value) return null;

  return User.findOne({
    where: {
      [Op.or]: [{ student_id: value }, { id: value }],
      role: 'student',
      is_active: true
    }
  });
};

const createEnrollmentRecord = async (courseId, studentId) => Enrollment.findOrCreate({
  where: { course_id: courseId, student_id: studentId },
  defaults: { course_id: courseId, student_id: studentId }
});

const parseStudentIdsFromCsv = (buffer) => {
  const lines = String(buffer || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const firstLine = lines[0].toLowerCase();
  const dataLines = firstLine.includes('student_id') ? lines.slice(1) : lines;

  return [...new Set(dataLines.map(line => line.split(',')[0].trim()).filter(Boolean))];
};

// Get all courses (admins see all, lecturers see their own, students see enrolled)
router.get('/', ...guard, async (req, res) => {
  try {
    const { id, role } = req.user;
    let courses;

    if (role === 'admin') {
      courses = await Course.findAll({
        where: { is_active: true },
        include: [{ model: User, as: 'lecturer' }]
      });
    } else if (role === 'lecturer') {
      courses = await Course.findAll({
        where: { lecturer_id: id, is_active: true },
        include: [{ model: User, as: 'lecturer' }]
      });
    } else {
      const enrollments = await Enrollment.findAll({
        where: { student_id: id },
        include: [{ model: Course, include: [{ model: User, as: 'lecturer' }] }]
      });
      courses = enrollments.map(e => e.Course).filter(Boolean);
    }

    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create course (lecturers/admins only)
router.post('/', ...guard, requireLecturer, audit('CREATE_COURSE', 'course'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const course = await Course.create({ title, description, lecturer_id: req.user.id });
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enroll student in course (owner lecturer only; add by student_id)
router.post('/:id/enroll', ...guard, requireLecturer, audit('ENROLL_COURSE', 'course'), async (req, res) => {
  try {
    await getManagedCourse(req.params.id, req.user);

    const studentIdentifier = String(req.body?.student_id || '').trim();
    if (!studentIdentifier) {
      return res.status(400).json({ error: 'student_id is required' });
    }

    const student = await findStudentRecord(studentIdentifier);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const [enrollment, created] = await createEnrollmentRecord(req.params.id, student.id);
    if (!created) {
      return res.status(409).json({ error: 'Student already enrolled in this course' });
    }

    res.status(201).json({
      enrollment,
      student: {
        id: student.id,
        student_id: student.student_id,
        full_name: student.full_name,
        email: student.email
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// List enrollments for a course (assigned lecturer/admin only)
router.get('/:id/enrollments', ...guard, requireLecturer,
  authorizeCourseAccess(req => req.params.id, {
    managerOnly: true,
    managerMessage: 'Forbidden: only the assigned lecturer or admin can view enrollments'
  }),
  async (req, res) => {
    try {
      const enrollments = await Enrollment.findAll({
        where: { course_id: req.params.id },
        include: [{
          model: User,
          as: 'student',
          attributes: ['id', 'student_id', 'full_name', 'email', 'program', 'year_of_study', 'mode']
        }],
        order: [['id', 'DESC']]
      });

      res.json(enrollments.map((enrollment) => ({
        id: enrollment.id,
        course_id: enrollment.course_id,
        student_id: enrollment.student?.student_id || enrollment.student_id,
        student: enrollment.student || null
      })));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// List students available for enrollment in a course (assigned lecturer/admin only)
router.get('/:id/enrollment-candidates', ...guard, requireLecturer,
  authorizeCourseAccess(req => req.params.id, {
    managerOnly: true,
    managerMessage: 'Forbidden: only the assigned lecturer or admin can manage enrollments'
  }),
  async (req, res) => {
    try {
      const search = String(req.query?.q || '').trim();
      const limit = Math.min(200, Math.max(1, Number.parseInt(req.query?.limit || '100', 10) || 100));

      const existingEnrollments = await Enrollment.findAll({
        where: { course_id: req.params.id },
        attributes: ['student_id']
      });

      const enrolledIds = existingEnrollments.map((row) => row.student_id).filter(Boolean);
      const where = {
        role: 'student',
        is_active: true,
        ...(enrolledIds.length ? { id: { [Op.notIn]: enrolledIds } } : {})
      };

      if (search) {
        where[Op.or] = [
          { student_id: { [Op.iLike]: `%${search}%` } },
          { full_name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const students = await User.findAll({
        where,
        attributes: ['id', 'student_id', 'full_name', 'email', 'program', 'year_of_study', 'mode'],
        order: [['student_id', 'ASC'], ['full_name', 'ASC']],
        limit
      });

      return res.json(students);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Batch enroll students from CSV (assigned lecturer/admin only)
router.post('/:id/enroll/csv', ...guard, requireLecturer, uploadEnrollmentCsv, audit('BATCH_ENROLL_COURSE', 'course'), async (req, res) => {
  try {
    await getManagedCourse(req.params.id, req.user);

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const studentIds = parseStudentIdsFromCsv(req.file.buffer);
    if (!studentIds.length) {
      return res.status(400).json({ error: 'No student_id values found in CSV' });
    }

    const result = {
      processed: studentIds.length,
      enrolled: [],
      alreadyEnrolled: [],
      notFound: []
    };

    for (const studentId of studentIds) {
      const student = await findStudentRecord(studentId);
      if (!student) {
        result.notFound.push(studentId);
        continue;
      }

      const [enrollment, created] = await createEnrollmentRecord(req.params.id, student.id);
      const summary = {
        id: student.id,
        student_id: student.student_id,
        full_name: student.full_name,
        email: student.email,
        enrollment_id: enrollment.id
      };

      if (created) result.enrolled.push(summary);
      else result.alreadyEnrolled.push(summary);
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Remove student from course (assigned lecturer/admin only)
router.delete('/:id/enroll/:studentId', ...guard, requireLecturer, audit('REMOVE_ENROLLMENT', 'course'), async (req, res) => {
  try {
    await getManagedCourse(req.params.id, req.user);

    const student = await findStudentRecord(req.params.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const deleted = await Enrollment.destroy({
      where: {
        course_id: req.params.id,
        student_id: student.id
      }
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({
      removed: true,
      course_id: Number(req.params.id),
      student_id: student.id
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update course (assigned lecturer/admin only)
router.put('/:id', ...guard, requireLecturer, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (req.user.role === 'lecturer' && String(course.lecturer_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: course not assigned to this lecturer' });
    }

    const { title, description } = req.body;

    if (title !== undefined && (!String(title).trim() || String(title).trim().length < 3)) {
      return res.status(400).json({ error: 'Title must be at least 3 characters long' });
    }

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be a string' });
    }

    await course.update({
      title: title !== undefined ? String(title).trim() : course.title,
      description: description !== undefined ? description.trim() : course.description
    });

    const updatedCourse = await Course.findByPk(req.params.id, {
      include: [{ model: User, as: 'lecturer' }]
    });

    res.json(updatedCourse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List course discussions (course members only)
router.get('/:id/discussions', ...guard, authorizeCourseAccess(req => req.params.id), async (req, res) => {
  try {
    const discussions = await Discussion.findAll({
      where: { course_id: req.params.id },
      include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }],
      order: [['created_at', 'ASC']]
    });

    res.json(discussions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post to course discussions (course members only)
router.post('/:id/discussions', ...guard, authorizeCourseAccess(req => req.params.id), audit('CREATE_DISCUSSION', 'discussion'), async (req, res) => {
  try {
    const message = sanitizeMessage(req.body?.message);
    if (!message) {
      return res.status(400).json({ error: 'Message must not be empty' });
    }

    const discussion = await Discussion.create({
      course_id: req.params.id,
      user_id: req.user.id,
      message
    });

    const createdDiscussion = await Discussion.findByPk(discussion.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }]
    });

    res.status(201).json(createdDiscussion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single course with RBAC-aware access control
router.get('/:id/performance', ...guard, requireLecturer,
  authorizeCourseAccess(req => req.params.id, {
    managerOnly: true,
    managerMessage: 'Forbidden: only the assigned lecturer or admin can view course performance'
  }),
  async (req, res) => {
    try {
      const courseId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(courseId)) {
        return res.status(400).json({ error: 'Invalid course id' });
      }

      const [students] = await sequelize.query(`
        SELECT
          e.student_id AS user_id,
          COALESCE(NULLIF(TRIM(u.student_id), ''), u.id) AS student_id
        FROM enrollments e
        JOIN users u ON u.id = e.student_id
        WHERE e.course_id = :courseId
        ORDER BY COALESCE(NULLIF(TRIM(u.student_id), ''), u.id) ASC
      `, { replacements: { courseId } });

      const [assignments] = await sequelize.query(`
        SELECT id
        FROM assignments
        WHERE course_id = :courseId
        ORDER BY id ASC
      `, { replacements: { courseId } });

      const [quizzes] = await sequelize.query(`
        SELECT
          q.id,
          COALESCE(SUM(COALESCE(qq.marks, 1)), 0)::numeric AS total_marks
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
        WHERE q.course_id = :courseId AND q.is_published = true
        GROUP BY q.id
        ORDER BY q.id ASC
      `, { replacements: { courseId } });

      const [exams] = await sequelize.query(`
        SELECT id
        FROM exams
        WHERE course_id = :courseId
        ORDER BY id ASC
      `, { replacements: { courseId } });

      const [assignmentSubmissions] = await sequelize.query(`
        SELECT
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
          qa.quiz_id,
          qa.student_id,
          qa.score,
          qa.started_at,
          qa.submitted_at,
          COALESCE((
            SELECT SUM(COALESCE(qq.marks, 1))
            FROM quiz_questions qq
            WHERE qq.quiz_id = qa.quiz_id
          ), 0)::numeric AS total_marks
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE q.course_id = :courseId
          AND q.is_published = true
          AND qa.submitted_at IS NOT NULL
      `, { replacements: { courseId } });

      const performancePayload = calculateWeightedPerformance({
        students,
        assignments,
        quizzes,
        exams,
        assignmentSubmissions,
        quizAttempts
      });

      const releasedSubs = assignmentSubmissions.filter((s) => submissionGradeReleasedForMetrics(s));
      const releasedGrades = releasedSubs.map((s) => Number(s.grade)).filter((n) => Number.isFinite(n));
      const quizPctParts = quizAttempts.map((qa) => {
        const tm = Number(qa.total_marks) || 0;
        if (tm <= 0) return null;
        return Math.max(0, Math.min(100, ((Number(qa.score) || 0) / tm) * 100));
      }).filter((x) => x != null);

      const assessment_metrics = {
        students_enrolled: students.length,
        assignments_in_course: assignments.length,
        published_quizzes_in_course: quizzes.length,
        assignment_submission_rows: assignmentSubmissions.length,
        assignment_grades_released: releasedSubs.length,
        assignment_pass_count: releasedGrades.filter((g) => g >= 50).length,
        assignment_fail_count: releasedGrades.filter((g) => g < 50).length,
        average_released_assignment_grade: releasedGrades.length
          ? Number((releasedGrades.reduce((a, b) => a + b, 0) / releasedGrades.length).toFixed(2))
          : null,
        quiz_completed_attempts: quizAttempts.length,
        quiz_pass_count: quizPctParts.filter((g) => g >= 50).length,
        quiz_fail_count: quizPctParts.filter((g) => g < 50).length,
        average_quiz_percent: quizPctParts.length
          ? Number((quizPctParts.reduce((a, b) => a + b, 0) / quizPctParts.length).toFixed(2))
          : null,
        assignment_pass_rate_percent: releasedGrades.length
          ? Number(((releasedGrades.filter((g) => g >= 50).length / releasedGrades.length) * 100).toFixed(2))
          : null,
        quiz_pass_rate_percent: quizPctParts.length
          ? Number(((quizPctParts.filter((g) => g >= 50).length / quizPctParts.length) * 100).toFixed(2))
          : null
      };

      const enrichedPayload = { ...performancePayload, assessment_metrics };
      // Keep optional integration hook: if the service is reachable and supports
      // this payload shape, it may post-process further. Otherwise return Node.js result.
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PERFORMANCE_SERVICE_TIMEOUT_MS);
        const response = await fetch(PERFORMANCE_SERVICE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const serviceData = await response.json();
            if (Array.isArray(serviceData?.performance)) {
              return res.json({ ...serviceData, assessment_metrics });
            }
          }
        }
      } catch (serviceError) {
        logger.error(`Performance service unavailable, returning Node.js analytics: ${serviceError.message}`);
      }

      return res.json(enrichedPayload);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.get('/:id', ...guard, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id, { include: [{ model: User, as: 'lecturer' }] });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { role } = req.user;
    if (role === 'admin') return res.json(course);

    if (role === 'lecturer') {
      if (String(course.lecturer_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden: course not assigned to this lecturer' });
      }
      return res.json(course);
    }

    const enrollment = await Enrollment.findOne({
      where: { course_id: req.params.id, student_id: req.user.id }
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Forbidden: not enrolled in this course' });
    }

    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
