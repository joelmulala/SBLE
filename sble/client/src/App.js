import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useKeycloak } from './auth/AuthProvider';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Materials from './pages/Materials';
import Assignments from './pages/Assignments';
import Quizzes from './pages/Quizzes';
import Exams from './pages/Exams';
import Users from './pages/Users';
import Room from './pages/Room';
import RoomsList from './pages/RoomsList';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LecturerCoursesPage from './pages/lecturer/LecturerCoursesPage';
import LecturerEnrollmentPage from './pages/lecturer/LecturerEnrollmentPage';
import LecturerPerformancePage from './pages/lecturer/LecturerPerformancePage';
import GradebookPage from './pages/shared/GradebookPage';
import CalendarPage from './pages/shared/CalendarPage';
import CourseCommunicationsPage from './pages/shared/CourseCommunicationsPage';
import { PageGate } from './components/ui/WorkspaceFeedback';

const ProtectedRoute = ({ children, roles }) => {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) return <PageGate variant="loading" />;
  if (!keycloak.authenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.some(r => keycloak.hasRealmRole(r))) {
    return <PageGate variant="denied" />;
  }
  return children;
};

function HomeRoute() {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) return <PageGate variant="loading" />;

  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  if (isLecturer) {
    return <Navigate to="/lecturer/dashboard" replace />;
  }

  return <Navigate to="/student/dashboard" replace />;
}

function CoursesRouteRedirect() {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) return <PageGate variant="loading" />;

  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  return <Navigate to={isLecturer ? '/lecturer/courses' : '/student/courses'} replace />;
}

function CourseDetailRouteRedirect() {
  const { keycloak, initialized } = useKeycloak();
  const { id } = useParams();

  if (!initialized) return <PageGate variant="loading" />;

  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  return <Navigate to={isLecturer ? `/lecturer/courses/${id}` : `/student/courses/${id}`} replace />;
}

function LegacyRoomRouteRedirect() {
  const { token } = useParams();
  return <Navigate to={`/room/${token}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomeRoute />} />
          <Route path="lecturer" element={<ProtectedRoute roles={['lecturer', 'admin']}><Navigate to="/lecturer/dashboard" replace /></ProtectedRoute>} />
          <Route path="lecturer/dashboard" element={<ProtectedRoute roles={['lecturer', 'admin']}><Dashboard /></ProtectedRoute>} />
          <Route path="lecturer/courses" element={<ProtectedRoute roles={['lecturer', 'admin']}><LecturerCoursesPage /></ProtectedRoute>} />
          <Route path="lecturer/courses/:courseId" element={<ProtectedRoute roles={['lecturer', 'admin']}><CourseDetail /></ProtectedRoute>} />
          <Route path="lecturer/enrollment" element={<ProtectedRoute roles={['lecturer', 'admin']}><LecturerEnrollmentPage /></ProtectedRoute>} />
          <Route path="lecturer/assignments" element={<Navigate to="/lecturer/courses" replace />} />
          <Route path="lecturer/quizzes" element={<Navigate to="/lecturer/courses" replace />} />
          <Route path="lecturer/exams" element={<Navigate to="/lecturer/courses" replace />} />
          <Route path="lecturer/materials" element={<Navigate to="/lecturer/courses" replace />} />
          <Route path="lecturer/performance" element={<Navigate to="/lecturer/courses" replace />} />
          <Route path="lecturer/gradebook" element={<ProtectedRoute roles={['lecturer', 'admin']}><GradebookPage /></ProtectedRoute>} />
          <Route path="lecturer/calendar" element={<ProtectedRoute roles={['lecturer', 'admin']}><CalendarPage /></ProtectedRoute>} />
          <Route path="student" element={<ProtectedRoute roles={['student']}><Navigate to="/student/dashboard" replace /></ProtectedRoute>} />
          <Route path="student/dashboard" element={<ProtectedRoute roles={['student']}><Dashboard /></ProtectedRoute>} />
          <Route path="student/courses" element={<ProtectedRoute roles={['student']}><Courses /></ProtectedRoute>} />
          <Route path="student/materials" element={<Navigate to="/student/courses" replace />} />
          <Route path="student/assignments" element={<Navigate to="/student/courses" replace />} />
          <Route path="student/quizzes" element={<Navigate to="/student/courses" replace />} />
          <Route path="student/exams" element={<Navigate to="/student/courses" replace />} />
          <Route path="student/gradebook" element={<ProtectedRoute roles={['student']}><GradebookPage /></ProtectedRoute>} />
          <Route path="student/calendar" element={<ProtectedRoute roles={['student']}><CalendarPage /></ProtectedRoute>} />
          <Route path="student/courses/:courseId" element={<ProtectedRoute roles={['student']}><CourseDetail /></ProtectedRoute>} />
          <Route path="student/courses/:courseId/materials" element={<ProtectedRoute roles={['student']}><Materials /></ProtectedRoute>} />
          <Route path="student/courses/:courseId/assignments" element={<ProtectedRoute roles={['student']}><Assignments /></ProtectedRoute>} />
          <Route path="student/courses/:courseId/quizzes" element={<ProtectedRoute roles={['student']}><Quizzes /></ProtectedRoute>} />
          <Route path="student/courses/:courseId/exams" element={<ProtectedRoute roles={['student']}><Exams /></ProtectedRoute>} />
          <Route path="student/courses/:courseId/gradebook" element={<ProtectedRoute roles={['student']}><GradebookPage /></ProtectedRoute>} />
          <Route path="student/courses/:courseId/communications" element={<ProtectedRoute roles={['student']}><CourseCommunicationsPage /></ProtectedRoute>} />
          <Route path="courses" element={<CoursesRouteRedirect />} />
          <Route path="courses/:id" element={<CourseDetailRouteRedirect />} />
          <Route path="lecturer/courses/:courseId/materials" element={<ProtectedRoute roles={['lecturer', 'admin']}><Materials /></ProtectedRoute>} />
          <Route path="lecturer/courses/:courseId/assignments" element={<ProtectedRoute roles={['lecturer', 'admin']}><Assignments /></ProtectedRoute>} />
          <Route path="lecturer/courses/:courseId/quizzes" element={<ProtectedRoute roles={['lecturer', 'admin']}><Quizzes /></ProtectedRoute>} />
          <Route path="lecturer/courses/:courseId/enrollment" element={<ProtectedRoute roles={['lecturer', 'admin']}><LecturerEnrollmentPage /></ProtectedRoute>} />
          <Route path="lecturer/courses/:courseId/performance" element={<ProtectedRoute roles={['lecturer', 'admin']}><LecturerPerformancePage /></ProtectedRoute>} />
          <Route path="lecturer/courses/:courseId/exams" element={<ProtectedRoute roles={['lecturer', 'admin']}><Exams /></ProtectedRoute>} />
          <Route path="lecturer/courses/:courseId/gradebook" element={<ProtectedRoute roles={['lecturer', 'admin']}><GradebookPage /></ProtectedRoute>} />
          <Route path="lecturer/courses/:courseId/communications" element={<ProtectedRoute roles={['lecturer', 'admin']}><CourseCommunicationsPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
          <Route path="rooms" element={<ProtectedRoute roles={['lecturer', 'admin', 'student']}><RoomsList /></ProtectedRoute>} />
          <Route path="room/:roomId" element={<ProtectedRoute roles={['lecturer', 'admin', 'student']}><Room /></ProtectedRoute>} />
          <Route path="rooms/:token" element={<LegacyRoomRouteRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
