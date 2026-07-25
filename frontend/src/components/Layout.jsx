import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const NAV_FULL = [
  { section: 'Overview' },
  { to: '/',           label: 'Dashboard',          icon: '📊' },
  { section: 'Finance' },
  { to: '/partners',   label: 'Capital & Partners', icon: '🤝' },
  { to: '/finance',    label: 'Finance',            icon: '📈' },
  { to: '/expenses',   label: 'Expenses',           icon: '🧾' },
  { section: 'Inventory' },
  { to: '/purchases',  label: 'Purchases',          icon: '📦' },
  { to: '/stock',      label: 'Stock',              icon: '🏭' },
  { section: 'Production & Sales' },
  { to: '/production', label: 'Production Log',     icon: '✂️' },
  { to: '/sales',      label: 'Sales',              icon: '🚚' },
  { to: '/staff',      label: 'Staff & Payroll',    icon: '👷' },
  { section: 'Admin' },
  { to: '/settings',   label: 'Settings',           icon: '⚙️' },
];

const NAV_STAFF_ADMIN = [
  { section: 'Staff' },
  { to: '/staff-log',  label: 'Staff',  icon: '👷' },
];

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    if (!user || user.role === 'staff_admin') return;
    api.get('/partners/reminders').then(r => {
      setReminderCount(r.data.filter(rem => !rem.is_resolved).length);
    }).catch(() => {});
  }, [user]);

  const isStaffAdmin = user?.role === 'staff_admin';
  const NAV = isStaffAdmin ? NAV_STAFF_ADMIN : NAV_FULL;

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="shell">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="logo">
          <img src="/logo.png" alt="Viva Studio" style={{ height: 38, width: 'auto', display: 'block' }} />
          <div>
            <div className="logo-text" style={{ background: 'linear-gradient(135deg,#FFE87A,#C8860A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Viva Studio</div>
            <div className="logo-sub">ERP Platform</div>
          </div>
        </div>

        <div className="tenant-bar">
          <div className="tenant-icon">🏭</div>
          <div>
            <div className="tenant-name">{user?.tenant_name || 'Viva Studio'}</div>
            <div className="tenant-sub">Active Workspace</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item, i) => {
            if (item.section) {
              return <div key={i} className="nav-section">{item.section}</div>;
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <span className="ni">{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="s-avatar">{initials}</div>
          <div>
            <div className="s-name">{user?.name}</div>
            <div className="s-role" style={{ textTransform: 'capitalize' }}>
            {user?.role === 'staff_admin' ? 'Staff Admin' : `${user?.role} · Full Access`}
          </div>
          </div>
          <button
            className="s-logout"
            onClick={() => { logout(); navigate('/login'); }}
          >
            Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="main">
        <div className="topbar">
          <div className="page-title">{title}</div>
          <div className="topbar-actions">
            {reminderCount > 0 && (
              <div className="chip chip-yellow" onClick={() => navigate('/partners')} style={{ cursor: 'pointer' }}>
                ⏰ {reminderCount} Reminder{reminderCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}
