/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/models');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

const ensureMigrationsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const listMigrationFiles = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
};

const getAppliedMigrations = async () => {
  const [rows] = await sequelize.query('SELECT name FROM schema_migrations ORDER BY name ASC;');
  return new Set(rows.map((row) => row.name));
};

const applyMigration = async (fileName) => {
  const filePath = path.join(MIGRATIONS_DIR, fileName);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`[migrate] Applying ${fileName}...`);

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(sql, { transaction });
    await sequelize.query(
      'INSERT INTO schema_migrations (name) VALUES (:name) ON CONFLICT (name) DO NOTHING;',
      { replacements: { name: fileName }, transaction }
    );
  });

  console.log(`[migrate] Applied ${fileName}`);
};

const run = async () => {
  await sequelize.authenticate();
  await ensureMigrationsTable();

  const files = listMigrationFiles();
  const applied = await getAppliedMigrations();
  const pending = files.filter((file) => !applied.has(file));

  if (!pending.length) {
    console.log('[migrate] No pending migrations.');
    return;
  }

  for (const file of pending) {
    await applyMigration(file);
  }

  console.log(`[migrate] Done. Applied ${pending.length} migration(s).`);
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`[migrate] Failed: ${err.message}`);
    process.exit(1);
  });
