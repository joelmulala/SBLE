const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LiveClassAttendance = sequelize.define('LiveClassAttendance', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  session_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.STRING(36), allowNull: false },
  role: { type: DataTypes.STRING(20), allowNull: false },
  enrollment_id: { type: DataTypes.INTEGER, allowNull: true },
  first_joined_at: { type: DataTypes.DATE, allowNull: false },
  last_ping_at: { type: DataTypes.DATE, allowNull: true },
  last_left_at: { type: DataTypes.DATE, allowNull: true },
  cumulative_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  participation_json: { type: DataTypes.TEXT, allowNull: true },
  computed_status: { type: DataTypes.STRING(40), allowNull: true }
}, {
  tableName: 'live_class_attendance',
  timestamps: false
});

module.exports = LiveClassAttendance;
