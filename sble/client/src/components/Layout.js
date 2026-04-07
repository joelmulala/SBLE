import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import useNotifications from '../hooks/useNotifications';
import styles from './Layout.module.css';

export default function Layout() {
  const { keycloak } = useKeycloak();
  const { notifications, dismiss } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const isAdmin = keycloak.hasRealmRole('admin');
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');

  const lecturerNavItems = [
    {
      to: '/lecturer/courses',
      label: 'Courses',
      end: true,
      matchRoutes: [/^\/lecturer\/courses\/[^/]+(?:\/)?$/]
    },
    {
      to: '/lecturer/materials',
      label: 'Materials',
      matchRoutes: [/^\/lecturer\/courses\/[^/]+\/materials(?:\/)?$/]
    },
    {
      to: '/lecturer/assignments',
      label: 'Assignments',
      matchRoutes: [/^\/lecturer\/courses\/[^/]+\/assignments(?:\/)?$/]
    },
    {
      to: '/lecturer/quizzes',
      label: 'Quizzes',
      matchRoutes: [
        '/lecturer/exams',
        /^\/lecturer\/courses\/[^/]+\/quizzes(?:\/)?$/,
        /^\/lecturer\/courses\/[^/]+\/exams(?:\/)?$/
      ]
    },
    {
      to: '/lecturer/performance',
      label: 'Performance',
      matchRoutes: [/^\/lecturer\/courses\/[^/]+\/performance(?:\/)?$/]
    }
  ];

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>SBLE</div>

        <SidebarGroup label="MAIN">
          <NavItem to={isLecturer ? '/lecturer/dashboard' : '/student/dashboard'} end icon="🏠">Dashboard</NavItem>
        </SidebarGroup>

        {isLecturer ? (
          <div className={styles.lecturerNav}>
            {lecturerNavItems.map((item) => (
              <NavItem key={item.to} to={item.to} end={item.end} matchRoutes={item.matchRoutes}>
                {item.label}
              </NavItem>
            ))}
          </div>
        ) : (
          <SidebarGroup label="ACADEMIC">
            <NavItem to="/student/courses" end icon="📚" matchRoutes={[/^\/student\/courses\/[^/]+(?:\/)?$/]}>Courses</NavItem>
            <NavItem to="/student/materials" end icon="📁" matchRoutes={[/^\/student\/courses\/[^/]+\/materials(?:\/)?$/]}>Materials</NavItem>
            <NavItem to="/student/assignments" end icon="📝" matchRoutes={[/^\/student\/courses\/[^/]+\/assignments(?:\/)?$/]}>Assignments</NavItem>
            <NavItem to="/student/quizzes" end icon="🧪" matchRoutes={[/^\/student\/courses\/[^/]+\/quizzes(?:\/)?$/]}>Quizzes</NavItem>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup label="ADMIN">
            <NavItem to="/users" icon="⚙️">Users</NavItem>
          </SidebarGroup>
        )}

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

function SidebarGroup({ label, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: '#94a3b8',
          marginBottom: 8,
          padding: '0 2px'
        }}
      >
        {label}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function NavItem({ to, children, icon, end = false, matchRoutes = [] }) {
  const location = useLocation();
  const target = typeof to === 'string' ? to : '';
  const [pathname, hash = ''] = target.split('#');
  const normalizedPath = pathname || '/';
  const targetHash = hash ? `#${hash}` : '';

  const isPrimaryPathActive = end
    ? location.pathname === normalizedPath
    : normalizedPath === '/'
      ? location.pathname === '/'
      : location.pathname === normalizedPath || location.pathname.startsWith(`${normalizedPath}/`);

  const isMatchedRouteActive = matchRoutes.some((route) => {
    if (route instanceof RegExp) {
      return route.test(location.pathname);
    }

    if (typeof route !== 'string') {
      return false;
    }

    return location.pathname === route || location.pathname.startsWith(`${route}/`);
  });

  const isHashActive = targetHash ? location.hash === targetHash : true;
  const isActive = (isPrimaryPathActive || isMatchedRouteActive) && isHashActive;

  return (
    <NavLink to={to} end={end} className={isActive ? styles.active : ''}>
      {icon ? <span style={{ marginRight: 8 }}>{icon}</span> : null}
      {children}
    </NavLink>
  );
}
