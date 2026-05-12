import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import useNotifications from '../hooks/useNotifications';
import styles from './Layout.module.css';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const { notifications, dismiss } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const isAdmin = keycloak.hasRealmRole('admin');
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const roleThemeClass = isAdmin ? styles.roleAdmin : isLecturer ? styles.roleLecturer : styles.roleStudent;
  const workspaceLabel = isAdmin
    ? 'Administrator Workspace'
    : isLecturer
      ? 'Teaching Workspace'
      : 'Learning Workspace';

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

  const liveClassNotification = notifications.find((n) => n.type === 'live_class_started' && n.roomId);

  const handleJoinLiveClass = () => {
    if (!liveClassNotification?.roomId) return;
    navigate(`/room/${encodeURIComponent(liveClassNotification.roomId)}`);
    dismiss(liveClassNotification.id);
  };

  const sectionTitle = resolveSectionTitle(location.pathname);

  return (
    <div className={`${styles.shell} ${roleThemeClass}`}>
      <nav className={styles.sidebar}>
        <div className={styles.sidebarScrollable}>
          <div className={styles.logoWrap}>
            <div className={styles.logo}>SBLE</div>
            <div className={styles.logoMeta}>Smart Blended Learning Environment</div>
          </div>

          <SidebarGroup label="MAIN">
            <NavItem to={isLecturer ? '/lecturer/dashboard' : '/student/dashboard'} end>Dashboard</NavItem>
            <NavItem to="/rooms" matchRoutes={[/^\/room\/[^/]+(?:\/)?$/, /^\/rooms\/[^/]+(?:\/)?$/]}>Live Classes</NavItem>
          </SidebarGroup>

          {isLecturer ? (
            <SidebarGroup label="ACADEMIC">
              {lecturerNavItems.map((item) => (
                <NavItem key={item.to} to={item.to} end={item.end} matchRoutes={item.matchRoutes}>
                  {item.label}
                </NavItem>
              ))}
            </SidebarGroup>
          ) : (
            <SidebarGroup label="ACADEMIC">
              <NavItem to="/student/courses" end matchRoutes={[/^\/student\/courses\/[^/]+(?:\/)?$/]}>Courses</NavItem>
              <NavItem to="/student/materials" end matchRoutes={[/^\/student\/courses\/[^/]+\/materials(?:\/)?$/]}>Materials</NavItem>
              <NavItem to="/student/assignments" end matchRoutes={[/^\/student\/courses\/[^/]+\/assignments(?:\/)?$/]}>Assignments</NavItem>
              <NavItem to="/student/quizzes" end matchRoutes={[/^\/student\/courses\/[^/]+\/quizzes(?:\/)?$/]}>Quizzes</NavItem>
            </SidebarGroup>
          )}

          {isAdmin && (
            <SidebarGroup label="ADMIN">
              <NavItem to="/users">Users</NavItem>
            </SidebarGroup>
          )}
        </div>

        <button className={styles.logout} onClick={() => keycloak.logout()}>Logout</button>
      </nav>

      <div className={styles.mainPanel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerEyebrow}>{workspaceLabel}</div>
            <div className={styles.headerTitle}>{sectionTitle}</div>
          </div>
          <div className={styles.headerActions}>
          <button onClick={() => setShowNotifs(!showNotifs)}
            className={styles.notificationButton}
            aria-label="Toggle notifications"
            type="button"
          >
            {showNotifs ? '×' : '◉'}
            {notifications.length > 0 && (
              <span className={styles.notifBadge}>
                {notifications.length}
              </span>
            )}
          </button>
          <span className={styles.userMeta}>{keycloak.tokenParsed?.name}</span>
          </div>
        </div>

        {showNotifs && (
          <div className={styles.popover}>
            <p className={styles.popoverTitle}>Notifications</p>
            {notifications.length === 0 && <p className={styles.emptyState}>No new notifications</p>}
            {notifications.map(n => (
              <div key={n.id} className={styles.notifItem}>
                <p className={styles.notifMessage}>{n.message || n.title}</p>
                <button onClick={() => dismiss(n.id)} className={styles.dismissButton} type="button">×</button>
              </div>
            ))}
          </div>
        )}

        {liveClassNotification && (
          <div className={styles.liveAlert}>
            <div className={styles.liveAlertTop}>
              <div>
                <div className={styles.liveKicker}>LIVE CLASS</div>
                <div className={styles.liveTitle}>Live class started - Join now</div>
                <div className={styles.liveMessage}>{liveClassNotification.message}</div>
              </div>
              <button onClick={() => dismiss(liveClassNotification.id)} className={styles.dismissButton} type="button">×</button>
            </div>

            <div className={styles.joinWrap}>
              <button
                type="button"
                onClick={handleJoinLiveClass}
                className={styles.joinButton}
              >
                Join now
              </button>
            </div>
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
    <div className={styles.sidebarGroup}>
      <div className={styles.sidebarLabel}>{label}</div>
      <div className={styles.sidebarLinks}>{children}</div>
    </div>
  );
}

function NavItem({ to, children, end = false, matchRoutes = [] }) {
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
    <NavLink to={to} end={end} className={`${styles.navLink} ${isActive ? styles.active : ''}`}>
      {children}
    </NavLink>
  );
}

function resolveSectionTitle(pathname) {
  if (pathname.includes('/dashboard')) return 'Dashboard';
  if (pathname.includes('/courses')) return 'Courses';
  if (pathname.includes('/materials')) return 'Materials';
  if (pathname.includes('/assignments')) return 'Assignments';
  if (pathname.includes('/quizzes')) return 'Quizzes';
  if (pathname.includes('/exams')) return 'Exams';
  if (pathname.includes('/performance')) return 'Performance';
  if (pathname.includes('/enrollment')) return 'Enrollment';
  if (pathname.includes('/room')) return 'Live Classroom';
  if (pathname.includes('/users')) return 'User Management';
  return 'Learning Workspace';
}
