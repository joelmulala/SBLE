import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useKeycloak } from './auth/AuthProvider';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Materials from './pages/Materials';
import Assignments from './pages/Assignments';
import Quizzes from './pages/Quizzes';
import Exams from './pages/Exams';
import Room from './pages/Room';
import Login from './pages/Login';

const ProtectedRoute = ({ children, roles }) => {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) return <div style={{ padding: 32 }}>Loading...</div>;
  if (!keycloak.authenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.some(r => keycloak.hasRealmRole(r))) {
    return <div style={{ padding: 32 }}>Access denied.</div>;
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:id" element={<CourseDetail />} />
          <Route path="courses/:id/materials" element={<Materials />} />
          <Route path="courses/:id/assignments" element={<Assignments />} />
          <Route path="courses/:id/quizzes" element={<Quizzes />} />
          <Route path="courses/:id/exams" element={<ProtectedRoute roles={['lecturer', 'admin']}><Exams /></ProtectedRoute>} />
          <Route path="rooms/:token" element={<Room />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
