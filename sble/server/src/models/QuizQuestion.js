const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuizQuestion = sequelize.define('QuizQuestion', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  quiz_id: { type: DataTypes.INTEGER, allowNull: false },
  question_text: { type: DataTypes.TEXT, allowNull: false },
  question_type: { type: DataTypes.ENUM('mcq', 'true_false', 'short_answer'), allowNull: false },
  options: { type: DataTypes.JSON },
  correct_answer: { type: DataTypes.TEXT },
  marks: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName: 'quiz_questions', timestamps: false });

module.exports = QuizQuestion;
