const router = require('express').Router();
const keycloak = require('../config/keycloak');
const { attachUser, requireLecturer, requireStudent, authorizeCourseAccess } = require('../middleware/auth');
const { Quiz, QuizQuestion, QuizAttempt } = require('../models');

const guard = [keycloak.protect(), attachUser];

// Get quizzes for a course
router.get('/course/:courseId', ...guard, authorizeCourseAccess(req => req.params.courseId), async (req, res) => {
  try {
    const quizzes = await Quiz.findAll({ where: { course_id: req.params.courseId } });
    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create quiz
router.post('/', ...guard, requireLecturer, authorizeCourseAccess(req => req.body.course_id, { managerOnly: true }), async (req, res) => {
  try {
    const { course_id, title, time_limit_minutes, questions } = req.body;
    const quiz = await Quiz.create({ course_id, title, time_limit_minutes, created_by: req.user.id });

    if (questions?.length) {
      await QuizQuestion.bulkCreate(questions.map(q => ({ ...q, quiz_id: quiz.id })));
    }

    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  }, { managerOnly: true }), async (req, res) => {
  try {
    const quiz = req.quiz;
    await quiz.update({ is_published: true });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get quiz with questions (students only see published)
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
    const quiz = req.quiz;
    if (!quiz.is_published && req.user.role !== 'lecturer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Quiz not yet published' });
    }
    // Hide correct answers from students
    if (req.user.role === 'student') {
      quiz.QuizQuestions.forEach(q => { q.correct_answer = undefined; });
    }
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit quiz attempt
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
    const { answers } = req.body;
    const quiz = req.quiz;
    if (!quiz.is_published) return res.status(404).json({ error: 'Quiz not available' });

    // Auto-grade MCQ and true/false
    let score = 0;
    quiz.QuizQuestions.forEach(q => {
      if (['mcq', 'true_false'].includes(q.question_type)) {
        if (answers[q.id] === q.correct_answer) score += q.marks;
      }
    });

    const attempt = await QuizAttempt.create({
      quiz_id: req.params.id,
      student_id: req.user.id,
      answers,
      score,
      submitted_at: new Date()
    });

    res.status(201).json({ attempt, score });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
