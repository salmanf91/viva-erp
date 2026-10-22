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
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      // If user came with a redirect parameter
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      navigate(redirect || '/');
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
      navigate(redirect || '/');
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
    </div>
  );
}
