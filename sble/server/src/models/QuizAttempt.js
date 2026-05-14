const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuizAttempt = sequelize.define('QuizAttempt', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  quiz_id: { type: DataTypes.INTEGER, allowNull: false },
  student_id: { type: DataTypes.STRING(36), allowNull: false },
  answers: { type: DataTypes.JSON },
  score: { type: DataTypes.DECIMAL(5, 2) },
  submitted_at: { type: DataTypes.DATE },
  expires_at: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'in_progress' }
}, { tableName: 'quiz_attempts', timestamps: true, createdAt: 'started_at', updatedAt: false });

module.exports = QuizAttempt;
