import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuthStore } from '@store/auth.store';
import { useClientStore } from '@store/client.store';
import { useQuery } from '@tanstack/react-query';
import Layout from '@comps/layout/Layout';
import ClientLayout from '@comps/layout/ClientLayout';

// Auth pages
import Login from '@pages/Auth/Login';

// SuperAdmin pages
import SuperAdminLogin      from '@pages/Superadmin/Login';
import { SuperAdminLayout } from '@pages/Superadmin/SuperAdminLayout';
const SuperAdminDashboard = lazy(() => import('@pages/Superadmin/Dashboard'));
const SuperAdminTenants   = lazy(() => import('@pages/Superadmin/Tenants'));

// Client portal pages
import ClientLogin     from '@pages/Client/Login';
const ClientDashboard  = lazy(() => import('@pages/Client/Dashboard'));
const ClientPolicies   = lazy(() => import('@pages/Client/Policies'));
const ClientClaims     = lazy(() => import('@pages/Client/Claims'));
const ClientProfile    = lazy(() => import('@pages/Client/Profile'));

// Feature pages (lazy-loaded)
const Dashboard      = lazy(() => import('@pages/Dashboard'));
const Workspace      = lazy(() => import('@pages/Workspace'));
const Contacts       = lazy(() => import('@pages/Contacts'));
const ContactDetail  = lazy(() => import('@pages/Contacts/ContactDetail'));
const Leads          = lazy(() => import('@pages/Leads'));
const LeadDetail     = lazy(() => import('@pages/Leads/LeadDetail'));
const Policies       = lazy(() => import('@pages/Policies'));
const PolicyDetail   = lazy(() => import('@pages/Policies/PolicyDetail'));
const Claims         = lazy(() => import('@pages/Claims'));
const ClaimDetail    = lazy(() => import('@pages/Claims/ClaimDetail'));
const Employees        = lazy(() => import('@pages/Employees'));
const EmployeesLayout  = lazy(() => import('@pages/Employees/EmployeesLayout'));
const EmployeeEod      = lazy(() => import('@pages/Employees/EodReports'));
const EmployeeAccess   = lazy(() => import('@pages/Employees/AccessControl'));
const EmployeeDetail   = lazy(() => import('@pages/Employees/EmployeeDetail'));
const Commissions    = lazy(() => import('@pages/Commissions'));
const Calendar       = lazy(() => import('@pages/Calendar'));
const Settings       = lazy(() => import('@pages/Settings'));
const Insurance      = lazy(() => import('@pages/Insurance'));
const Documents      = lazy(() => import('@pages/Documents'));
const DeletionRequests = lazy(() => import('@pages/DeletionRequests'));
const GlobalSearch   = lazy(() => import('@pages/Search'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.accessToken);
  const user = useAuthStore(s => s.user);
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role === 'CONTACT') return <Navigate to="/client/dashboard" replace />;
  return <>{children}</>;
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'CONTACT') return <Navigate to="/client/dashboard" replace />;
  if (user.role === 'EMPLOYEE') return <Navigate to="/workspace" replace />;
  if (user.role !== 'OWNER' && user.role !== 'SUPERADMIN') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOrAuthorizedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'CONTACT') return <Navigate to="/client/dashboard" replace />;
  if (user.role === 'OWNER' || user.role === 'SUPERADMIN') return <>{children}</>;
  if (user.role === 'EMPLOYEE') {
    const perms: string[] = (user as any)?.permissions || [];
    if (!permission || perms.includes(permission) || perms.includes('manage_employees') || perms.includes('view_employees')) {
      return <>{children}</>;
    }
  }
  return <Navigate to="/workspace" replace />;
}

function PlanProtectedRoute({ children }: { children: React.ReactNode; feature?: string }) {
  return <>{children}</>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const clientToken = useClientStore(s => s.accessToken);
  const authUser = useAuthStore(s => s.user);
  const authRole = authUser?.role;
  if (clientToken || authRole === 'CONTACT' || authRole === 'OWNER' || authRole === 'SUPERADMIN' || authRole === 'EMPLOYEE') {
    return <>{children}</>;
  }
  return <Navigate to="/login" replace />;
}

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

function IndexRedirect() {
  const user = useAuthStore(s => s.user);

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'CONTACT') {
    return <Navigate to="/client/dashboard" replace />;
  }

  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/superadmin" replace />;
  }

  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.role === 'EMPLOYEE') {
    return <Navigate to="/workspace" replace />;
  }

  return <Navigate to="/workspace" replace />;
}

import { tableVisibilityManager } from './utils/TableVisibilityManager';
import { useEffect } from 'react';
import { insuranceService } from './services';

function TableVisibilityInitializer() {
  const token = useAuthStore(s => s.accessToken);
  
  const { data } = useQuery({
    queryKey: ['table-columns'],
    queryFn: () => insuranceService.getTableColumnVisibility(),
    enabled: !!token,
    staleTime: 0,
  });

  useEffect(() => {
    tableVisibilityManager.init();
  }, []);

  useEffect(() => {
    if (data?.data) {
      tableVisibilityManager.setRules(data.data);
    }
  }, [data]);
  
  return null;
}

