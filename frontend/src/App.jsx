import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ConnectFacebook from './pages/ConnectFacebook';
import Automation from './pages/Automation';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminPlans from './pages/AdminPlans';
import AdminApiKeys from './pages/AdminApiKeys';
import AdminSettings from './pages/AdminSettings';
import AdminPosts from './pages/AdminPosts';

function PrivateRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  if (!adminOnly && user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/connect-facebook" element={<PrivateRoute><ConnectFacebook /></PrivateRoute>} />
      <Route path="/automation" element={<PrivateRoute><Automation /></PrivateRoute>} />

      <Route path="/admin" element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />
      <Route path="/admin/users" element={<PrivateRoute adminOnly><AdminUsers /></PrivateRoute>} />
      <Route path="/admin/plans" element={<PrivateRoute adminOnly><AdminPlans /></PrivateRoute>} />
      <Route path="/admin/api-keys" element={<PrivateRoute adminOnly><AdminApiKeys /></PrivateRoute>} />
      <Route path="/admin/settings" element={<PrivateRoute adminOnly><AdminSettings /></PrivateRoute>} />
      <Route path="/admin/posts" element={<PrivateRoute adminOnly><AdminPosts /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
