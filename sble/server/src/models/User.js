const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.STRING(36), primaryKey: true }, // Keycloak UUID
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  full_name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('student', 'lecturer', 'admin'), defaultValue: 'student' },
  student_id: { type: DataTypes.STRING(50), allowNull: true, unique: true },
  program: { type: DataTypes.STRING(255), allowNull: true },
  year_of_study: { type: DataTypes.INTEGER, allowNull: true },
  semester: { type: DataTypes.INTEGER, allowNull: true },
  mode: { type: DataTypes.ENUM('Full-time', 'Evening', 'ODL'), allowNull: true },
  institution: { type: DataTypes.STRING(255), allowNull: true },
  staff_email: { type: DataTypes.STRING, allowNull: true, unique: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = User;