export default function App() {
  return (
    <>
      <TableVisibilityInitializer />
      <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* SuperAdmin */}
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route path="/superadmin" element={<SuperAdminLayout />}>
        <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<Loader />}><SuperAdminDashboard /></Suspense>} />
        <Route path="tenants"   element={<Suspense fallback={<Loader />}><SuperAdminTenants /></Suspense>} />
        <Route path="deletion-requests" element={<Suspense fallback={<Loader />}><DeletionRequests /></Suspense>} />
      </Route>

      {/* Client Portal */}
      <Route path="/client/login" element={<Navigate to="/login" replace />} />
      <Route
        path="/client"
        element={<ClientRoute><ClientLayout /></ClientRoute>}
      >
        <Route index element={<Navigate to="/client/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<Loader />}><ClientDashboard /></Suspense>} />
        <Route path="policies"  element={<Suspense fallback={<Loader />}><ClientPolicies /></Suspense>} />
        <Route path="policies/:id" element={<Suspense fallback={<Loader />}><ClientPolicies /></Suspense>} />
        <Route path="claims"    element={<Suspense fallback={<Loader />}><ClientClaims /></Suspense>} />
        <Route path="profile"   element={<Suspense fallback={<Loader />}><ClientProfile /></Suspense>} />
      </Route>

      {/* Protected */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<IndexRedirect />} />
        <Route path="dashboard"    element={<OwnerRoute><PlanProtectedRoute feature="dashboard"><Suspense fallback={<Loader />}><Dashboard /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="workspace"    element={<PlanProtectedRoute feature="workspace"><Suspense fallback={<Loader />}><Workspace /></Suspense></PlanProtectedRoute>} />
        <Route path="contacts"     element={<Suspense fallback={<Loader />}><Contacts /></Suspense>} />
        <Route path="contacts/:id" element={<Suspense fallback={<Loader />}><ContactDetail /></Suspense>} />
        <Route path="leads"        element={<PlanProtectedRoute feature="leads"><Suspense fallback={<Loader />}><Leads /></Suspense></PlanProtectedRoute>} />
        <Route path="leads/:id"    element={<PlanProtectedRoute feature="leads"><Suspense fallback={<Loader />}><LeadDetail /></Suspense></PlanProtectedRoute>} />
        <Route path="policies"     element={<Suspense fallback={<Loader />}><Policies /></Suspense>} />
        <Route path="emi-tracking" element={<Suspense fallback={<Loader />}><Policies /></Suspense>} />
        <Route path="policies/:id" element={<Suspense fallback={<Loader />}><PolicyDetail /></Suspense>} />
        <Route path="claims"       element={<Suspense fallback={<Loader />}><Claims /></Suspense>} />
        <Route path="claims/:id"   element={<Suspense fallback={<Loader />}><ClaimDetail /></Suspense>} />
        <Route
          path="employees/*"
          element={
            <AdminOrAuthorizedRoute permission="manage_employees">
              <PlanProtectedRoute feature="employees">
                <Suspense fallback={<Loader />}><EmployeesLayout /></Suspense>
              </PlanProtectedRoute>
            </AdminOrAuthorizedRoute>
          }
        >
          <Route index                element={<Suspense fallback={<Loader />}><Employees /></Suspense>} />
          <Route path="targets"        element={<Navigate to="/employees" replace />} />
          <Route path="attendance"     element={<Navigate to="/employees" replace />} />
          <Route path="eod-reports"    element={<Suspense fallback={<Loader />}><EmployeeEod /></Suspense>} />
          <Route path="access-control" element={<Suspense fallback={<Loader />}><EmployeeAccess /></Suspense>} />
          <Route path="job-descriptions" element={<Navigate to="/employees" replace />} />
        </Route>
        <Route path="employees/:id" element={<AdminOrAuthorizedRoute permission="manage_employees"><PlanProtectedRoute feature="employees"><Suspense fallback={<Loader />}><EmployeeDetail /></Suspense></PlanProtectedRoute></AdminOrAuthorizedRoute>} />
        <Route path="commissions"  element={<OwnerRoute><PlanProtectedRoute feature="commissions"><Suspense fallback={<Loader />}><Commissions /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        {/* <Route path="calendar"     element={<Suspense fallback={<Loader />}><Calendar /></Suspense>} /> */}
        <Route path="settings"     element={<OwnerRoute><Suspense fallback={<Loader />}><Settings /></Suspense></OwnerRoute>} />
        <Route path="firm-profile" element={<Navigate to="/dashboard" replace />} />
        <Route path="subscription" element={<Navigate to="/dashboard" replace />} />
        <Route path="operations"   element={<OwnerRoute><PlanProtectedRoute feature="operations"><Suspense fallback={<Loader />}><Insurance /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="documents"    element={<OwnerRoute><PlanProtectedRoute feature="documents"><Suspense fallback={<Loader />}><Documents /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="search"       element={<OwnerRoute><Suspense fallback={<Loader />}><GlobalSearch /></Suspense></OwnerRoute>} />
        <Route path="deletion-requests" element={<Navigate to="/operations?tab=delete_requests" replace />} />
      </Route>

      <Route path="*" element={<IndexRedirect />} />
    </Routes>
    </>
  );
}



