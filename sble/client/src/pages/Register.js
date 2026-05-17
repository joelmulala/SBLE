import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import {
  AuthLayout,
  AuthField,
  AuthButton,
  AuthAlert,
  AuthActions,
  AuthFooterLink,
  AuthForm,
  AuthSelect,
  AuthSuccessPanel
} from '../components/auth/AuthShell';
import {
  RegisterStepIndicator,
  RegisterRoleStep,
  AuthFieldGroup,
  AuthPasswordStrength,
  AuthPhotoUpload
} from '../components/auth/register/RegisterComponents';
import {
  IconMail,
  IconLock,
  IconUser,
  IconIdBadge,
  IconBook,
  IconBuilding
} from '../components/auth/AuthIcons';
import {
  validateStudentForm,
  validateLecturerForm
} from '../utils/registerValidation';
import styles from '../components/auth/AuthLayout.module.css';

const emptyStudent = {
  full_name: '',
  student_id: '',
  email: '',
  password: '',
  confirmPassword: '',
  program: '',
  year_of_study: '',
  mode: 'Full-time'
};

const emptyLecturer = {
  full_name: '',
  lecturer_id: '',
  email: '',
  department: '',
  password: '',
  confirmPassword: ''
};

export default function Register() {
  const navigate = useNavigate();
  const { keycloak, initialized } = useKeycloak();
  const [step, setStep] = useState('role');
  const [role, setRole] = useState(null);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [lecturerForm, setLecturerForm] = useState(emptyLecturer);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');

  const isStudent = role === 'student';
  const form = isStudent ? studentForm : lecturerForm;

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  if (initialized && keycloak.authenticated) {
    return <Navigate to="/" replace />;
  }

  const updateStudent = (field, value) => {
    setStudentForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLecturer = (field, value) => {
    setLecturerForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRoleSelect = (nextRole) => {
    setRole(nextRole);
    setError('');
    setStep('form');
  };

  const handleBack = () => {
    setError('');
    setStep('role');
  };

  const handlePhotoChange = (file, preview) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(preview);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = isStudent
      ? validateStudentForm(studentForm)
      : validateLecturerForm(lecturerForm);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = isStudent
        ? {
            role: 'student',
            full_name: studentForm.full_name.trim(),
            email: studentForm.email.trim(),
            password: studentForm.password,
            student_id: studentForm.student_id.trim(),
            programme: studentForm.program.trim(),
            academic_year: Number(studentForm.year_of_study),
            mode: studentForm.mode,
            semester: 1
          }
        : {
            role: 'lecturer',
            full_name: lecturerForm.full_name.trim(),
            email: lecturerForm.email.trim(),
            password: lecturerForm.password,
            lecturer_id: lecturerForm.lecturer_id.trim(),
            department: lecturerForm.department.trim()
          };

      await api.post('/auth/register', payload);

      if (photoFile) {
        try {
          sessionStorage.setItem(
            'sble_pending_profile_photo',
            JSON.stringify({ email: payload.email, savedAt: Date.now() })
          );
        } catch (_) { /* optional client hint only */ }
      }

      setCreatedEmail(payload.email);
      setStep('success');
    } catch (err) {
      setError(err.userMessage || err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const layoutTitle = step === 'role'
    ? 'Create your account'
    : step === 'success'
      ? 'Welcome to SBLE'
      : isStudent
        ? 'Student registration'
        : 'Lecturer registration';

  const layoutSubtitle = step === 'role'
    ? 'Choose your role to begin institutional onboarding.'
    : step === 'success'
      ? 'Your account has been created successfully.'
      : isStudent
        ? 'Enter your academic details to access courses and live classes.'
        : 'Enter your teaching credentials to manage courses and sessions.';

  const visualCaption = step === 'success'
    ? (
      <>
        <p>You are ready to sign in</p>
        <span>Access your blended learning workspace with your new credentials.</span>
      </>
    )
    : (
      <>
        <p>Institutional onboarding</p>
        <span>Structured registration for students and teaching staff.</span>
      </>
    );

  return (
    <AuthLayout
      title={layoutTitle}
      subtitle={layoutSubtitle}
      visualCaption={visualCaption}
    >
      <div className={styles.formInnerWide}>
        <RegisterStepIndicator step={step} />

        {step === 'role' && (
          <RegisterRoleStep onSelect={handleRoleSelect} />
        )}

        {step === 'success' && (
          <div className={styles.form}>
            <AuthSuccessPanel title="Account created">
              Your
              {' '}
              {isStudent ? 'student' : 'lecturer'}
              {' '}
              account is ready. Sign in with
              {' '}
              <strong>{createdEmail}</strong>
              {' '}
              to access your workspace.
            </AuthSuccessPanel>
            {photoFile ? (
              <AuthAlert type="info">
                Your profile photo will be available to upload from your account settings after sign-in.
              </AuthAlert>
            ) : null}
            <AuthButton
              type="button"
              onClick={() => navigate('/login', { replace: true, state: { registered: true } })}
            >
              Continue to sign in
            </AuthButton>
            <AuthActions>
              <AuthFooterLink to="/forgot-password" variant="secondary">
                Forgot password?
              </AuthFooterLink>
            </AuthActions>
          </div>
        )}

        {step === 'form' && role && (
          <>
            <button type="button" className={styles.backLink} onClick={handleBack}>
              ← Change account type
            </button>
            <span className={styles.roleBadge} data-role={role}>
              {isStudent ? 'Student' : 'Lecturer'}
            </span>

            <AuthForm onSubmit={handleSubmit} loading={submitting} aria-label="Registration details">
              <AuthFieldGroup
                title="Personal information"
                description="Use your official institutional name and ID."
              >
                <AuthField
                  id="reg-name"
                  label="Full name"
                  type="text"
                  icon={IconUser}
                  autoComplete="name"
                  placeholder="As on your institutional records"
                  value={form.full_name}
                  onChange={(e) => (isStudent
                    ? updateStudent('full_name', e.target.value)
                    : updateLecturer('full_name', e.target.value))}
                  required
                  disabled={submitting}
                />
                <AuthField
                  id="reg-id"
                  label={isStudent ? 'Student ID' : 'Lecturer ID'}
                  type="text"
                  icon={IconIdBadge}
                  placeholder={isStudent ? 'e.g. STU-2026-001' : 'e.g. LEC-2024-042'}
                  value={isStudent ? studentForm.student_id : lecturerForm.lecturer_id}
                  onChange={(e) => (isStudent
                    ? updateStudent('student_id', e.target.value)
                    : updateLecturer('lecturer_id', e.target.value))}
                  required
                  disabled={submitting}
                />
                <AuthField
                  id="reg-email"
                  label="Email address"
                  type="email"
                  icon={IconMail}
                  autoComplete="email"
                  placeholder="you@university.edu"
                  value={form.email}
                  onChange={(e) => (isStudent
                    ? updateStudent('email', e.target.value)
                    : updateLecturer('email', e.target.value))}
                  required
                  disabled={submitting}
                />
                <AuthPhotoUpload
                  file={photoFile}
                  previewUrl={photoPreview}
                  onChange={handlePhotoChange}
                  disabled={submitting}
                />
              </AuthFieldGroup>

              {isStudent ? (
                <AuthFieldGroup
                  title="Academic details"
                  description="Your programme and study mode help lecturers place you correctly."
                >
                  <AuthField
                    id="reg-program"
                    label="Programme"
                    type="text"
                    icon={IconBook}
                    placeholder="e.g. BSc Computer Science"
                    value={studentForm.program}
                    onChange={(e) => updateStudent('program', e.target.value)}
                    required
                    disabled={submitting}
                  />
                  <AuthField
                    id="reg-year"
                    label="Academic year"
                    type="number"
                    placeholder="1"
                    value={studentForm.year_of_study}
                    onChange={(e) => updateStudent('year_of_study', e.target.value)}
                    required
                    disabled={submitting}
                  />
                  <AuthSelect
                    id="reg-mode"
                    label="Study mode"
                    value={studentForm.mode}
                    onChange={(e) => updateStudent('mode', e.target.value)}
                    disabled={submitting}
                    required
                    options={[
                      { value: 'Full-time', label: 'Full-time' },
                      { value: 'Evening', label: 'Evening' },
                      { value: 'ODL', label: 'ODL (Open & Distance Learning)' }
                    ]}
                  />
                </AuthFieldGroup>
              ) : (
                <AuthFieldGroup
                  title="Teaching affiliation"
                  description="Your department is used for course administration."
                >
                  <AuthField
                    id="reg-department"
                    label="Department"
                    type="text"
                    icon={IconBuilding}
                    placeholder="e.g. Faculty of Computing"
                    value={lecturerForm.department}
                    onChange={(e) => updateLecturer('department', e.target.value)}
                    required
                    disabled={submitting}
                  />
                </AuthFieldGroup>
              )}

              <AuthFieldGroup title="Security" description="Choose a strong password for your account.">
                <AuthField
                  id="reg-password"
                  label="Password"
                  type="password"
                  icon={IconLock}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={(e) => (isStudent
                    ? updateStudent('password', e.target.value)
                    : updateLecturer('password', e.target.value))}
                  required
                  disabled={submitting}
                />
                <AuthPasswordStrength password={form.password} />
                <AuthField
                  id="reg-confirm"
                  label="Confirm password"
                  type="password"
                  icon={IconLock}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={(e) => (isStudent
                    ? updateStudent('confirmPassword', e.target.value)
                    : updateLecturer('confirmPassword', e.target.value))}
                  required
                  disabled={submitting}
                />
              </AuthFieldGroup>

              {error ? <AuthAlert type="error">{error}</AuthAlert> : null}

              {submitting && !error ? (
                <AuthAlert type="info" title="Creating your account">
                  Setting up your institutional profile…
                </AuthAlert>
              ) : null}

              <AuthButton loading={submitting} disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </AuthButton>

              <AuthActions>
                <span className={styles.note}>Already have an account?</span>
                <AuthFooterLink to="/login">Sign in</AuthFooterLink>
              </AuthActions>
            </AuthForm>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
