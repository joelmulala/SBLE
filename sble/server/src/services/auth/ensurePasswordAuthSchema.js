const { sequelize } = require('../../models');
const logger = require('../../config/logger');

async function ensurePasswordAuthSchema() {
  try {
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(64)`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP`);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash
      ON users (password_reset_token_hash)
      WHERE password_reset_token_hash IS NOT NULL
    `);

    logger.info('Password auth schema ready (password_hash, reset tokens, token_version)');
  } catch (err) {
    logger.warn(`Password auth schema ensure skipped: ${err.message}`);
  }
}

module.exports = { ensurePasswordAuthSchema };
