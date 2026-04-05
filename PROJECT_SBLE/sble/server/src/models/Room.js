const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Room = sequelize.define('Room', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  room_token: { type: DataTypes.STRING(255), unique: true, allowNull: false },
  created_by: { type: DataTypes.STRING(36), allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'rooms', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = Room;
