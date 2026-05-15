const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CourseModuleItem = sequelize.define('CourseModuleItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  module_id: { type: DataTypes.INTEGER, allowNull: false },
  item_type: { type: DataTypes.STRING(32), allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  link_url: { type: DataTypes.STRING(500) },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'course_module_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = CourseModuleItem;
