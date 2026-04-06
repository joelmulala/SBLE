import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

const initialForm = {
  role: 'student',
  full_name: '',
  email: '',
  password: '',
  student_id: '',
  program: '',
  year_of_study: '',
  semester: '',
  mode: 'Full-time',
  institution: '',
  staff_email: ''
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const { keycloak, initialized } = useKeycloak();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isStudent = form.role === 'student';
  const isLecturer = form.role === 'lecturer';

  const passwordNote = useMemo(() => (
    isLecturer
      ? 'Create your lecturer account details and continue to login after registration.'
      : 'Create your student account details and continue to login after registration.'
  ), [isLecturer]);

  if (initialized && keycloak.authenticated) {
    return <Navigate to="/" replace />;
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.full_name.trim()) return 'Full name is required';
    if (!emailPattern.test(form.email.trim())) return 'Enter a valid email address';
    if (!form.password.trim()) return 'Password must not be empty';

    if (isStudent) {
      if (!form.student_id.trim()) return 'Student ID is required';
      if (!form.program.trim()) return 'Program is required';
      if (!form.year_of_study) return 'Year of study is required';
      if (!form.semester) return 'Semester is required';
      if (!form.mode) return 'Mode is required';
    }

    if (isLecturer) {
      if (!form.institution.trim()) return 'Institution is required';
      if (!emailPattern.test(form.staff_email.trim())) return 'Enter a valid staff email';
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        role: form.role,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(isStudent
          ? {
              student_id: form.student_id.trim(),
              program: form.program.trim(),
              year_of_study: Number(form.year_of_study),
              semester: Number(form.semester),
              mode: form.mode
            }
          : {
              institution: form.institution.trim(),
              staff_email: form.staff_email.trim()
            })
      };

      await api.post('/auth/register', payload);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, #f4f7fb 0%, #eef3ff 100%)',
        padding: 20
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.10)',
          padding: 30,
          border: '1px solid #e7ecf5'
        }}
      >
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: 0, color: '#4f8ef7', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Secure LMS
          </p>
          <h1 style={{ margin: '8px 0 10px', fontSize: '1.7rem', lineHeight: 1.25, color: '#1f2937' }}>
            Create Your SBLE Account
          </h1>
          <p style={{ color: '#667085', margin: 0 }}>
            Register to access courses and academic resources in the Secure Blended Learning Environment.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <select
            value={form.role}
            onChange={(e) => updateField('role', e.target.value)}
            style={inputStyle}
          >
            <option value="student">Student</option>
            <option value="lecturer">Lecturer</option>
          </select>

          <input
            type="text"
            value={form.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
            placeholder="Full name"
            required
            style={inputStyle}
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="Email address"
            required
            style={inputStyle}
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="Password"
            required
            style={inputStyle}
          />

          {isStudent && (
            <>
              <input
                type="text"
                value={form.student_id}
                onChange={(e) => updateField('student_id', e.target.value)}
                placeholder="Student ID"
                required
                style={inputStyle}
              />
              <input
                type="text"
                value={form.program}
                onChange={(e) => updateField('program', e.target.value)}
                placeholder="Program"
                required
                style={inputStyle}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  type="number"
                  min="1"
                  value={form.year_of_study}
                  onChange={(e) => updateField('year_of_study', e.target.value)}
                  placeholder="Year of study"
                  required
                  style={inputStyle}
                />
                <input
                  type="number"
                  min="1"
                  value={form.semester}
                  onChange={(e) => updateField('semester', e.target.value)}
                  placeholder="Semester"
                  required
                  style={inputStyle}
                />
              </div>
              <select
                value={form.mode}
                onChange={(e) => updateField('mode', e.target.value)}
                style={inputStyle}
              >
                <option value="Full-time">Full-time</option>
                <option value="Evening">Evening</option>
                <option value="ODL">ODL</option>
              </select>
            </>
          )}

          {isLecturer && (
            <>
              <input
                type="text"
                value={form.institution}
                onChange={(e) => updateField('institution', e.target.value)}
                placeholder="Institution"
                required
                style={inputStyle}
              />
              <input
                type="email"
                value={form.staff_email}
                onChange={(e) => updateField('staff_email', e.target.value)}
                placeholder="Staff email"
                required
                style={inputStyle}
              />
            </>
          )}

          {error && (
            <div
              style={{
                color: '#b42318',
                background: '#fef3f2',
                border: '1px solid #fecdca',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: '0.92rem'
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: '#4f8ef7',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '11px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.96rem'
            }}
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 14, color: '#667085', fontSize: '0.9rem' }}>
          <p style={{ margin: 0 }}>{passwordNote}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <span style={{ color: '#667085', fontSize: '0.92rem' }}>Already have an account?</span>
          <Link to="/login" style={{ color: '#4f8ef7', fontWeight: 600, textDecoration: 'none' }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid #d7deea',
  outline: 'none',
  fontSize: '0.95rem'
};
