const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, requireStudent, authorizeCourseAccess } = require('../middleware/auth');
const { Quiz, QuizQuestion, QuizAttempt, User, Course, Enrollment } = require('../models');
const {
  getQuizWindow,
  ensureQuizWindowOpen,
  gradeQuizAttempt,
  getAttemptExpiry,
  computeExpiresAtForAttempt,
  isAttemptTimeExpired,
  finalizeAttempt: finalizeAttemptRecord
} = require('../services/assessment/quizAssessmentService');
const { validateQuizQuestionsForPublish, totalDurationMinutesFromPayload } = require('../services/assessment/quizIntegrity');
const { requireNonemptyTitle, filterAnswersForQuiz } = require('../utils/validation');
const { toPgUtcTimestamp } = require('../utils/datetime');

const guard = [keycloak.protect(), attachUser];

const formatGradingPayload = (gradingResult, extra = {}) => {
  const grading = gradingResult?.grading || gradingResult || {};
  const score = grading.score ?? 0;
  const totalMarks = grading.totalMarks ?? 0;
  return {
    score,
    totalMarks,
    correctAnswers: grading.correctAnswers,
    feedback: grading.feedback,
    message: `You scored ${score}/${totalMarks}`,
    ...extra
  };
};

const decorateQuiz = (quiz) => {
  const { startTime, endTime, durationMinutes } = getQuizWindow(quiz);
  quiz.setDataValue('start_time', startTime);
  quiz.setDataValue('end_time', endTime);
  quiz.setDataValue('duration_minutes', durationMinutes);
  return quiz;
};

const normalizeQuestion = (question = {}) => {
  const questionType = question?.question_type || 'mcq';
  const marks = Math.max(1, Number.parseInt(question?.marks ?? 1, 10) || 1);

  return {
    id: question?.id ? Number.parseInt(question.id, 10) || null : null,
    question_text: String(question?.question_text || '').trim(),
    question_type: questionType,
    options: questionType === 'mcq'
      ? (Array.isArray(question?.options) ? question.options.map((option) => String(option ?? '').trim()).filter(Boolean) : [])
      : (questionType === 'true_false' ? ['True', 'False'] : null),
    correct_answer: typeof question?.correct_answer === 'string'
      ? question.correct_answer.trim()
      : (question?.correct_answer ?? ''),
    marks
  };
};

const normalizeQuestions = (questions = []) => {
  const source = Array.isArray(questions) ? questions : [questions];

  return source
    .map(normalizeQuestion)
    .filter((question) => question.question_text);
};

const getLatestAttempt = async (quizId, studentId) => QuizAttempt.findOne({
  where: { quiz_id: quizId, student_id: studentId },
  order: [['started_at', 'DESC'], ['id', 'DESC']]
});

const createAttemptRecord = async (quizId, studentId) => {
  const inProgress = await QuizAttempt.findOne({
    where: { quiz_id: quizId, student_id: studentId, submitted_at: null },
    order: [['started_at', 'DESC'], ['id', 'DESC']]
  });
  if (inProgress) return inProgress;

  const submitted = await QuizAttempt.findOne({
    where: { quiz_id: quizId, student_id: studentId },
    order: [['submitted_at', 'DESC'], ['id', 'DESC']]
  });
  if (submitted?.submitted_at) {
    const err = new Error('You have already used your quiz attempt');
    err.status = 403;
    throw err;
  }

  const freshQuiz = await Quiz.findByPk(quizId);
  if (!freshQuiz) {
    const err = new Error('Quiz not found');
    err.status = 404;
    throw err;
  }

  const startedAt = new Date();
  let expiresAt = computeExpiresAtForAttempt(freshQuiz, startedAt);
  if (!expiresAt || expiresAt.getTime() <= startedAt.getTime()) {
    const { durationMinutes } = getQuizWindow(freshQuiz);
    expiresAt = new Date(startedAt.getTime() + durationMinutes * 60000);
  }

  return QuizAttempt.create({
    quiz_id: quizId,
    student_id: studentId,
    answers: {},
    score: null,
    submitted_at: null,
    started_at: startedAt,
    expires_at: expiresAt,
    status: 'in_progress'
  });
};

const serializeAttempt = (attempt) => {
  if (!attempt) return null;

  return {
    id: attempt.id,
    score: attempt.score === null || attempt.score === undefined ? null : Number(attempt.score),
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
    expires_at: attempt.expires_at,
    status: attempt.status || (attempt.submitted_at ? 'submitted' : 'in_progress')
  };
};

