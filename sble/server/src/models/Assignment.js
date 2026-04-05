const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Assignment = sequelize.define('Assignment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  due_date: { type: DataTypes.DATE },
  allows_handwritten: { type: DataTypes.BOOLEAN, defaultValue: true },
  created_by: { type: DataTypes.STRING(36), allowNull: false }
}, { tableName: 'assignments', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = Assignment;
