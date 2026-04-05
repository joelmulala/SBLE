const cron = require('node-cron');
const { Op } = require('sequelize');
const { QuizAttempt, Quiz } = require('../../models');
const logger = require('../../config/logger');

/**
 * Runs every minute — auto-submits quiz attempts that have exceeded their time limit.
 */
const initQuizTimer = () => {
  cron.schedule('* * * * *', async () => {
    try {
      // Find open attempts (no submitted_at) with an expired time limit
      const openAttempts = await QuizAttempt.findAll({
        where: { submitted_at: null },
        include: [{ model: Quiz, attributes: ['time_limit_minutes'] }]
      });

      for (const attempt of openAttempts) {
        const limitMs = (attempt.Quiz?.time_limit_minutes || 30) * 60 * 1000;
        const elapsed = Date.now() - new Date(attempt.started_at).getTime();

        if (elapsed >= limitMs) {
          await attempt.update({ submitted_at: new Date() });
          logger.info(`Auto-submitted quiz attempt ${attempt.id} (time limit exceeded)`);
        }
      }
    } catch (err) {
      logger.error('Quiz timer error:', err.message);
    }
  });

  logger.info('Quiz timer scheduler initialized');
};

module.exports = initQuizTimer;
