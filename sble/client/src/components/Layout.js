import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import useNotifications from '../hooks/useNotifications';
import styles from './Layout.module.css';

export default function Layout() {
  const { keycloak } = useKeycloak();
  const { notifications, dismiss } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>SBLE</div>
        <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}>Dashboard</NavLink>
        <NavLink to="/courses" className={({ isActive }) => isActive ? styles.active : ''}>Courses</NavLink>
        <button className={styles.logout} onClick={() => keycloak.logout()}>Logout</button>
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 32px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setShowNotifs(!showNotifs)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', position: 'relative' }}>
            🔔
            {notifications.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc3545', color: '#fff', borderRadius: '50%', fontSize: '0.65rem', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {notifications.length}
              </span>
            )}
          </button>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>{keycloak.tokenParsed?.name}</span>
        </div>

        {/* Notification dropdown */}
        {showNotifs && (
          <div style={{ position: 'absolute', right: 32, top: 52, background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', width: 320, zIndex: 100, padding: 12 }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Notifications</p>
            {notifications.length === 0 && <p style={{ color: '#aaa', fontSize: '0.9rem' }}>No new notifications</p>}
            {notifications.map(n => (
              <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '0.88rem', color: '#333' }}>{n.message || n.title}</p>
                <button onClick={() => dismiss(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem' }}>×</button>
              </div>
            ))}
          </div>
        )}

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
