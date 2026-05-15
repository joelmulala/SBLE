const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CalendarCustomEvent = sequelize.define('CalendarCustomEvent', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  author_id: { type: DataTypes.STRING(36), allowNull: false },
  event_type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'office_hours' },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  starts_at: { type: DataTypes.DATE, allowNull: false },
  ends_at: { type: DataTypes.DATE },
  is_published: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'calendar_custom_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CalendarCustomEvent;
