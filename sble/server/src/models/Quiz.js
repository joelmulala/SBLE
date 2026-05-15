const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Quiz = sequelize.define('Quiz', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  time_limit_minutes: { type: DataTypes.INTEGER, defaultValue: 30 },
  is_published: { type: DataTypes.BOOLEAN, defaultValue: false },
  created_by: { type: DataTypes.STRING(36), allowNull: false },
  module_id: { type: DataTypes.INTEGER, allowNull: true },
  module_sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'quizzes', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = Quiz;
