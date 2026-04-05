const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Course = sequelize.define('Course', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  lecturer_id: { type: DataTypes.STRING(36), allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'courses', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = Course;
