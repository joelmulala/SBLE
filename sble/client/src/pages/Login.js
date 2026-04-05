import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';

export default function Login() {
  const navigate = useNavigate();
  const { keycloak, initialized, login } = useKeycloak();
  const [form, setForm] = useState({
    email: 'lecturer1@sble.local',
    password: 'lecturer123'
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
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 28 }}>
        <h1 style={{ marginBottom: 8 }}>SBLE Login</h1>
        <p style={{ color: '#666', marginBottom: 20 }}>Temporary JWT login while Keycloak is disabled.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            required
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d9dce3' }}
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password"
            required
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d9dce3' }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontWeight: 600 }}
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {error && <p style={{ color: '#dc3545', marginTop: 12 }}>{error}</p>}

        <div style={{ marginTop: 20, fontSize: '0.9rem', color: '#555' }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Demo accounts</p>
          <ul style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6 }}>
            <li><code>admin1@sble.local</code> / <code>admin123</code></li>
            <li><code>lecturer1@sble.local</code> / <code>lecturer123</code></li>
            <li><code>student1@sble.local</code> / <code>student123</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
