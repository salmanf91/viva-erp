import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

function getNavItems(user) {
  if (user?.role === 'super_admin') {
    return [
      { section: 'Platform Management' },
      { to: '/platform-tenants', label: 'Workspaces & Tenants', icon: '🏢' },
      { to: '/onboard', label: 'Onboard New Tenant', icon: '➕' },
    ];
  }

  if (user?.role === 'staff_admin') {
    return [
      { section: 'Staff' },
      { to: '/staff-log', label: 'Staff', icon: '👷' },
    ];
  }

  const m = user?.modules || {
    feature_accounting: true,
    feature_expenses: true,
    feature_party_ledger: true,
    feature_sales_invoicing: true,
    feature_purchases: true,
    feature_inventory_stock: true,
    feature_garment_production: true,
    feature_staff_piece_log: true,
    feature_payroll: true,
    feature_zatca_einvoicing: false,
  };

  const nav = [];

  // Overview Section
  nav.push({ section: 'Overview' });
  nav.push({ to: '/', label: 'Dashboard', icon: '📊' });
  nav.push({ to: '/reports', label: 'Reports & Analytics', icon: '📑' });

  // Finance Section
  const financeItems = [];
  if (m.feature_accounting || m.feature_expenses) financeItems.push({ to: '/partners', label: 'Capital & Partners', icon: '🤝' });
  if (m.feature_accounting) financeItems.push({ to: '/finance', label: 'Finance', icon: '📈' });
  if (m.feature_expenses) financeItems.push({ to: '/expenses', label: 'Expenses', icon: '🧾' });
  if (m.feature_party_ledger) financeItems.push({ to: '/party-ledger', label: 'Party Ledger', icon: '📒' });
  if (financeItems.length > 0) {
    nav.push({ section: 'Finance' }, ...financeItems);
  }

  // Catalog & Inventory
  const inventoryItems = [];
  inventoryItems.push({ to: '/items', label: 'Items & Products', icon: '📦' });
  if (m.feature_purchases) inventoryItems.push({ to: '/purchases', label: 'Purchases', icon: '🛒' });
  if (m.feature_inventory_stock) inventoryItems.push({ to: '/stock', label: 'Stock', icon: '🏭' });
  if (inventoryItems.length > 0) {
    nav.push({ section: 'Catalog & Inventory' }, ...inventoryItems);
  }

  // Operations / Sales / Production
  const opItems = [];
  if (m.feature_quotations) opItems.push({ to: '/quotations', label: 'Quotations', icon: '📄' });
  if (m.feature_sales_invoicing) opItems.push({ to: '/sales', label: 'Sales', icon: '🚚' });
  if (m.feature_delivery_notes) opItems.push({ to: '/delivery-notes', label: 'Delivery Notes', icon: '📦' });
  if (m.feature_garment_production) opItems.push({ to: '/production', label: 'Production Log', icon: '✂️' });
  if (m.feature_staff_piece_log || m.feature_payroll) opItems.push({ to: '/staff-log', label: 'Daily Work Log', icon: '📋' });
  if (m.feature_payroll) opItems.push({ to: '/staff', label: 'Staff & Payroll', icon: '👷' });
  if (opItems.length > 0) {
    nav.push({ section: m.feature_garment_production ? 'Production & Sales' : 'Operations & Sales' }, ...opItems);
  }

  // Saudi ZATCA E-Invoicing
  if (m.feature_zatca_einvoicing) {
    nav.push({ section: 'E-Invoicing' });
    nav.push({ to: '/zatca', label: 'ZATCA Fatoora', icon: '🇸🇦' });
  }

  // Super Admin / Multi-Tenant Platform Management
  if (user?.is_super_admin || user?.role === 'super_admin') {
    nav.push({ section: 'Super Admin' });
    nav.push({ to: '/platform-tenants', label: 'Platform Tenants', icon: '🛡️' });
  }

  // Settings Section
  nav.push({ section: 'Preferences' });
  nav.push({ to: '/settings', label: 'Settings', icon: '⚙️' });

  return nav;
}

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [reminderCount, setReminderCount] = useState(0);
  const [activeSectionMenu, setActiveSectionMenu] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'staff_admin') return;
    api.get('/partners/reminders').then(r => {
      setReminderCount(r.data.filter(rem => !rem.is_resolved).length);
    }).catch(() => {});
  }, [user]);

  // Reset active section menu and drawer on path change
  useEffect(() => {
    setActiveSectionMenu(null);
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const NAV = getNavItems(user);

  // Process sections for mobile bottom navigation
  const sections = [];
  let currentSection = null;

  NAV.forEach(item => {
    if (item.section) {
      let icon = '📂';
      if (item.section === 'Overview') icon = '📊';
      else if (item.section === 'Finance') icon = '📈';
      else if (item.section === 'Inventory') icon = '📦';
      else if (item.section === 'Production & Sales') icon = '✂️';
      else if (item.section === 'Admin') icon = '⚙️';
      else if (item.section === 'Staff') icon = '👷';

      currentSection = { name: item.section, icon, items: [] };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.items.push(item);
    }
  });

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const handleSectionClick = (sectionName) => {
    if (activeSectionMenu === sectionName) {
      setActiveSectionMenu(null);
    } else {
      setActiveSectionMenu(sectionName);
    }
  };

  return (
    <div className="shell">
      {/* ── MOBILE BACKDROP OVERLAY ── */}
      {mobileSidebarOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR (Desktop permanent + Mobile slide-out drawer) ── */}
      <aside className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="logo" style={{ position: 'relative' }}>
          {user?.role === 'super_admin' ? (
            <div style={{ width: 38, height: 38, borderRadius: 8, background: 'linear-gradient(135deg,#FFE87A,#C8860A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              🛡️
            </div>
          ) : user?.logo_url ? (
            <img src={user.logo_url} alt={user?.tenant_name || 'Logo'} style={{ height: 38, maxWidth: 44, objectFit: 'contain', display: 'block', borderRadius: 6 }} />
          ) : (
            <img src="/logo.png" alt="Viva Studio" style={{ height: 38, width: 'auto', display: 'block' }} />
          )}
          <div style={{ flex: 1 }}>
            <div className="logo-text" style={{ background: 'linear-gradient(135deg,#FFE87A,#C8860A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {user?.role === 'super_admin' ? 'Platform Admin' : (user?.tenant_name || 'Viva Studio')}
            </div>
            <div className="logo-sub">{user?.role === 'super_admin' ? 'SaaS System Console' : 'ERP Platform'}</div>
          </div>
          {mobileSidebarOpen && (
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="mobile-close-drawer-btn"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="tenant-bar">
          <div className="tenant-icon">{user?.role === 'super_admin' ? '🌐' : (user?.country === 'SA' ? '🇸🇦' : user?.country === 'AE' ? '🇦🇪' : '🏭')}</div>
          <div>
            <div className="tenant-name">{user?.role === 'super_admin' ? 'Multi-Tenant Infrastructure' : (user?.tenant_name || 'Viva Studio')}</div>
            <div className="tenant-sub">{user?.role === 'super_admin' ? 'Root Platform Scope' : (`${user?.currency ? `${user.currency} · ` : ''}Active Workspace`)}</div>
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
                onClick={() => setMobileSidebarOpen(false)}
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

      {/* ── MAIN CONTENT ── */}
      <div className="main">
        <div className="topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open Navigation Menu"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                color: 'var(--text)',
                cursor: 'pointer',
                padding: '6px 8px',
                display: 'none', // Controlled via CSS media queries
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px'
              }}
            >
              ☰
            </button>
            {activeSectionMenu && (
              <button 
                className="mobile-back-btn" 
                onClick={() => setActiveSectionMenu(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '15px',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  display: 'none', // Shown only in CSS media query
                }}
              >
                ← Back
              </button>
            )}
            <div className="page-title">{activeSectionMenu ? activeSectionMenu : title}</div>
          </div>
          <div className="topbar-actions">
            {reminderCount > 0 && (
              <div className="chip chip-yellow" onClick={() => navigate('/partners')} style={{ cursor: 'pointer' }}>
                ⏰ {reminderCount}
              </div>
            )}
            <div 
              className="mobile-user-badge" 
              onClick={() => { if(window.confirm('Logout?')) { logout(); navigate('/login'); } }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                display: 'none', // Shown only in CSS media query
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {initials}
            </div>
          </div>
        </div>

        <div className="content">
          {activeSectionMenu ? (
            /* ── MOBILE SECTION MENU VIEW (BOX TYPE LINKS) ── */
            <div className="section-menu-container">
              <h2 className="section-menu-title" style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'var(--muted)' }}>Select an Option</h2>
              <div className="section-menu-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                {sections.find(s => s.name === activeSectionMenu)?.items.map((subItem) => (
                  <button
                    key={subItem.to}
                    className="box-menu-item"
                    onClick={() => {
                      navigate(subItem.to);
                      setActiveSectionMenu(null);
                    }}
                    style={{
                      background: 'var(--white)',
                      border: '1.5px solid var(--border)',
                      borderRadius: '12px',
                      padding: '24px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow)',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <span className="box-menu-icon" style={{ fontSize: '28px' }}>{subItem.icon}</span>
                    <span className="box-menu-label" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{subItem.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </div>

      {/* ── MOBILE BOTTOM BAR ── */}
      <div className="mobile-bottom-nav" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'var(--white)',
        borderTop: '1px solid var(--border)',
        display: 'none', // Shown only in CSS media query
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.04)'
      }}>
        {sections.map((sec) => (
          <button
            key={sec.name}
            className={`mobile-nav-btn ${activeSectionMenu === sec.name ? 'active' : ''}`}
            onClick={() => handleSectionClick(sec.name)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              color: activeSectionMenu === sec.name ? 'var(--accent)' : 'var(--muted)',
              cursor: 'pointer',
              flex: 1,
              height: '100%'
            }}
          >
            <span className="mobile-nav-icon" style={{ fontSize: '20px' }}>{sec.icon}</span>
            <span className="mobile-nav-label" style={{ fontSize: '10px', fontWeight: '600' }}>{sec.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
