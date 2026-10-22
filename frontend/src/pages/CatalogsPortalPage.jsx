import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CatalogsPortalPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [copiedTier, setCopiedTier] = useState(null);

  if (loading) return <div className="spinner">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const isVivaStudio = !user?.tenant_id || user?.tenant_id === 'viva-studio' || user?.tenant_name?.toLowerCase().includes('viva');

  const copyLink = (type) => {
    const origin = window.location.origin;
    const url = `${origin}/catalog/${type}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTier(type);
      setTimeout(() => setCopiedTier(null), 2200);
    });
  };

  const handleEnterErp = () => {
    sessionStorage.setItem('active_screen_mode', 'erp');
    navigate('/');
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('active_screen_mode');
    await logout();
    navigate('/login');
  };

  const catalogTiers = [
    {
      id: 'wholesale',
      title: 'Wholesale Partner Catalog',
      subtitle: 'Exclusive bulk rates for distributors, wholesalers, and retail merchants.',
      badge: '🏢 Wholesale Pricing',
      currency: 'INR (₹)',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      accent: '#0284c7',
      isExport: false,
    },
    {
      id: 'retail-vendor',
      title: 'Retail Vendor Catalog',
      subtitle: 'Commercial rates for boutique owners, shops, and retail dealers.',
      badge: '🏪 Retail Vendor Pricing',
      currency: 'INR (₹)',
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      accent: '#6366f1',
      isExport: false,
    },
    {
      id: 'retail-customer',
      title: 'Retail & Customer Collection',
      subtitle: 'Direct customer catalog with current designs and seasonal releases.',
      badge: '🛍️ Retail Collection',
      currency: 'INR (₹)',
      gradient: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
      accent: '#d97706',
      isExport: false,
    },
    ...(isVivaStudio ? [{
      id: 'uae-vendor',
      title: 'UAE Wholesale & Export Catalog',
      subtitle: 'Exclusive export collection and pricing in Dirhams (AED) for UAE merchants.',
      badge: '🇦🇪 UAE Vendor Pricing',
      currency: 'AED (Dirhams)',
      gradient: 'linear-gradient(135deg, #064e3b 0%, #0f766e 100%)',
      accent: '#10b981',
      isExport: true,
    }] : [])
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Bar */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          {/* Logo & Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.png" alt="Viva Studio" style={{ height: 42, width: 'auto' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                Viva Studio
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                  Catalog Portal
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Secure Product Catalogs &amp; Rate Lists
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user && (
              <button
                onClick={handleEnterErp}
                className="btn btn-sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="Switch to Full Enterprise ERP System"
              >
                <span>⚙️</span> Switch to ERP System
              </button>
            )}

            <button
              onClick={handleLogout}
              className="btn btn-sm btn-ghost"
              style={{
                color: '#ef4444',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                cursor: 'pointer'
              }}
            >
              Sign Out ➔
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '36px 20px 48px' }}>
        {/* Welcome Banner */}
        <div style={{
          textAlign: 'center',
          marginBottom: 36,
          background: 'radial-gradient(ellipse at center, rgba(30, 27, 75, 0.5) 0%, rgba(11, 15, 25, 0) 70%)',
          padding: '24px 16px'
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#818cf8',
            marginBottom: 8,
            display: 'inline-block'
          }}>
            Client &amp; Vendor Rate Showcase
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 10px', color: '#fff', letterSpacing: '-0.02em' }}>
            Product Catalogs &amp; Rate Lists
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, maxWidth: 620, margin: '0 auto', lineHeight: 1.5 }}>
            Access design catalogues with dedicated wholesale, retail, and international rates. Choose a tier below to view live collections.
          </p>
        </div>

        {/* 4 Catalog Tier Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: 20
        }}>
          {catalogTiers.map(tier => {
            const isCopied = copiedTier === tier.id;
            return (
              <div
                key={tier.id}
                style={{
                  background: '#131b2e',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
                }}
              >
                {/* Card Header */}
                <div style={{
                  background: tier.gradient,
                  padding: '24px 20px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      backdropFilter: 'blur(8px)'
                    }}>
                      {tier.badge}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: tier.accent,
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '3px 8px',
                      borderRadius: 6
                    }}>
                      {tier.currency}
                    </span>
                  </div>

                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
                    {tier.title}
                  </h3>
                </div>

                {/* Card Body */}
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, margin: '0 0 20px' }}>
                    {tier.subtitle}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* View Catalog Button */}
                    <Link
                      to={`/catalog/${tier.id}`}
                      target="_blank"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '10px 16px',
                        borderRadius: 8,
                        background: tier.accent,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                        transition: 'opacity 0.15s'
                      }}
                      onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseOut={e => e.currentTarget.style.opacity = '1'}
                    >
                      <span>Open Catalog</span>
                      <span>↗</span>
                    </Link>

                    {/* Copy Share Link Button */}
                    <button
                      onClick={() => copyLink(tier.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 8,
                        background: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: isCopied ? '#34d399' : '#cbd5e1',
                        border: isCopied ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>{isCopied ? '✓' : '📋'}</span>
                      <span>{isCopied ? 'Link Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Privacy & Confidentiality Guarantee Notice */}
        <div style={{
          marginTop: 40,
          padding: '16px 20px',
          background: 'rgba(30, 41, 59, 0.4)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#94a3b8',
          fontSize: 12
        }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <div>
            <strong style={{ color: '#e2e8f0' }}>Privacy &amp; Security Mode Active:</strong> Dashboard financials, bank ledger, expense records, partner capital, and production logs are kept strictly private on this screen.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '20px',
        fontSize: 12,
        color: '#64748b',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        © {new Date().getFullYear()} Viva Studio · All rights reserved.
      </footer>
    </div>
  );
}
