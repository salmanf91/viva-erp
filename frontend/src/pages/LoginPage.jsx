import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [showWorkspaceField, setShowWorkspaceField] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScreenModal, setShowScreenModal] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      if (redirect && redirect.startsWith('/catalog/')) {
        navigate(redirect);
      } else {
        setShowScreenModal(true);
      }
    }

    // Check if redirected from /onboard with state
    if (location.state?.msg) {
      setSuccessMsg(location.state.msg);
      if (location.state.registeredEmail) setEmail(location.state.registeredEmail);
      if (location.state.selectedSlug) {
        setWorkspaceSlug(location.state.selectedSlug);
        setShowWorkspaceField(true);
      }
    }
  }, [user]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      // Auto-routes to the tenant's workspace based on email (Viva Studio by default)
      await login(email, password, workspaceSlug ? workspaceSlug.trim() : undefined);
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      if (redirect && redirect.startsWith('/catalog/')) {
        navigate(redirect);
      } else {
        setShowScreenModal(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <div className="li"><img src="/logo.png" alt="Viva Studio" style={{ height: 64, width: 'auto' }} /></div>
          <div className="ls">Enterprise ERP Platform · Sign in to continue</div>
        </div>

        {successMsg && (
          <div className="alert alert-green mb12">
            <div className="a-icon">✓</div>
            <div><div className="a-title">{successMsg}</div></div>
          </div>
        )}

        {error && (
          <div className="alert alert-red mb12">
            <div className="a-icon">⚠️</div>
            <div><div className="a-title">{error}</div></div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Workspace field (Hidden by default to protect tenant privacy and default to Viva Studio) */}
          {showWorkspaceField ? (
            <div className="field" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ margin: 0 }}>Company Workspace</label>
                <button
                  type="button"
                  onClick={() => { setShowWorkspaceField(false); setWorkspaceSlug(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}
                >
                  ✕ Use Default (Viva Studio)
                </button>
              </div>
              <input
                type="text"
                value={workspaceSlug}
                onChange={e => setWorkspaceSlug(e.target.value)}
                placeholder="e.g. viva_studio or company slug"
              />
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 11 }}>
              <span style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                🏢 Workspace: <strong style={{ color: 'var(--text)' }}>Viva Studio</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowWorkspaceField(true)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                Change Workspace
              </button>
            </div>
          )}

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email / Username</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@company.com"
              required
              autoFocus
            />
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px' }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="divider" style={{ marginTop: 20, marginBottom: 16 }} />

        {/* Exclusive UAE Vendor Catalog Link (Wholesale & Retail catalogs are protected behind authentication) */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>
            🇦🇪 Overseas Partner Showcase
          </div>

          <Link
            to="/catalog/uae-vendor"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8, background: '#ecfdf5',
              border: '1.5px solid #a7f3d0', color: '#065f46', textDecoration: 'none',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🇦🇪</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#065f46' }}>UAE Vendor Catalog</div>
                <div style={{ fontSize: 11, color: '#059669' }}>Exclusive export designs &amp; pricing in AED (Dirhams)</div>
              </div>
            </div>
            <span style={{ fontSize: 14, color: '#059669', fontWeight: 700 }}>➔</span>
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--muted)' }}>
          <Link to="/super-admin/login" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            🛡️ Platform Super Admin
          </Link>
          <Link
            to="/onboard"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}
          >
            🏢 Create Workspace
          </Link>
        </div>
      </div>

      {/* Screen Selection Modal (Pop-up after Login) */}
      {showScreenModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11, 15, 25, 0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#131b2e',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            maxWidth: 520,
            width: '100%',
            padding: '28px 24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
            textAlign: 'center',
            color: '#fff'
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👋</div>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              Welcome to Viva Studio
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.4 }}>
              Which screen would you like to open?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Option 1: Product Catalogs & Rate Lists */}
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('active_screen_mode', 'catalogs');
                  navigate('/catalogs');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                  border: '1.5px solid #6366f1',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <span style={{ fontSize: 32 }}>🏷️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Product Catalogs &amp; Rate Lists
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#10b981', color: '#fff', fontWeight: 700 }}>Client Safe</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#c7d2fe', marginTop: 4, lineHeight: 1.35 }}>
                    Wholesale, Retail Vendor, Customer, &amp; UAE rates. Dashboard financials &amp; accounts details remain strictly private.
                  </div>
                </div>
                <span style={{ fontSize: 20, color: '#a5b4fc', fontWeight: 800 }}>➔</span>
              </button>

              {/* Option 2: Full Enterprise ERP */}
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('active_screen_mode', 'erp');
                  const params = new URLSearchParams(location.search);
                  const redirect = params.get('redirect');
                  navigate(redirect || '/');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s, border-color 0.15s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.09)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }}
              >
                <span style={{ fontSize: 32 }}>🏭</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                    Enterprise ERP Workspace
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.35 }}>
                    Full ERP: Dashboard, Production Log, Inventory, Capital &amp; Partner Accounts, and Financial Reports.
                  </div>
                </div>
                <span style={{ fontSize: 20, color: '#64748b', fontWeight: 800 }}>➔</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
