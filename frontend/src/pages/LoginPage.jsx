import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function LoginPage() {
  const [tenants, setTenants]   = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login, user }         = useAuth();
  const navigate                = useNavigate();
  const location                = useLocation();

  const [tenantsLoading, setTenantsLoading] = useState(true);

  const loadTenants = (selectSlugOrId) => {
    setTenantsLoading(true);
    api.get('/auth/tenants').then(r => {
      setTenants(r.data);
      if (selectSlugOrId) {
        const found = r.data.find(t => String(t.id) === String(selectSlugOrId) || t.slug === selectSlugOrId);
        if (found) setTenantId(String(found.id));
      } else if (r.data.length >= 1) {
        setTenantId(String(r.data[0].id));
      }
    }).catch(() => {}).finally(() => setTenantsLoading(false));
  };

  useEffect(() => {
    if (user) navigate('/');
    
    // Check if redirected from /onboard with state
    if (location.state?.msg) {
      setSuccessMsg(location.state.msg);
      if (location.state.registeredEmail) setEmail(location.state.registeredEmail);
      loadTenants(location.state.selectedSlug);
    } else {
      loadTenants();
    }
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!tenantId) { setError('Please select a workspace'); return; }
    setLoading(true);
    try {
      await login(email, password, tenantId);
      navigate('/');
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
          <div className="field" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ margin: 0 }}>Company Workspace</label>
              <Link
                to="/onboard"
                style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
              >
                + New Workspace
              </Link>
            </div>
            {tenantsLoading ? (
              <select disabled><option>Loading workspaces…</option></select>
            ) : (
              <select value={tenantId} onChange={e => setTenantId(e.target.value)} required>
                {tenants.length > 1 && <option value="">— Select workspace —</option>}
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.country ? `(${t.country === 'SA' ? '🇸🇦 KSA' : t.country === 'IN' ? '🇮🇳 IN' : t.country})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@company.com"
              required autoFocus
            />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Password</label>
            <input
              type="password" value={password}
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

        <div className="divider" style={{ marginTop: 20 }} />

        {/* Public Catalogs & Rate Lists for Vendors & Customers */}
        <div style={{ marginTop: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>
            🌟 Explore Product Catalogs &amp; Rates
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link
              to={`/catalog/wholesale${tenantId ? `?tenant=${tenantId}` : ''}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, background: '#f0f9ff',
                border: '1.5px solid #bae6fd', color: '#0369a1', textDecoration: 'none',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 16 }}>🏢</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#0369a1' }}>Wholesale Vendor Catalog</div>
                  <div style={{ fontSize: 10, color: '#0284c7' }}>Exclusive bulk supply rates</div>
                </div>
              </div>
              <span style={{ fontSize: 13, color: '#0284c7' }}>➔</span>
            </Link>

            <Link
              to={`/catalog/retail-vendor${tenantId ? `?tenant=${tenantId}` : ''}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, background: '#f5f3ff',
                border: '1.5px solid #ddd6fe', color: '#4338ca', textDecoration: 'none',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 16 }}>🏪</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#4338ca' }}>Retail Vendor Catalog</div>
                  <div style={{ fontSize: 10, color: '#6366f1' }}>Commercial dealer &amp; shop rates</div>
                </div>
              </div>
              <span style={{ fontSize: 13, color: '#6366f1' }}>➔</span>
            </Link>

            <Link
              to={`/catalog/retail-customer${tenantId ? `?tenant=${tenantId}` : ''}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, background: '#fffbeb',
                border: '1.5px solid #fde68a', color: '#b45309', textDecoration: 'none',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 16 }}>🛍️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#b45309' }}>Retail Customer / Online</div>
                  <div style={{ fontSize: 10, color: '#d97706' }}>Seasonal designs &amp; consumer pricing</div>
                </div>
              </div>
              <span style={{ fontSize: 13, color: '#d97706' }}>➔</span>
            </Link>
          </div>
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
