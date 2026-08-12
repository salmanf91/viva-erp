import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage      from './pages/LoginPage';
import DashboardPage  from './pages/DashboardPage';
import PartnersPage   from './pages/PartnersPage';
import PurchasesPage  from './pages/PurchasesPage';
import ExpensesPage   from './pages/ExpensesPage';
import ProductionPage from './pages/ProductionPage';
import StockPage      from './pages/StockPage';
import StaffPage      from './pages/StaffPage';
import StaffLogPage   from './pages/StaffLogPage';
import SettingsPage   from './pages/SettingsPage';
import SalesPage      from './pages/SalesPage';
import FinancePage    from './pages/FinancePage';
import PartyLedgerPage from './pages/PartyLedgerPage';

const TITLES = {
  '/':           'Dashboard',
  '/partners':   'Capital & Partners',
  '/purchases':  'Purchases',
  '/expenses':   'Expenses',
  '/production': 'Production Log',
  '/stock':      'Stock',
  '/sales':      'Sales',
  '/staff':      'Staff & Payroll',
  '/staff-log':  'Staff',
  '/finance':    'Finance',
  '/settings':   'Settings',
  '/party-ledger': 'Party Ledger',
};

function Guard({ children, path, staffAdminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner">Loading…</div>;
  if (!user)   return <Navigate to="/login" replace />;

  const isStaffAdmin = user.role === 'staff_admin';

  // Staff admin trying to reach an owner/manager page → back to their log
  if (isStaffAdmin && !staffAdminOnly) return <Navigate to="/staff-log" replace />;

  // Owner/manager trying to reach a staff-admin-only page → back to dashboard
  if (!isStaffAdmin && staffAdminOnly) return <Navigate to="/" replace />;

  return <Layout title={TITLES[path] || ''}>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Owner / partner / manager routes */}
          <Route path="/"           element={<Guard path="/"><DashboardPage /></Guard>} />
          <Route path="/partners"   element={<Guard path="/partners"><PartnersPage /></Guard>} />
          <Route path="/purchases"  element={<Guard path="/purchases"><PurchasesPage /></Guard>} />
          <Route path="/expenses"   element={<Guard path="/expenses"><ExpensesPage /></Guard>} />
          <Route path="/production" element={<Guard path="/production"><ProductionPage /></Guard>} />
          <Route path="/stock"      element={<Guard path="/stock"><StockPage /></Guard>} />
          <Route path="/sales"      element={<Guard path="/sales"><SalesPage /></Guard>} />
          <Route path="/staff"      element={<Guard path="/staff"><StaffPage /></Guard>} />
          <Route path="/finance"    element={<Guard path="/finance"><FinancePage /></Guard>} />
          <Route path="/settings"   element={<Guard path="/settings"><SettingsPage /></Guard>} />
          <Route path="/party-ledger" element={<Guard path="/party-ledger"><PartyLedgerPage /></Guard>} />

          {/* Staff admin routes */}
          <Route path="/staff-log"  element={<Guard path="/staff-log" staffAdminOnly><StaffLogPage /></Guard>} />
          <Route path="/staff-dir"  element={<Navigate to="/staff-log" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
