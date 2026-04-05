const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.STRING(36), primaryKey: true }, // Keycloak UUID
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  full_name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('student', 'lecturer', 'admin'), defaultValue: 'student' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = User;
