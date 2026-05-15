/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { execSync } = require('child_process');
const path = require('path');

const user = process.env.DB_USER || 'postgres';
const db = process.env.DB_NAME || 'sble';
const sqlPath = path.join(__dirname, '..', 'db', 'demo-seed.sql');

try {
  execSync(`psql -U "${user}" -d "${db}" -f "${sqlPath}"`, { stdio: 'inherit', shell: true });
  console.log('[seed:demo] Demo lecturer, student, and sample course ready.');
} catch (err) {
  console.error('[seed:demo] Failed. Ensure PostgreSQL is running and schema is initialized.');
  process.exit(1);
}
