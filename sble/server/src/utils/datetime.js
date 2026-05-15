/**
 * Consistent date handling for Postgres TIMESTAMP columns (no timezone).
 * Always persist JavaScript Date values via Sequelize — never local date strings.
 */

const parseDbDate = (value, fieldName = 'date') => {
  if (value === undefined || value === null || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      const err = new Error(`${fieldName} must be a valid date/time`);
      err.status = 400;
      throw err;
    }
    return value;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    const asLocal = new Date(raw.replace(' ', 'T'));
    if (!Number.isNaN(asLocal.getTime())) return asLocal;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`${fieldName} must be a valid date/time`);
    err.status = 400;
    throw err;
  }

  return date;
};

const toSequelizeDate = (value, fieldName = 'date') => parseDbDate(value, fieldName);

/** UTC wall-clock string for Postgres TIMESTAMP WITHOUT TIME ZONE columns */
const toPgUtcTimestamp = (value, fieldName = 'date') => {
  const date = parseDbDate(value, fieldName);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

module.exports = {
  parseDbDate,
  toSequelizeDate,
  toPgUtcTimestamp
};
