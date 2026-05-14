const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Submission = sequelize.define('Submission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  assignment_id: { type: DataTypes.INTEGER, allowNull: false },
  student_id: { type: DataTypes.STRING(36), allowNull: false },
  file_path: { type: DataTypes.STRING(500) },
  file_name: { type: DataTypes.STRING },
  submission_type: { type: DataTypes.ENUM('typed', 'scanned', 'handwritten'), defaultValue: 'typed' },
  grade: { type: DataTypes.DECIMAL(5, 2) },
  feedback: { type: DataTypes.TEXT },
  results_published_at: { type: DataTypes.DATE, allowNull: true },
  grading_status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
  last_updated_time: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'submissions', timestamps: true, createdAt: 'submitted_at', updatedAt: 'last_updated_time' });

module.exports = Submission;
