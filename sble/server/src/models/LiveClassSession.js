const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LiveClassSession = sequelize.define('LiveClassSession', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  room_id: { type: DataTypes.INTEGER, allowNull: false },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  started_at: { type: DataTypes.DATE, allowNull: false },
  ended_at: { type: DataTypes.DATE, allowNull: true },
  summary_json: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'live_class_sessions',
  timestamps: false
});

module.exports = LiveClassSession;
