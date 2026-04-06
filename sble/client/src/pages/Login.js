import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';

export default function Login() {
  const navigate = useNavigate();
  const { keycloak, initialized, login } = useKeycloak();
  const [form, setForm] = useState({
    email: 'admin1@sble.local',
    password: 'admin123'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (initialized && keycloak.authenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
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
          maxWidth: 460,
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
            Secure Blended Learning Environment (SBLE)
          </h1>
          <p style={{ color: '#667085', margin: 0 }}>
            Login to access your courses and academic resources
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email address"
            required
            style={{
              padding: '11px 12px',
              borderRadius: 10,
              border: '1px solid #d7deea',
              outline: 'none',
              fontSize: '0.95rem'
            }}
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password"
            required
            style={{
              padding: '11px 12px',
              borderRadius: 10,
              border: '1px solid #d7deea',
              outline: 'none',
              fontSize: '0.95rem'
            }}
          />

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
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Link to="/register" style={{ color: '#4f8ef7', fontWeight: 600, textDecoration: 'none' }}>
            Create Account
          </Link>
          <a
            href="mailto:admin@sble.local?subject=SBLE%20Password%20Reset%20Request"
            style={{ color: '#667085', textDecoration: 'none', fontSize: '0.9rem' }}
          >
            Forgot password?
          </a>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #edf1f7', fontSize: '0.9rem', color: '#555' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Students and Lecturers can create accounts</p>
          <p style={{ margin: '8px 0 0', color: '#666' }}>
            Admin accounts are managed by the system administrator
          </p>
        </div>
      </div>
    </div>
  );
}
