import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function LoginPage() {
  const [tenants, setTenants]   = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login, user }         = useAuth();
  const navigate                = useNavigate();

  const [tenantsLoading, setTenantsLoading] = useState(true);

  useEffect(() => {
    if (user) navigate('/');
    api.get('/auth/tenants').then(r => {
      setTenants(r.data);
      if (r.data.length >= 1) setTenantId(String(r.data[0].id));
    }).catch(() => {}).finally(() => setTenantsLoading(false));
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
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
          <div className="ls">Manufacturing ERP · Sign in to continue</div>
        </div>

        {error && (
          <div className="alert alert-red mb12">
            <div className="a-icon">⚠️</div>
            <div><div className="a-title">{error}</div></div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Workspace</label>
            {tenantsLoading ? (
              <select disabled><option>Loading…</option></select>
            ) : (
              <select value={tenantId} onChange={e => setTenantId(e.target.value)} required>
                {tenants.length > 1 && <option value="">— Select workspace —</option>}
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="partner_a@vivastudio.com"
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
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>
          Viva Studio · Multi-Tenant Manufacturing Platform
        </div>
      </div>
    </div>
  );
}
