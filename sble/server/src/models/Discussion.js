const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Discussion = sequelize.define('Discussion', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.STRING(36), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false }
}, { tableName: 'discussions', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = Discussion;
