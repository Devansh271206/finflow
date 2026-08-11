import React, { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { PermissionProvider } from './context/PermissionContext';
import { DepartmentProvider } from './context/DepartmentContext';
import { EmployeeProvider } from './context/EmployeeContext';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import OnboardingWizard from './pages/onboarding/OnboardingWizard';
import InviteJoin from './pages/InviteJoin';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Analytics from './pages/Analytics';
import Goals from './pages/Goals';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Departments from './pages/Departments';
import TeamManagement from './pages/TeamManagement';
import Employees from './pages/Employees';
import EmployeeDetails from './pages/EmployeeDetails';
import EmployeePortal from './pages/portal/EmployeePortal';
import Vendors from './pages/Vendors';
import Payroll from './pages/Payroll';
import LeaveRequests from './pages/LeaveRequests';
import LeaveApprovals from './pages/LeaveApprovals';
import Calendar from './pages/Calendar';
import NotificationCenter from './pages/NotificationCenter';
import ActivityFeed from './pages/ActivityFeed';
import ReportsHub from './pages/reports/ReportsHub';
import ReportViewer from './pages/reports/ReportViewer';
import PlatformProtectedRoute from './components/auth/PlatformProtectedRoute';
import PlatformDashboard from './pages/platform/PlatformDashboard';
import Organizations from './pages/platform/Organizations';
import OrganizationDetail from './pages/platform/OrganizationDetail';
import PlatformAnalytics from './pages/platform/PlatformAnalytics';
import PlatformSettings from './pages/platform/PlatformSettings';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, authReady } = useApp();

  if (!authReady) {
    return null;
  }

  if (!user?.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

// Animated Page Transition Wrapper
const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error.message || 'Something went wrong.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6">
          <div className="max-w-md rounded-3xl border border-rose-500/20 bg-[#111827] p-8 text-center">
            <h1 className="text-xl font-bold">We hit an unexpected issue.</h1>
            <p className="mt-2 text-sm text-slate-400">Please refresh the page or return to the dashboard.</p>
            <p className="mt-4 text-xs text-rose-300">{this.state.message}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Auth routes */}
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
        <Route path="/onboarding" element={<PageTransition><OnboardingWizard /></PageTransition>} />
        {/* Workspace invitation accept page — public; handles auth internally */}
        <Route path="/invite" element={<PageTransition><InviteJoin /></PageTransition>} />

        {/* Dashboard layouts */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <PageTransition><Dashboard /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/transactions" element={
          <ProtectedRoute>
            <PageTransition><Transactions /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/budgets" element={
          <ProtectedRoute>
            <PageTransition><Budgets /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <PageTransition><Analytics /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/goals" element={
          <ProtectedRoute>
            <PageTransition><Goals /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/departments" element={
          <ProtectedRoute>
            <PageTransition><Departments /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/team" element={
          <ProtectedRoute>
            <PageTransition><TeamManagement /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/employees" element={
          <ProtectedRoute>
            <PageTransition><Employees /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/employees/:id" element={
          <ProtectedRoute>
            <PageTransition><EmployeeDetails /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/portal" element={
          <ProtectedRoute>
            <PageTransition><EmployeePortal /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/vendors" element={
          <ProtectedRoute>
            <PageTransition><Vendors /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/payroll" element={
          <ProtectedRoute>
            <PageTransition><Payroll /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/leave-requests" element={
          <ProtectedRoute>
            <PageTransition><LeaveRequests /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/leave-approvals" element={
          <ProtectedRoute>
            <PageTransition><LeaveApprovals /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute>
            <PageTransition><Calendar /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <PageTransition><NotificationCenter /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/activity" element={
          <ProtectedRoute>
            <PageTransition><ActivityFeed /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute>
            <PageTransition><ReportsHub /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/reports/:reportId" element={
          <ProtectedRoute>
            <PageTransition><ReportViewer /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <PageTransition><Profile /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <PageTransition><Settings /></PageTransition>
          </ProtectedRoute>
        } />

        {/* Platform Administration — separate route tree, separate guard
            (PlatformProtectedRoute, not ProtectedRoute), separate layout
            (PlatformAdminLayout, not DashboardLayout). Never nested
            under or mixed with the routes above. */}
        <Route path="/platform" element={
          <PlatformProtectedRoute>
            <PageTransition><PlatformDashboard /></PageTransition>
          </PlatformProtectedRoute>
        } />
        <Route path="/platform/organizations" element={
          <PlatformProtectedRoute>
            <PageTransition><Organizations /></PageTransition>
          </PlatformProtectedRoute>
        } />
        <Route path="/platform/organizations/:id" element={
          <PlatformProtectedRoute>
            <PageTransition><OrganizationDetail /></PageTransition>
          </PlatformProtectedRoute>
        } />
        <Route path="/platform/analytics" element={
          <PlatformProtectedRoute>
            <PageTransition><PlatformAnalytics /></PageTransition>
          </PlatformProtectedRoute>
        } />
        <Route path="/platform/settings" element={
          <PlatformProtectedRoute>
            <PageTransition><PlatformSettings /></PageTransition>
          </PlatformProtectedRoute>
        } />

        {/* Fallbacks */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <WorkspaceProvider>
          <PermissionProvider>
            <DepartmentProvider>
              <EmployeeProvider>
                <BrowserRouter>
                  <AnimatedRoutes />
                </BrowserRouter>
              </EmployeeProvider>
            </DepartmentProvider>
          </PermissionProvider>
        </WorkspaceProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;