const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getPasswordStrength(password) {
  const value = String(password || '');
  const checks = [
    { key: 'length', label: 'At least 8 characters', met: value.length >= 8 },
    { key: 'lower', label: 'Lowercase letter', met: /[a-z]/.test(value) },
    { key: 'upper', label: 'Uppercase letter', met: /[A-Z]/.test(value) },
    { key: 'number', label: 'Number', met: /[0-9]/.test(value) }
  ];
  const metCount = checks.filter((c) => c.met).length;
  const score = metCount === 0 ? 0 : metCount <= 2 ? 1 : metCount === 3 ? 2 : 3;
  const labels = ['', 'Weak', 'Fair', 'Strong'];
  return {
    checks,
    score,
    label: labels[score],
    valid: metCount === 4
  };
}

export function validateStudentForm(form) {
  if (!form.full_name?.trim()) return 'Full name is required';
  if (!form.student_id?.trim()) return 'Student ID is required';
  if (!emailPattern.test(form.email?.trim())) return 'Enter a valid email address';
  const strength = getPasswordStrength(form.password);
  if (!strength.valid) return 'Password does not meet security requirements';
  if (form.password !== form.confirmPassword) return 'Passwords do not match';
  if (!form.program?.trim()) return 'Programme is required';
  if (!form.year_of_study) return 'Academic year is required';
  if (!form.mode) return 'Study mode is required';
  return '';
}

export function validateLecturerForm(form) {
  if (!form.full_name?.trim()) return 'Full name is required';
  if (!form.lecturer_id?.trim()) return 'Lecturer ID is required';
  if (!emailPattern.test(form.email?.trim())) return 'Enter a valid email address';
  if (!form.department?.trim()) return 'Department is required';
  const strength = getPasswordStrength(form.password);
  if (!strength.valid) return 'Password does not meet security requirements';
  if (form.password !== form.confirmPassword) return 'Passwords do not match';
  return '';
}
