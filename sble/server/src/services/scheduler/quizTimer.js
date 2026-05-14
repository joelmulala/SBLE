const cron = require('node-cron');
const { Op } = require('sequelize');
const { QuizAttempt, Quiz, QuizQuestion } = require('../../models');
const logger = require('../../config/logger');
const { finalizeAttempt: finalizeAttemptRecord } = require('../assessment/quizAssessmentService');

/**
 * Runs every minute — auto-submits and grades quiz attempts past expires_at (or legacy time limit).
 */
const initQuizTimer = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const openAttempts = await QuizAttempt.findAll({
        where: { submitted_at: { [Op.is]: null } },
        include: [{
          model: Quiz,
          attributes: ['id', 'time_limit_minutes', 'created_at', 'is_published'],
          include: [{ model: QuizQuestion, separate: true, order: [['id', 'ASC']] }]
        }]
      });

      for (const attempt of openAttempts) {
        const quiz = attempt.Quiz;
        if (!quiz?.is_published) continue;

        const expiresAt = attempt.expires_at
          ? new Date(attempt.expires_at).getTime()
          : null;
        const legacyLimitMs = (quiz.time_limit_minutes || 30) * 60 * 1000;
        const legacyExpiry = new Date(new Date(attempt.started_at).getTime() + legacyLimitMs).getTime();

        const expired = expiresAt != null ? now.getTime() >= expiresAt : now.getTime() >= legacyExpiry;
        if (!expired) continue;

        try {
          await finalizeAttemptRecord(attempt, quiz, attempt.answers || {});
          logger.info(`Auto-submitted quiz attempt ${attempt.id} (deadline exceeded)`);
        } catch (e) {
          logger.error(`Failed to auto-submit attempt ${attempt.id}: ${e.message}`);
        }
      }
    } catch (err) {
      logger.error('Quiz timer error:', err.message);
    }
  });

  logger.info('Quiz timer scheduler initialized');
};

module.exports = initQuizTimer;
