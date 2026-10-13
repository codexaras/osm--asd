import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import { Login, Signup } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Resources from './pages/Resources';
import Requests from './pages/Requests';
import Allocations from './pages/Allocations';
import Bookings from './pages/Bookings';
import Maintenance from './pages/Maintenance';
import UsersPage from './pages/Users';
import ActivityPage from './pages/Activity';
import Monitoring from './pages/Monitoring';
import Profile from './pages/Profile';

function RequireAuth({ adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/allocations" element={<Allocations />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/profile" element={<Profile />} />
                <Route element={<RequireAuth adminOnly />}>
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/activity" element={<ActivityPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
