const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Material = sequelize.define('Material', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  file_path: { type: DataTypes.STRING(500), allowNull: false },
  file_name: { type: DataTypes.STRING, allowNull: false },
  file_type: { type: DataTypes.STRING(100) },
  is_encrypted: { type: DataTypes.BOOLEAN, defaultValue: true },
  uploaded_by: { type: DataTypes.STRING(36), allowNull: false }
}, { tableName: 'materials', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = Material;
