const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.STRING(36) },
  action: { type: DataTypes.STRING, allowNull: false },
  resource_type: { type: DataTypes.STRING(100) },
  resource_id: { type: DataTypes.STRING(100) },
  ip_address: { type: DataTypes.STRING(45) }
}, { tableName: 'audit_logs', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = AuditLog;
