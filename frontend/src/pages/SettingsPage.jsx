import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const DEFAULT_CATS = ['shawl_nighty', 'shawl_nighty_lace', 'ordinary_nighty'];
const CAT_LABEL = { shawl_nighty: 'Shawl Nighty', shawl_nighty_lace: 'Shawl Nighty + Lace', ordinary_nighty: 'Ordinary Nighty' };

const getProductLabel = (cat) => CAT_LABEL[cat] || cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const CORE_FIELDS = [
  { key: 'fabric_cost',    label: 'Fabric Cost / pc' },
  { key: 'selling_rate',   label: 'Default Selling Rate / pc' },
  { key: 'lace_cost',      label: 'Lace Cost / pc' },
  { key: 'canvas_cost',    label: 'Canvas / pc' },
  { key: 'plastic_cost',   label: 'Plastic Bag / pc' },
  { key: 'logistics_cost', label: 'Logistics / pc' },
  { key: 'cut_rate',       label: 'Cutting Rate / pc' },
  { key: 'stitch_rate',    label: 'Stitch Rate / pc' },
];

const SIZE_RATE_FIELDS = [
  { key: 'selling_rate_s',     label: 'S Rate / pc' },
  { key: 'selling_rate_m',     label: 'M Rate / pc' },
  { key: 'selling_rate_l',     label: 'L Rate / pc' },
  { key: 'selling_rate_xl',    label: 'XL Rate / pc' },
  { key: 'selling_rate_xxl',   label: '2XL Rate / pc' },
  { key: 'selling_rate_xxxl',  label: '3XL Rate / pc' },
  { key: 'selling_rate_xxxxl', label: '4XL Rate / pc' },
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
  const [isNew, setIsNew]                  = useState(false);
  const [newCatName, setNewCatName]        = useState('');
  const [cfgForm, setCfgForm]              = useState({});
  const [cfgMsg, setCfgMsg]               = useState(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = () => {
    api.get('/production/configs').then(r => setConfigs(r.data)).catch(() => {});
  };

  const openCfg = cat => {
    const existing = configs.find(c => c.category === cat) || {};
    const defaults = {
      fabric_cost: 0, selling_rate: 0, lace_cost: 0, canvas_cost: 2, plastic_cost: 2.5, logistics_cost: 5.3, cut_rate: 5, stitch_rate: 15,
      selling_rate_s: '', selling_rate_m: '', selling_rate_l: '', selling_rate_xl: '', selling_rate_xxl: '', selling_rate_xxxl: '', selling_rate_xxxxl: ''
    };
    setCfgForm({ ...defaults, ...existing });
    setEditCat(cat);
    setIsNew(false);
  };

  const openNewCfg = () => {
    const defaults = {
      fabric_cost: 0, selling_rate: 0, lace_cost: 0, canvas_cost: 2, plastic_cost: 2.5, logistics_cost: 5.3, cut_rate: 5, stitch_rate: 15,
      selling_rate_s: '', selling_rate_m: '', selling_rate_l: '', selling_rate_xl: '', selling_rate_xxl: '', selling_rate_xxxl: '', selling_rate_xxxxl: ''
    };
    setCfgForm(defaults);
    setNewCatName('');
    setEditCat('__new__');
    setIsNew(true);
  };

  const saveCfg = async () => {
    setCfgMsg(null);
    const catName = isNew ? newCatName.trim().toLowerCase().replace(/\s+/g, '_') : editCat;
    if (!catName) {
      setCfgMsg({ type: 'error', text: 'Product name cannot be empty.' });
      return;
    }
    try {
      await api.put(`/production/configs/${catName}`, cfgForm);
      loadConfigs();
      setCfgMsg({ type: 'success', text: 'Saved.' });
      setTimeout(() => setEditCat(null), 1000);
    } catch {
      setCfgMsg({ type: 'error', text: 'Failed to save.' });
    }
  };

  const deleteCfg = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete "${getProductLabel(cat)}"?`)) return;
    try {
      await api.delete(`/production/configs/${cat}`);
      loadConfigs();
    } catch {
      alert('Failed to delete product.');
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
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <>
      {/* Product Config section */}
      <div className="card mb16">
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-hd" style={{ margin: 0 }}>Product Management</div>
          <button className="btn btn-primary btn-sm" onClick={openNewCfg}>➕ Add Product</button>
        </div>
        <div className="g3" style={{ marginBottom: 0 }}>
          {configs.map(cfg => {
            const cat = cfg.category;
            const isDefault = DEFAULT_CATS.includes(cat);
            return (
              <div key={cat} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{getProductLabel(cat)}</div>
                  {!isDefault && (
                    <button 
                      onClick={() => deleteCfg(cat)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}
                      title="Delete Product"
                    >
                      ❌
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  Fabric: {fmt(cfg.fabric_cost)} · Labour: {fmt(Number(cfg.cut_rate) + Number(cfg.stitch_rate))} · Logistics: {fmt(cfg.logistics_cost)}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>
                  Selling: {fmt(cfg.selling_rate)} / pc
                  {['s','m','l','xl','xxl','xxxl','xxxxl'].some(s => cfg[`selling_rate_${s}`] !== null && cfg[`selling_rate_${s}`] !== undefined && cfg[`selling_rate_${s}`] > 0) && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginLeft: 6, display: 'inline-block' }}>
                      (size rates set)
                    </span>
                  )}
                </div>
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
              fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifycontent: 'center',
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
            <h2>{isNew ? 'Create New Product' : `Configure — ${getProductLabel(editCat)}`}</h2>
            {cfgMsg && (
              <div className={`alert ${cfgMsg.type === 'error' ? 'alert-red' : 'alert-accent'} mb12`}>
                <div className="a-icon">{cfgMsg.type === 'error' ? '⚠️' : '✅'}</div>
                <div><div className="a-title">{cfgMsg.text}</div></div>
              </div>
            )}
            {isNew && (
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Silk Nighty Premium"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                />
              </div>
            )}
            <div className="form-grid">
              {CORE_FIELDS.map(f => (
                f.key === 'lace_cost' && editCat !== 'shawl_nighty_lace' && !isNew ? null :
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

            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '20px 0 10px', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
              Size-Specific Selling Rates (Optional)
            </h3>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              {SIZE_RATE_FIELDS.map(f => (
                <div key={f.key} className="field">
                  <label>{f.label}</label>
                  <input
                    type="number" step="0.01"
                    placeholder="Use Default"
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
