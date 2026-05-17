const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExamStudentAccess = sequelize.define('ExamStudentAccess', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  exam_id: { type: DataTypes.INTEGER, allowNull: false },
  student_id: { type: DataTypes.STRING(36), allowNull: false },
  accessed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'exam_student_access',
  timestamps: true,
  createdAt: 'accessed_at',
  updatedAt: false
});

module.exports = ExamStudentAccess;
