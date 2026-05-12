const { Sequelize } = require('sequelize');
const logger = require('./logger');

const dialect = process.env.DB_DIALECT || 'postgres';
const defaultPort = dialect === 'postgres' ? 5432 : 3306;
const dbPort = Number(process.env.DB_PORT || defaultPort);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: dbPort,
  dialect,
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
