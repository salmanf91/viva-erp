import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SuperAdminLoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { superAdminLogin, user } = useAuth();
  const navigate                = useNavigate();

  useEffect(() => {
    if (user?.is_super_admin || user?.role === 'super_admin') {
      navigate('/platform-tenants');
    }
  }, [user]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await superAdminLogin(email, password);
      navigate('/platform-tenants');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid super admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap" style={{ background: '#0a0d14' }}>
      <div className="login-box" style={{ maxWidth: 440, background: '#111622', borderColor: '#1f293d' }}>
        <div className="login-logo" style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 58,
            height: 58,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #FFE87A, #C8860A)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            marginBottom: 12,
            boxShadow: '0 8px 24px rgba(200, 134, 10, 0.25)'
          }}>
            🛡️
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', letterSpacing: -0.5 }}>
            Platform Super Admin
          </div>
          <div className="ls" style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
            System Console · Multi-Tenant Infrastructure Access
          </div>
        </div>

        {error && (
          <div className="alert alert-red mb12">
            <div className="a-icon">⚠️</div>
            <div><div className="a-title">{error}</div></div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label style={{ color: '#cbd5e1' }}>Super Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@platform.com"
              style={{ background: '#182030', borderColor: '#29354d', color: '#f8fafc' }}
              required
              autoFocus
            />
          </div>

          <div className="field" style={{ marginBottom: 22 }}>
            <label style={{ color: '#cbd5e1' }}>Master Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{ background: '#182030', borderColor: '#29354d', color: '#f8fafc' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontWeight: 700, fontSize: 14 }}
            disabled={loading}
          >
            {loading ? 'Authenticating System...' : 'Authorize & Enter Console'}
          </button>
        </form>

        <div className="divider" style={{ marginTop: 24, borderColor: '#1e293b' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
          <span>Root Tenant Control Mode</span>
          <Link
            to="/login"
            style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
          >
            🏢 Workspace Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
