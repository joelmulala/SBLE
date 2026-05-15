const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exam = sequelize.define('Exam', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  file_path: { type: DataTypes.STRING(500) },
  scheduled_at: { type: DataTypes.DATE },
  duration_minutes: { type: DataTypes.INTEGER, defaultValue: 120 },
  is_released: { type: DataTypes.BOOLEAN, defaultValue: false },
  created_by: { type: DataTypes.STRING(36), allowNull: false },
  module_id: { type: DataTypes.INTEGER, allowNull: true },
  module_sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'exams', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = Exam;
