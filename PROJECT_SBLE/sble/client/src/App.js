import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Materials from './pages/Materials';
import Assignments from './pages/Assignments';
import Quizzes from './pages/Quizzes';
import Exams from './pages/Exams';
import Room from './pages/Room';

const ProtectedRoute = ({ children, roles }) => {
  const { keycloak } = useKeycloak();
  if (!keycloak.authenticated) return <Navigate to="/" />;
  if (roles && !roles.some(r => keycloak.hasRealmRole(r))) {
    return <div style={{ padding: 32 }}>Access denied.</div>;
  }
  return children;
};

export default function App() {
  const { initialized } = useKeycloak();
  if (!initialized) return <div style={{ padding: 32 }}>Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
          <Route path="courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
          <Route path="courses/:id/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
          <Route path="courses/:id/assignments" element={<ProtectedRoute><Assignments /></ProtectedRoute>} />
          <Route path="courses/:id/quizzes" element={<ProtectedRoute><Quizzes /></ProtectedRoute>} />
          <Route path="courses/:id/exams" element={<ProtectedRoute roles={['lecturer', 'admin']}><Exams /></ProtectedRoute>} />
          <Route path="rooms/:token" element={<ProtectedRoute><Room /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
