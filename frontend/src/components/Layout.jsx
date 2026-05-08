import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const NAV = [
  { section: 'Overview' },
  { to: '/',           label: 'Dashboard',       icon: '📊' },
  { section: 'Finance' },
  { to: '/partners',   label: 'Capital & Partners', icon: '🤝' },
  { to: '/expenses',   label: 'Expenses',         icon: '🧾' },
  { section: 'Inventory' },
  { to: '/purchases',  label: 'Purchases',        icon: '📦' },
  { to: '/stock',      label: 'Stock',            icon: '🏭' },
  { section: 'Production' },
  { to: '/production', label: 'Production Log',   icon: '✂️' },
  { to: '/staff',      label: 'Staff & Payroll',  icon: '👷' },
  { section: 'Admin' },
  { to: '/settings',   label: 'Settings',         icon: '⚙️' },
];

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get('/partners/reminders').then(r => {
      setReminderCount(r.data.filter(rem => !rem.is_resolved).length);
    }).catch(() => {});
  }, [user]);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="shell">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">🧵</div>
          <div>
            <div className="logo-text">Viva Studio</div>
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
            <div className="s-role" style={{ textTransform: 'capitalize' }}>{user?.role} · Full Access</div>
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
