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
import SettingsPage   from './pages/SettingsPage';

const TITLES = {
  '/':           'Dashboard',
  '/partners':   'Capital & Partners',
  '/purchases':  'Purchases',
  '/expenses':   'Expenses',
  '/production': 'Production Log',
  '/stock':      'Stock',
  '/staff':      'Staff & Payroll',
  '/settings':   'Settings',
};

function Guard({ children, path }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout title={TITLES[path] || ''}>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/"           element={<Guard path="/"><DashboardPage /></Guard>} />
          <Route path="/partners"   element={<Guard path="/partners"><PartnersPage /></Guard>} />
          <Route path="/purchases"  element={<Guard path="/purchases"><PurchasesPage /></Guard>} />
          <Route path="/expenses"   element={<Guard path="/expenses"><ExpensesPage /></Guard>} />
          <Route path="/production" element={<Guard path="/production"><ProductionPage /></Guard>} />
          <Route path="/stock"      element={<Guard path="/stock"><StockPage /></Guard>} />
          <Route path="/staff"      element={<Guard path="/staff"><StaffPage /></Guard>} />
          <Route path="/settings"   element={<Guard path="/settings"><SettingsPage /></Guard>} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
