const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CourseModule = sequelize.define('CourseModule', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_published: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'course_modules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CourseModule;