const attachStudentAttemptData = async (quizzes, studentId) => {
  const decoratedQuizzes = quizzes.map(decorateQuiz);
  if (!decoratedQuizzes.length) {
    return decoratedQuizzes;
  }

  const attempts = await QuizAttempt.findAll({
    where: {
      student_id: studentId,
      quiz_id: decoratedQuizzes.map((quiz) => quiz.id)
    },
    order: [['submitted_at', 'DESC'], ['started_at', 'DESC'], ['id', 'DESC']]
  });

  const latestByQuiz = new Map();
  attempts.forEach((attempt) => {
    if (!latestByQuiz.has(attempt.quiz_id)) {
      latestByQuiz.set(attempt.quiz_id, attempt);
    }
  });

  for (const quiz of decoratedQuizzes) {
    const attempt = latestByQuiz.get(quiz.id);
    if (attempt && !attempt.submitted_at && Date.now() >= getAttemptExpiry(attempt, quiz).getTime()) {
      await finalizeAttemptRecord(attempt, quiz, attempt.answers || {});
    }
    quiz.setDataValue('myAttempt', serializeAttempt(attempt || null));
  }

  return decoratedQuizzes;
};

// List quizzes visible to the current user
router.get('/', ...guard, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let courseIds = [];

    if (role === 'lecturer') {
      const courses = await Course.findAll({
        where: { lecturer_id: userId, is_active: true },
        attributes: ['id']
      });
      courseIds = courses.map((course) => course.id);
    } else if (role === 'student') {
      const enrollments = await Enrollment.findAll({
        where: { student_id: userId },
        attributes: ['course_id']
      });
      courseIds = enrollments.map((enrollment) => enrollment.course_id);
    }

    const where = role === 'admin' ? {} : { course_id: courseIds };
    if (role === 'student') {
      where.is_published = true;
    }

    const quizzes = await Quiz.findAll({ where, order: [['created_at', 'DESC']] });
    const payload = role === 'student'
      ? await attachStudentAttemptData(quizzes, userId)
      : quizzes.map(decorateQuiz);

    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get quizzes for a course
router.get('/course/:courseId', ...guard, authorizeCourseAccess(req => req.params.courseId), async (req, res) => {
  try {
    const where = { course_id: req.params.courseId };
    if (req.user.role === 'student') {
      where.is_published = true;
    }

    const quizzes = await Quiz.findAll({ where, order: [['created_at', 'DESC']] });
    const payload = req.user.role === 'student'
      ? await attachStudentAttemptData(quizzes, req.user.id)
      : quizzes.map(decorateQuiz);

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create quiz metadata as draft; questions can be added before publishing
router.post('/', ...guard, requireLecturer, authorizeCourseAccess(req => req.body.course_id, { managerOnly: true }), async (req, res) => {
  try {
    const course_id = req.body.course_id;
    const title = requireNonemptyTitle(req.body.title);
    const { questions } = req.body;
    const normalizedQuestions = normalizeQuestions(questions);
    const durationMinutes = totalDurationMinutesFromPayload(req.body);
    const { startTime } = getQuizWindow({ time_limit_minutes: durationMinutes }, req.body);

    const quiz = await Quiz.create({
      course_id,
      title,
      time_limit_minutes: durationMinutes,
      is_published: false,
      created_by: req.user.id
    });

    if (startTime) {
      await Quiz.sequelize.query(
        'UPDATE quizzes SET created_at = :startTime WHERE id = :id',
        { replacements: { id: quiz.id, startTime: toPgUtcTimestamp(startTime, 'start_time') } }
      );
      quiz.setDataValue('created_at', startTime);
    }

    if (normalizedQuestions.length) {
      await QuizQuestion.bulkCreate(normalizedQuestions.map(({ id, ...question }) => ({ ...question, quiz_id: quiz.id })));
    }

    quiz.setDataValue('status', 'draft');
    quiz.setDataValue('question_count', normalizedQuestions.length);
    res.status(201).json(decorateQuiz(quiz));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get quiz questions for safe student access and lecturer management
router.get('/:quizId/questions', ...guard,
  authorizeCourseAccess(async (req) => {
    const quiz = await Quiz.findByPk(req.params.quizId);
    if (!quiz) {
      const err = new Error('Quiz not found');
      err.status = 404;
      throw err;
    }
    req.quiz = quiz;
    return quiz.course_id;
  }),
  async (req, res) => {
    try {
      if (req.user.role === 'student' && !req.quiz.is_published) {
        return res.status(403).json({ error: 'This quiz is not available yet' });
      }

      const questions = await QuizQuestion.findAll({
        where: { quiz_id: req.quiz.id },
        order: [['id', 'ASC']]
      });

      if (req.user.role === 'student') {
        return res.json(questions.map((question) => {
          const payload = question.toJSON();
          delete payload.correct_answer;
          return payload;
        }));
      }

      res.json(questions);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Add or update questions on an existing quiz
router.post('/:quizId/questions', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const quiz = await Quiz.findByPk(req.params.quizId);
    if (!quiz) {
      const err = new Error('Quiz not found');
      err.status = 404;
      throw err;
    }
    req.quiz = quiz;
    return quiz.course_id;
  }, { managerOnly: true, managerMessage: 'Forbidden: only the assigned lecturer or admin can update this quiz' }),
  async (req, res) => {
    try {
      const quiz = req.quiz;
      const normalizedQuestions = normalizeQuestions(req.body?.questions ?? req.body);

      if (!normalizedQuestions.length) {
        return res.status(400).json({ error: 'Add at least one question before saving' });
      }

      let createdCount = 0;

      for (const question of normalizedQuestions) {
        const payload = {
          question_text: question.question_text,
          question_type: question.question_type,
          options: question.options,
          correct_answer: question.correct_answer,
          marks: question.marks,
          quiz_id: quiz.id
        };

        if (question.id) {
          const existingQuestion = await QuizQuestion.findOne({
            where: { id: question.id, quiz_id: quiz.id }
          });

          if (!existingQuestion) {
            return res.status(404).json({ error: `Question ${question.id} was not found for this quiz` });
          }

          await existingQuestion.update(payload);
        } else {
          createdCount += 1;
          await QuizQuestion.create(payload);
        }
      }

      const updatedQuiz = await Quiz.findByPk(quiz.id, {
        include: [{ model: QuizQuestion, separate: true, order: [['id', 'ASC']] }]
      });
      updatedQuiz.setDataValue('status', updatedQuiz.is_published ? 'published' : 'draft');
      updatedQuiz.setDataValue('question_count', updatedQuiz.QuizQuestions?.length || 0);

      res.status(createdCount > 0 ? 201 : 200).json(decorateQuiz(updatedQuiz));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Delete a quiz question
router.delete('/questions/:id', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const question = await QuizQuestion.findByPk(req.params.id);
    if (!question) {
      const err = new Error('Question not found');
      err.status = 404;
      throw err;
    }

    const quiz = await Quiz.findByPk(question.quiz_id);
    if (!quiz) {
      const err = new Error('Quiz not found');
      err.status = 404;
      throw err;
    }

    req.quiz = quiz;
    req.quizQuestion = question;
    return quiz.course_id;
  }, { managerOnly: true, managerMessage: 'Forbidden: only the assigned lecturer or admin can update this quiz' }),
  async (req, res) => {
    try {
      const totalQuestions = await QuizQuestion.count({ where: { quiz_id: req.quiz.id } });

      if (req.quiz.is_published && totalQuestions <= 1) {
        return res.status(400).json({ error: 'Published quizzes must keep at least one question' });
      }

      await req.quizQuestion.destroy();

      res.json({
        success: true,
        quiz_id: req.quiz.id,
        question_count: Math.max(0, totalQuestions - 1)
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Publish quiz
router.patch('/:id/publish', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const quiz = await Quiz.findByPk(req.params.id);
    if (!quiz) {
      const err = new Error('Quiz not found');
      err.status = 404;
      throw err;
    }
    req.quiz = quiz;
    return quiz.course_id;
  }, { managerOnly: true   }), async (req, res) => {
  try {
    const quiz = req.quiz;
    const questionCount = await QuizQuestion.count({ where: { quiz_id: quiz.id } });

    if (questionCount === 0) {
      return res.status(400).json({ error: 'Quiz must have at least one question before publishing' });
    }

    const questions = await QuizQuestion.findAll({
      where: { quiz_id: quiz.id },
      order: [['id', 'ASC']]
    });

    const integrity = validateQuizQuestionsForPublish(questions);
    if (!integrity.valid) {
      return res.status(400).json({
        error: 'Quiz cannot be published until all integrity checks pass.',
        validation_errors: integrity.errors
      });
    }

    const durationMinutes = totalDurationMinutesFromPayload({
      ...req.body,
      time_limit_minutes: req.body?.time_limit_minutes ?? quiz.time_limit_minutes
    });

    const { startTime } = getQuizWindow({ ...quiz.toJSON(), time_limit_minutes: durationMinutes }, {
      ...req.body,
      start_time: req.body?.start_time ?? req.body?.scheduled_at ?? new Date()
    });

    await quiz.update({
      is_published: true,
      time_limit_minutes: durationMinutes
    });

    await Quiz.sequelize.query(
      'UPDATE quizzes SET created_at = :startTime WHERE id = :id',
      { replacements: { id: quiz.id, startTime: toPgUtcTimestamp(startTime, 'start_time') } }
    );
    quiz.setDataValue('created_at', startTime);

    res.json(decorateQuiz(quiz));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// List quiz participants and their scores for lecturers/admins
router.get('/:id/participants', ...guard, requireLecturer,
  authorizeCourseAccess(async (req) => {
    const quiz = await Quiz.findByPk(req.params.id);
    if (!quiz) {
      const err = new Error('Quiz not found');
      err.status = 404;
      throw err;
    }
    return quiz.course_id;
  }, { managerOnly: true }), async (req, res) => {
  try {
    const attempts = await QuizAttempt.findAll({
      where: { quiz_id: req.params.id },
      include: [{ model: User, as: 'student', attributes: ['id', 'full_name', 'email', 'student_id'] }],
      order: [['submitted_at', 'DESC'], ['started_at', 'DESC']]
    });

    res.json(attempts.map((attempt) => ({
      id: attempt.id,
      score: attempt.score,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      expires_at: attempt.expires_at,
      status: attempt.status,
      student: attempt.student ? {
        id: attempt.student.id,
        full_name: attempt.student.full_name,
        email: attempt.student.email,
        student_id: attempt.student.student_id
      } : null
    })));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Autosave in-progress answers (does not submit or grade)
router.put('/:id/attempt', ...guard, requireStudent,
  authorizeCourseAccess(async (req) => {
    const quiz = await Quiz.findByPk(req.params.id, { include: [QuizQuestion] });
    if (!quiz) {
      const err = new Error('Quiz not found');
      err.status = 404;
      throw err;
    }
    req.quiz = quiz;
    return quiz.course_id;
  }), async (req, res) => {
  try {
    const quiz = decorateQuiz(req.quiz);
    if (!quiz.is_published) {
      return res.status(403).json({ error: 'This quiz is not available yet' });
    }

    let attempt = await getLatestAttempt(quiz.id, req.user.id);
    if (!attempt || attempt.submitted_at) {
      return res.status(403).json({ error: 'No active quiz attempt to save' });
    }

    if (isAttemptTimeExpired(attempt, quiz)) {
      const incomingExpired = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
      const mergedExpired = { ...(attempt.answers || {}), ...incomingExpired };
      const result = await finalizeAttemptRecord(attempt, quiz, mergedExpired);
      await attempt.reload();
      return res.status(403).json({
        error: 'Quiz time has expired; your attempt was submitted automatically.',
        attempt_id: attempt.id,
        submitted_at: attempt.submitted_at,
        auto_submitted: true,
        ...formatGradingPayload(result)
      });
    }

    ensureQuizWindowOpen(quiz);

    const incoming = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const merged = { ...(attempt.answers || {}), ...incoming };
    await attempt.update({ answers: merged });

    const expiresAt = attempt.expires_at || getAttemptExpiry(attempt, quiz);
    const remainingMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());

    res.json({
      saved: true,
      attempt: serializeAttempt(attempt),
      server_time: new Date().toISOString(),
      attempt_expires_at: expiresAt,
      seconds_remaining: Math.floor(remainingMs / 1000)
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get quiz with questions and create attempt record when student opens it
router.get('/:id', ...guard,
  authorizeCourseAccess(async (req) => {
    const quiz = await Quiz.findByPk(req.params.id, { include: [QuizQuestion] });
    if (!quiz) {
      const err = new Error('Quiz not found');
      err.status = 404;
      throw err;
    }
    req.quiz = quiz;
    return quiz.course_id;
  }), async (req, res) => {
  try {
    const quiz = decorateQuiz(req.quiz);
    const isStudent = req.user.role === 'student';

    if (!quiz.is_published && isStudent) {
      return res.status(403).json({ error: 'This quiz is not available yet' });
    }

    if (isStudent && (!Array.isArray(quiz.QuizQuestions) || quiz.QuizQuestions.length === 0)) {
      return res.status(403).json({ error: 'This quiz is not available yet' });
    }

    if (isStudent) {
      let attempt = await getLatestAttempt(quiz.id, req.user.id);
      if (attempt?.submitted_at) {
        const grading = gradeQuizAttempt(quiz, attempt.answers || {});
        return res.status(403).json({
          error: 'You have already used your quiz attempt',
          attempt_id: attempt.id,
          submitted_at: attempt.submitted_at,
          ...formatGradingPayload({ grading })
        });
      }

      if (attempt && Date.now() >= getAttemptExpiry(attempt, quiz).getTime()) {
        const result = await finalizeAttemptRecord(attempt, quiz, attempt.answers || {});
        await attempt.reload();
        return res.status(403).json({
          error: 'Quiz time expired and your attempt was auto-submitted',
          attempt_id: attempt.id,
          submitted_at: attempt.submitted_at,
          auto_submitted: true,
          ...formatGradingPayload(result)
        });
      }

      ensureQuizWindowOpen(quiz);

      if (!attempt) {
        attempt = await createAttemptRecord(quiz.id, req.user.id);
      } else if (!attempt.expires_at) {
        const expiresAt = getAttemptExpiry(attempt, quiz);
        await attempt.update({ expires_at: expiresAt });
      }

      const expiresAt = attempt.expires_at || getAttemptExpiry(attempt, quiz);
      if (Date.now() >= new Date(expiresAt).getTime()) {
        const result = await finalizeAttemptRecord(attempt, quiz, attempt.answers || {});
        await attempt.reload();
        return res.status(403).json({
          error: 'Quiz time expired and your attempt was auto-submitted',
          attempt_id: attempt.id,
          submitted_at: attempt.submitted_at,
          auto_submitted: true,
          ...formatGradingPayload(result)
        });
      }

      quiz.setDataValue('attempt_id', attempt.id);
      quiz.setDataValue('attempt_started_at', attempt.started_at);
      quiz.setDataValue('attempt_expires_at', expiresAt);
      quiz.setDataValue('attempt_status', attempt.status || 'in_progress');
      quiz.setDataValue('attempt_answers', attempt.answers || {});
      quiz.setDataValue('server_time', new Date().toISOString());
      const rem = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      quiz.setDataValue('seconds_remaining', Math.floor(rem / 1000));
      quiz.QuizQuestions.forEach((q) => { q.correct_answer = undefined; });
    }

    res.json(quiz);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Submit quiz attempt (one attempt only, auto-graded immediately)
router.post('/:id/attempt', ...guard, requireStudent,
  authorizeCourseAccess(async (req) => {
    const quiz = await Quiz.findByPk(req.params.id, { include: [QuizQuestion] });
    if (!quiz) {
      const err = new Error('Quiz not available');
      err.status = 404;
      throw err;
    }
    req.quiz = quiz;
    return quiz.course_id;
  }), async (req, res) => {
  try {
    const quiz = decorateQuiz(req.quiz);

    if (!Array.isArray(quiz.QuizQuestions) || quiz.QuizQuestions.length === 0) {
      return res.status(400).json({ error: 'This quiz has no questions' });
    }

    if (!quiz.is_published) {
      return res.status(403).json({ error: 'This quiz is not available yet' });
    }

    let attempt = await getLatestAttempt(req.params.id, req.user.id);
    if (attempt?.submitted_at) {
      return res.status(403).json({
        error: 'You have already used your quiz attempt',
        attempt_id: attempt.id,
        submitted_at: attempt.submitted_at,
        ...formatGradingPayload({ grading: gradeQuizAttempt(quiz, attempt.answers || {}) })
      });
    }

    if (!attempt) {
      ensureQuizWindowOpen(quiz);
      attempt = await createAttemptRecord(req.params.id, req.user.id);
    }

    if (isAttemptTimeExpired(attempt, quiz)) {
      const mergedEarly = { ...(attempt.answers || {}), ...(req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {}) };
      const result = await finalizeAttemptRecord(attempt, quiz, mergedEarly);
      await attempt.reload();
      return res.status(403).json({
        error: 'Quiz time expired and your attempt was auto-submitted',
        attempt: serializeAttempt(attempt),
        auto_submitted: true,
        ...formatGradingPayload(result)
      });
    }

    let submittedAnswers;
    try {
      submittedAnswers = filterAnswersForQuiz(req.body?.answers, quiz.QuizQuestions);
    } catch (validationErr) {
      return res.status(validationErr.status || 400).json({ error: validationErr.message });
    }

    if (isAttemptTimeExpired(attempt, quiz)) {
      const result = await finalizeAttemptRecord(attempt, quiz, submittedAnswers);
      await attempt.reload();
      return res.status(403).json({
        error: 'Quiz time expired and your attempt was auto-submitted',
        attempt: serializeAttempt(attempt),
        auto_submitted: true,
        ...formatGradingPayload(result)
      });
    }

    const result = await finalizeAttemptRecord(attempt, quiz, submittedAnswers);
    await attempt.reload();

    res.status(201).json({
      attempt: serializeAttempt(attempt),
      auto_graded: true,
      status: result.status,
      ...formatGradingPayload(result)
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
