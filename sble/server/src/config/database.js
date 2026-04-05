const { Sequelize } = require('sequelize');

const dialect = process.env.DB_DIALECT || 'postgres';
const defaultPort = dialect === 'postgres' ? 5432 : 3306;

const sequelize = new Sequelize(
  process.env.DB_NAME || 'sble',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || defaultPort),
    dialect,
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions:
      dialect === 'postgres' && process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {}
  }
);

module.exports = sequelize;
