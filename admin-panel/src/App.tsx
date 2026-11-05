import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { useAuth } from './context/AuthContext';
import { canAccess } from './lib/roles';
import { AccessControlPage } from './pages/AccessControlPage';
import { AdminsPage } from './pages/AdminsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { AppControlPage } from './pages/AppControlPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AuditPage } from './pages/AuditPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { PlansPage } from './pages/PlansPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { SupportPage } from './pages/SupportPage';
import { UsersPage } from './pages/UsersPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRoute({ path, children }: { path: string; children: ReactNode }) {
  const { role } = useAuth();
  if (!role || !canAccess(role, path)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="approvals" element={<RequireRoute path="/approvals"><ApprovalsPage /></RequireRoute>} />
        <Route path="users" element={<RequireRoute path="/users"><UsersPage /></RequireRoute>} />
        <Route path="plans" element={<RequireRoute path="/plans"><PlansPage /></RequireRoute>} />
        <Route path="subscriptions" element={<RequireRoute path="/subscriptions"><SubscriptionsPage /></RequireRoute>} />
        <Route path="features" element={<RequireRoute path="/features"><FeaturesPage /></RequireRoute>} />
        <Route path="payments" element={<RequireRoute path="/payments"><PaymentsPage /></RequireRoute>} />
        <Route path="announcements" element={<RequireRoute path="/announcements"><AnnouncementsPage /></RequireRoute>} />
        <Route path="access-control" element={<RequireRoute path="/access-control"><AccessControlPage /></RequireRoute>} />
        <Route path="app-control" element={<RequireRoute path="/app-control"><AppControlPage /></RequireRoute>} />
        <Route path="support" element={<RequireRoute path="/support"><SupportPage /></RequireRoute>} />
        <Route path="audit" element={<RequireRoute path="/audit"><AuditPage /></RequireRoute>} />
        <Route path="admins" element={<RequireRoute path="/admins"><AdminsPage /></RequireRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
