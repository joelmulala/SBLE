const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Enrollment = sequelize.define('Enrollment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  student_id: { type: DataTypes.STRING(36), allowNull: false }
}, { tableName: 'enrollments', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = Enrollment;
