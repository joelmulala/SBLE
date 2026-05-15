const { Sequelize } = require('sequelize');
const pg = require('pg');
const logger = require('./logger');

// Postgres TIMESTAMP (no time zone) is stored as UTC wall time; parse as UTC on read.
pg.types.setTypeParser(1114, (value) => {
  if (value === null) return null;
  return new Date(`${String(value).trim().replace(' ', 'T')}Z`);
});

const dialect = process.env.DB_DIALECT || 'postgres';
const defaultPort = dialect === 'postgres' ? 5432 : 3306;
const dbPort = Number(process.env.DB_PORT || defaultPort);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: dbPort,
  dialect,
  // TIMESTAMP WITHOUT TIME ZONE columns are stored/read as UTC consistently
  timezone: '+00:00',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
    evict: 1000
  },
  dialectOptions:
    dialect === 'postgres'
      ? {
          keepAlive: true,
          ssl: process.env.DB_SSL === 'true'
            ? { require: true, rejectUnauthorized: false }
            : undefined
        }
      : {}
};

const sequelize = new Sequelize(
  process.env.DB_NAME || 'sble',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  dbConfig
);

sequelize.addHook('afterConnect', () => {
  logger.info(`Database connection established (${dialect}://${dbConfig.host}:${dbConfig.port})`);
});

module.exports = sequelize;
