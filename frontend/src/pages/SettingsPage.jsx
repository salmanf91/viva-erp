import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const PROD_CATS = ['shawl_nighty', 'shawl_nighty_lace', 'ordinary_nighty'];
const CAT_LABEL = { shawl_nighty: 'Shawl Nighty', shawl_nighty_lace: 'Shawl Nighty + Lace', ordinary_nighty: 'Ordinary Nighty' };
const CONFIG_FIELDS = [
  { key: 'fabric_cost',    label: 'Fabric Cost / pc' },
  { key: 'selling_rate',   label: 'Selling Rate / pc' },
  { key: 'lace_cost',      label: 'Lace Cost / pc' },
  { key: 'zip_cost',       label: 'Zip Cost / pc' },
  { key: 'thread_cost',    label: 'Thread / pc' },
  { key: 'canvas_cost',    label: 'Canvas / pc' },
  { key: 'plastic_cost',   label: 'Plastic Bag / pc' },
  { key: 'logistics_cost', label: 'Logistics / pc' },
  { key: 'cut_rate',       label: 'Cutting Rate / pc' },
  { key: 'stitch_rate',    label: 'Stitch Rate / pc' },
];

export default function SettingsPage() {
  const { user }                            = useAuth();
  const [current, setCurrent]              = useState('');
  const [next, setNext]                    = useState('');
  const [confirm, setConfirm]              = useState('');
  const [msg, setMsg]                      = useState(null);
  const [saving, setSaving]                = useState(false);

  const [configs, setConfigs]              = useState([]);
  const [editCat, setEditCat]              = useState(null);
  const [cfgForm, setCfgForm]              = useState({});
  const [cfgMsg, setCfgMsg]               = useState(null);

  useEffect(() => {
    api.get('/production/configs').then(r => setConfigs(r.data)).catch(() => {});
  }, []);

  const openCfg = cat => {
    const existing = configs.find(c => c.category === cat) || {};
    const defaults = { fabric_cost:0, selling_rate:0, lace_cost:0, zip_cost:2, thread_cost:1, canvas_cost:2, plastic_cost:2.5, logistics_cost:5.3, cut_rate:5, stitch_rate:15 };
    setCfgForm({ ...defaults, ...existing });
    setEditCat(cat);
  };

  const saveCfg = async () => {
    setCfgMsg(null);
    try {
      await api.put(`/production/configs/${editCat}`, cfgForm);
      const r = await api.get('/production/configs');
      setConfigs(r.data);
      setCfgMsg({ type: 'success', text: 'Saved.' });
      setTimeout(() => setCfgMsg(null), 2000);
    } catch {
      setCfgMsg({ type: 'error', text: 'Failed to save.' });
    }
  };

  const changePassword = async e => {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
    if (next.length < 6)  { setMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return; }
    setSaving(true);
    try {
      await api.put('/auth/change-password', { current_password: current, new_password: next });
      setMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    : 'U';

  return (
    <>
      {/* Product Config section */}
      <div className="card mb16">
        <div className="card-hd">Product Cost Configuration</div>
        <div className="g3" style={{ marginBottom: 0 }}>
          {PROD_CATS.map(cat => {
            const cfg = configs.find(c => c.category === cat);
            return (
              <div key={cat} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{CAT_LABEL[cat]}</div>
                {cfg ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                      Fabric: {fmt(cfg.fabric_cost)} · Labour: {fmt(Number(cfg.cut_rate)+Number(cfg.stitch_rate))} · Logistics: {fmt(cfg.logistics_cost)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>
                      Selling: {fmt(cfg.selling_rate)} / pc
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Not configured yet.</div>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => openCfg(cat)}>✏️ Edit</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="g2">
        {/* Account card */}
        <div className="card">
          <div className="card-hd">Account Info</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
              fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{user?.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{user?.email}</div>
            </div>
          </div>
          <div className="info-list">
            <div className="il-row">
              <span className="il-label">Role</span>
              <span className="il-val" style={{ textTransform: 'capitalize' }}>{user?.role}</span>
            </div>
            <div className="il-row">
              <span className="il-label">Workspace</span>
              <span className="il-val">{user?.tenant_name}</span>
            </div>
            <div className="il-row">
              <span className="il-label">Access Level</span>
              <span className="badge b-green">Full Access</span>
            </div>
          </div>
        </div>

        {/* Change password card */}
        <div className="card">
          <div className="card-hd">Change Password</div>
          {msg && (
            <div className={`alert ${msg.type === 'error' ? 'alert-red' : 'alert-accent'} mb12`}>
              <div className="a-icon">{msg.type === 'error' ? '⚠️' : '✅'}</div>
              <div><div className="a-title">{msg.text}</div></div>
            </div>
          )}
          <form onSubmit={changePassword}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Current Password</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>New Password</label>
              <input type="password" value={next} onChange={e => setNext(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Confirm New Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
      {/* Product config edit modal */}
      {editCat && (
        <div className="modal-overlay" onClick={() => setEditCat(null)}>
          <div className="modal" style={{ width: 500 }} onClick={e => e.stopPropagation()}>
            <h2>Configure — {CAT_LABEL[editCat]}</h2>
            {cfgMsg && (
              <div className={`alert ${cfgMsg.type === 'error' ? 'alert-red' : 'alert-accent'} mb12`}>
                <div className="a-icon">{cfgMsg.type === 'error' ? '⚠️' : '✅'}</div>
                <div><div className="a-title">{cfgMsg.text}</div></div>
              </div>
            )}
            <div className="form-grid">
              {CONFIG_FIELDS.map(f => (
                f.key === 'lace_cost' && editCat !== 'shawl_nighty_lace' ? null :
                <div key={f.key} className="field">
                  <label>{f.label}</label>
                  <input
                    type="number" step="0.01"
                    value={cfgForm[f.key] ?? ''}
                    onChange={e => setCfgForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditCat(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCfg}>Save Config</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
