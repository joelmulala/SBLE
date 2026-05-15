const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Announcement = sequelize.define('Announcement', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  author_id: { type: DataTypes.STRING(36), allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  is_pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  link_url: { type: DataTypes.STRING(500), allowNull: true },
  attachment_name: { type: DataTypes.STRING(255), allowNull: true },
  attachment_path: { type: DataTypes.STRING(500), allowNull: true },
  publish_at: { type: DataTypes.DATE, allowNull: true },
  is_hidden: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  tableName: 'announcements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Announcement;
