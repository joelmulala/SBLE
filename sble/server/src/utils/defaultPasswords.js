/**
 * Institutional default passwords from environment (admin-provisioned accounts).
 */
const getDefaultPasswordForRole = (role) => {
  if (role === 'admin') return process.env.TEMP_ADMIN_PASSWORD || null;
  if (role === 'lecturer') return process.env.TEMP_LECTURER_PASSWORD || null;
  if (role === 'student') return process.env.TEMP_STUDENT_PASSWORD || null;
  return null;
};

const getDefaultPasswordMap = () => ({
  admin: process.env.TEMP_ADMIN_PASSWORD,
  lecturer: process.env.TEMP_LECTURER_PASSWORD,
  student: process.env.TEMP_STUDENT_PASSWORD
});

module.exports = {
  getDefaultPasswordForRole,
  getDefaultPasswordMap
};
