import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import useNotifications from '../hooks/useNotifications';
import NotificationCenter from './productivity/NotificationCenter';
import api from '../config/api';
import { buildBreadcrumbs, resolvePageTitle } from '../utils/workspaceNav';
import styles from './Layout.module.css';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const { notifications, dismiss, dismissAll } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifAnchorRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');

  const isAdmin = keycloak.hasRealmRole('admin');
  const isLecturer = keycloak.hasRealmRole('lecturer') || isAdmin;
  const roleThemeClass = isAdmin ? styles.roleAdmin : isLecturer ? styles.roleLecturer : styles.roleStudent;
  const workspaceLabel = isAdmin
    ? 'Administrator workspace'
    : isLecturer
      ? 'Teaching workspace'
      : 'Learning workspace';

  const userName = keycloak.tokenParsed?.name || 'User';
  const userInitials = useMemo(() => {
    const parts = String(userName).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return (parts[0]?.[0] || 'U').toUpperCase();
  }, [userName]);

  const courseIdMatch = location.pathname.match(/\/courses\/([^/]+)/);
  const courseId = courseIdMatch?.[1];

  useEffect(() => {
    setSidebarOpen(false);
    setShowNotifs(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showNotifs) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowNotifs(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNotifs]);

  useEffect(() => {
    if (!courseId) {
      setCourseTitle('');
      return undefined;
    }
    let cancelled = false;
    api.get(`/courses/${courseId}`)
      .then((res) => {
        if (!cancelled) setCourseTitle(res.data?.title || '');
      })
      .catch(() => {
        if (!cancelled) setCourseTitle('');
      });
    return () => { cancelled = true; };
  }, [courseId]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [sidebarOpen]);

  const lecturerNavItems = [
    { to: '/lecturer/courses', label: 'My courses', end: true, matchRoutes: [/^\/lecturer\/courses\/[^/]+/] },
    { to: '/lecturer/calendar', label: 'Calendar', matchRoutes: [/^\/lecturer\/calendar(?:\/)?$/] },
    { to: '/lecturer/gradebook', label: 'Gradebook', matchRoutes: [/^\/lecturer\/gradebook(?:\/)?$/, /^\/lecturer\/courses\/[^/]+\/gradebook(?:\/)?$/] }
  ];

  const studentNavItems = [
    { to: '/student/courses', label: 'My courses', end: true, matchRoutes: [/^\/student\/courses\/[^/]+/] },
    { to: '/student/calendar', label: 'Calendar', matchRoutes: [/^\/student\/calendar(?:\/)?$/] },
    { to: '/student/gradebook', label: 'Gradebook', matchRoutes: [/^\/student\/gradebook(?:\/)?$/, /^\/student\/courses\/[^/]+\/gradebook(?:\/)?$/] }
  ];

  const academicNavItems = isLecturer ? lecturerNavItems : studentNavItems;
  const liveClassNotification = notifications.find((n) => n.type === 'live_class_started' && n.roomId);
  const pageTitle = resolvePageTitle(location.pathname);
  const breadcrumbs = buildBreadcrumbs(location.pathname, {
    isLecturer,
    courseTitle: courseTitle || (courseId ? `Course ${courseId}` : '')
  });

  useEffect(() => {
    if (!showNotifs) return undefined;
    const onPointerDown = (e) => {
      if (notifAnchorRef.current?.contains(e.target)) return;
      setShowNotifs(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [showNotifs]);

  const handleJoinLiveClass = () => {
    if (!liveClassNotification?.roomId) return;
    navigate(`/room/${encodeURIComponent(liveClassNotification.roomId)}`);
    dismiss(liveClassNotification.id);
  };

  return (
    <div className={`${styles.shell} ${roleThemeClass}`}>
      <a href="#main-content" className={styles.skipLink}>Skip to main content</a>

      {sidebarOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        id="workspace-sidebar"
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}
        aria-label="Primary navigation"
      >
        <div className={styles.sidebarScrollable}>
          <div className={styles.logoWrap}>
            <div className={styles.logoMark}>S</div>
            <div>
              <div className={styles.logo}>SBLE</div>
              <div className={styles.logoMeta}>Blended learning</div>
            </div>
          </div>

          <SidebarGroup label="Main">
            <NavItem to={isLecturer ? '/lecturer/dashboard' : '/student/dashboard'} end>Dashboard</NavItem>
            <NavItem to="/rooms" matchRoutes={[/^\/room\/[^/]+(?:\/)?$/, /^\/rooms(?:\/)?$/]}>Live classes</NavItem>
          </SidebarGroup>

          <SidebarGroup label="Academic">
            {academicNavItems.map((item) => (
              <NavItem key={item.to} to={item.to} end={item.end} matchRoutes={item.matchRoutes}>
                {item.label}
              </NavItem>
            ))}
          </SidebarGroup>

          {isAdmin ? (
            <SidebarGroup label="Administration">
              <NavItem to="/users">Users</NavItem>
            </SidebarGroup>
          ) : null}
        </div>

        <button type="button" className={styles.logout} onClick={() => keycloak.logout()}>
          Sign out
        </button>
      </aside>

      <div className={styles.mainPanel}>
        <header className={styles.header}>
          <div className={styles.headerStart}>
            <button
              type="button"
              className={styles.menuButton}
              aria-expanded={sidebarOpen}
              aria-controls="workspace-sidebar"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <span className={styles.menuIcon} aria-hidden />
              <span className={styles.srOnly}>Menu</span>
            </button>
            <div className={styles.headerTitles}>
              <p className={styles.headerEyebrow}>{workspaceLabel}</p>
              <h1 className={styles.headerTitle}>{pageTitle}</h1>
              {breadcrumbs.length > 1 ? (
                <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                  {breadcrumbs.map((crumb, i) => {
                    const isLast = i === breadcrumbs.length - 1;
                    return (
                      <span key={`${crumb.to}-${crumb.label}`} className={styles.breadcrumbItem}>
                        {i > 0 ? <span className={styles.breadcrumbSep} aria-hidden>/</span> : null}
                        {isLast ? (
                          <span className={styles.breadcrumbCurrent}>{crumb.label}</span>
                        ) : (
                          <NavLink to={crumb.to} className={styles.breadcrumbLink}>{crumb.label}</NavLink>
                        )}
                      </span>
                    );
                  })}
                </nav>
              ) : null}
            </div>
          </div>

          <div className={styles.headerActions} ref={notifAnchorRef}>
            <div className={styles.notifWrap}>
            <button
              type="button"
              onClick={() => setShowNotifs((open) => !open)}
              className={styles.notificationButton}
              aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ''}`}
              aria-expanded={showNotifs}
              aria-haspopup="dialog"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinejoin="round" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
              </svg>
              {notifications.length > 0 ? (
                <span className={styles.notifBadge}>{notifications.length > 9 ? '9+' : notifications.length}</span>
              ) : null}
            </button>
            {showNotifs ? (
              <NotificationCenter
                notifications={notifications}
                dismiss={dismiss}
                dismissAll={dismissAll}
                onClose={() => setShowNotifs(false)}
                isLecturer={isLecturer}
              />
            ) : null}
            </div>
            <div className={styles.profileChip} title={userName}>
              <span className={styles.profileAvatar} aria-hidden>{userInitials}</span>
              <span className={styles.profileName}>{userName}</span>
            </div>
          </div>
        </header>

        {liveClassNotification ? (
          <div className={styles.liveAlert}>
            <div className={styles.liveAlertTop}>
              <div>
                <div className={styles.liveKicker}>Live class</div>
                <div className={styles.liveTitle}>Session in progress</div>
                <div className={styles.liveMessage}>{liveClassNotification.message}</div>
              </div>
              <button type="button" onClick={() => dismiss(liveClassNotification.id)} className={styles.dismissButton} aria-label="Dismiss">×</button>
            </div>
            <div className={styles.joinWrap}>
              <button type="button" onClick={handleJoinLiveClass} className={styles.joinButton}>Join now</button>
            </div>
          </div>
        ) : null}

        <main id="main-content" className={styles.content} tabIndex={-1}>
          <div className="wk-page">
            <div className="wk-container">
              <Outlet />
            </div>
          </div>
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
    if (route instanceof RegExp) return route.test(location.pathname);
    if (typeof route !== 'string') return false;
    return location.pathname === route || location.pathname.startsWith(`${route}/`);
  });

  const isHashActive = targetHash ? location.hash === targetHash : true;
  const isActive = (isPrimaryPathActive || isMatchedRouteActive) && isHashActive;

  return (
    <NavLink
      to={to}
      end={end}
      className={`${styles.navLink} ${isActive ? styles.active : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </NavLink>
  );
}
