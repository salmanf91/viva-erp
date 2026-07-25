import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const fmt    = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROLE_LABEL = { cutting_master: 'Cutting Master', tailor: 'Tailor' };

export default function StaffPage() {
  const { user } = useAuth();
  const isOwner  = ['owner', 'manager'].includes(user?.role);

  const now = new Date();
  const [year, setYear]           = useState(now.getFullYear());
  const [month, setMonth]         = useState(now.getMonth() + 1);
  const [staff, setStaff]         = useState([]);
  const [payroll, setPayroll]     = useState([]);
  const [admins, setAdmins]       = useState([]);
  const [liability, setLiability] = useState(0);
  const [showAdd, setShowAdd]     = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('payroll');
  const [deactivating, setDeactivating] = useState(null);
  const [reactivating, setReactivating] = useState(null);
  const [toggling, setToggling]   = useState(null);

  const [form, setForm] = useState({ name: '', role: 'tailor', phone: '', can_stitch: false });
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });

  const loadStaff = () => Promise.all([
    api.get('/staff').then(r => setStaff(r.data)),
    api.get('/staff/liability').then(r => setLiability(r.data?.total_liability || 0)),
  ]);
  const loadAdmins   = () => api.get('/staff/admins').then(r => setAdmins(r.data));
  const loadPayroll  = () => api.get(`/staff/payroll?month=${month}&year=${year}`).then(r => setPayroll(r.data));

  useEffect(() => {
    Promise.all([loadStaff(), loadAdmins()]).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadPayroll(); }, [month, year]);

  const addStaff = async () => {
    if (!form.name.trim()) return;
    await api.post('/staff', form);
    setShowAdd(false); setForm({ name: '', role: 'tailor', phone: '', can_stitch: false });
    loadStaff();
  };

  const addAdmin = async () => {
    if (!adminForm.name || !adminForm.email || !adminForm.password) return;
    try {
      await api.post('/staff/admins', adminForm);
      setShowAddAdmin(false); setAdminForm({ name: '', email: '', password: '' });
      loadAdmins();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to create staff admin');
    }
  };

  const removeAdmin = async id => {
    if (!confirm('Remove this staff admin? They will no longer be able to log in.')) return;
    await api.delete(`/staff/admins/${id}`);
    loadAdmins();
  };

  const deactivate = async id => {
    if (!confirm('Deactivate this staff member? History is preserved.')) return;
    setDeactivating(id);
    await api.delete(`/staff/${id}`);
    await loadStaff(); setDeactivating(null);
  };

  const reactivate = async id => {
    setReactivating(id);
    await api.put(`/staff/${id}/reactivate`);
    await loadStaff(); setReactivating(null);
  };

  const toggleStitch = async (id, current) => {
    setToggling(id);
    await api.put(`/staff/${id}`, { can_stitch: !current });
    await loadStaff(); setToggling(null);
  };

  const settle = async staffId => {
    await api.post('/staff/settle', { staff_id: staffId, month, year });
    loadPayroll(); loadStaff();
  };

  const activeStaff   = staff.filter(s => s.is_active);
  const inactiveStaff = staff.filter(s => !s.is_active);
  const cutting       = activeStaff.filter(s => s.role === 'cutting_master');
  const tailors       = activeStaff.filter(s => s.role === 'tailor');
  const pendingTotal  = payroll.reduce((s, p) => s + Number(p.pending || 0), 0);

  if (loading) return <div className="spinner">Loading…</div>;

  return (
    <>
      <div className="sec-hd mb16">
        <div>
          <div className="sec-title">Staff & Payroll</div>
          <div className="sec-sub">{activeStaff.length} active member{activeStaff.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Staff</button>
      </div>

      {liability > 0 && (
        <div className="alert alert-yellow mb16">
          <div className="a-icon">💸</div>
          <div>
            <div className="a-title">Labour Liability — {fmt(liability)}</div>
            <div className="a-body">Total unsettled payroll across all months.</div>
          </div>
        </div>
      )}

      {activeStaff.length === 0 && (
        <div className="alert alert-yellow mb16">
          <div className="a-icon">⚠️</div>
          <div>
            <div className="a-title">No staff added yet</div>
            <div className="a-body">Add cutting masters and tailors to start tracking their dues.</div>
          </div>
        </div>
      )}

      <div className="tabs">
        <div className={`tab${activeTab === 'payroll' ? ' active' : ''}`} onClick={() => setActiveTab('payroll')}>Payroll</div>
        <div className={`tab${activeTab === 'staff'   ? ' active' : ''}`} onClick={() => setActiveTab('staff')}>Staff Directory</div>
        {isOwner && <div className={`tab${activeTab === 'admins' ? ' active' : ''}`} onClick={() => setActiveTab('admins')}>Staff Admins</div>}
      </div>

      {/* ── Payroll tab ── */}
      {activeTab === 'payroll' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
            <select value={month} onChange={e => setMonth(+e.target.value)}
              style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(+e.target.value)}
              style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="card">
            <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{MONTHS[month-1]} {year} Payroll</span>
              {pendingTotal > 0 && <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--red)' }}>{fmt(pendingTotal)} pending</span>}
            </div>
            {payroll.length === 0
              ? <div className="empty-state">No payroll records for {MONTHS[month-1]} {year}.</div>
              : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Breakdown</th>
                      <th style={{ textAlign: 'right' }}>Earned</th>
                      <th style={{ textAlign: 'right' }}>Settled</th>
                      <th style={{ textAlign: 'right' }}>Pending</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payroll.map(p => {
                      const cutPcs      = Number(p.cut_pieces    || 0);
                      const stitchPcs   = Number(p.stitch_pieces || 0);
                      const cutDue      = Number(p.cut_due       || 0);
                      const stitchDue   = Number(p.stitch_due    || 0);
                      const rate        = cutPcs > 0 ? Math.round(cutDue / cutPcs) : Number(p.rate_per_pc || 0);
                      const stitchRate  = stitchPcs > 0 ? Math.round(stitchDue / stitchPcs) : 0;
                      const hasCut      = cutPcs > 0;
                      const hasStitch   = stitchPcs > 0;
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{p.name}</div>
                            <span className={`badge ${p.role === 'cutting_master' ? 'b-accent' : 'b-cyan'}`} style={{ fontSize: 10, marginTop: 3 }}>
                              {p.role === 'cutting_master' ? '✂️ Cutting' : '🧵 Tailor'}
                            </span>
                            {!!p.can_stitch && <span className="badge b-green" style={{ fontSize: 10, marginLeft: 4 }}>+Stitch</span>}
                          </td>
                          <td>
                            {!hasCut && !hasStitch
                              ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>No entries</span>
                              : <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {hasCut && (
                                    <div style={{ fontSize: 12, color: 'var(--text)' }}>
                                      <span style={{ color: 'var(--muted)' }}>✂️ Cut </span>
                                      <b>{cutPcs}</b>
                                      <span style={{ color: 'var(--muted)' }}> pcs × ₹{rate}</span>
                                      <span style={{ fontWeight: 700, color: 'var(--accent)', marginLeft: 4 }}>= {fmt(cutDue)}</span>
                                    </div>
                                  )}
                                  {hasStitch && (
                                    <div style={{ fontSize: 12, color: 'var(--text)' }}>
                                      <span style={{ color: 'var(--muted)' }}>🧵 Stitch </span>
                                      <b>{stitchPcs}</b>
                                      <span style={{ color: 'var(--muted)' }}> pcs × ₹{stitchRate}</span>
                                      <span style={{ fontWeight: 700, color: 'var(--cyan)', marginLeft: 4 }}>= {fmt(stitchDue)}</span>
                                    </div>
                                  )}
                                </div>
                            }
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(p.total_due)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(p.settled)}</td>
                          <td style={{ textAlign: 'right' }}>
                            {Number(p.pending) > 0
                              ? <span className="badge b-yellow" style={{ fontSize: 11 }}>{fmt(p.pending)}</span>
                              : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                          </td>
                          <td>
                            {Number(p.pending) > 0 && (
                              <button className="btn btn-primary btn-sm" onClick={() => settle(p.id)}>Settle</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}

      {/* ── Staff Directory tab ── */}
      {activeTab === 'staff' && (
        <div className="g2" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Cutting Masters */}
            <div className="card">
              <div className="card-hd">✂️ Cutting Masters <span className="badge b-accent" style={{ fontSize: 11 }}>{cutting.length}</span></div>
              {cutting.length === 0
                ? <div className="empty-state" style={{ padding: '12px 0' }}>None added.</div>
                : (
                  <table>
                    <thead><tr><th>Name</th><th>Rate/pc</th><th>Also Stitches</th><th>Phone</th><th></th></tr></thead>
                    <tbody>
                      {cutting.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700 }}>{s.name}</td>
                          <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{s.rate_per_pc}/pc</td>
                          <td>
                            <button
                              className={`btn btn-sm ${s.can_stitch ? 'btn-primary' : 'btn-ghost'}`}
                              style={{ fontSize: 11, padding: '3px 10px' }}
                              disabled={toggling === s.id}
                              onClick={() => toggleStitch(s.id, s.can_stitch)}
                            >
                              {toggling === s.id ? '…' : s.can_stitch ? '✓ Yes' : 'No'}
                            </button>
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.phone || '—'}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                              disabled={deactivating === s.id} onClick={() => deactivate(s.id)}>
                              {deactivating === s.id ? '…' : 'Deactivate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>

            {/* Tailors */}
            <div className="card">
              <div className="card-hd">🧵 Tailors <span className="badge b-cyan" style={{ fontSize: 11 }}>{tailors.length}</span></div>
              {tailors.length === 0
                ? <div className="empty-state" style={{ padding: '12px 0' }}>None added.</div>
                : (
                  <table>
                    <thead><tr><th>Name</th><th>Rate/pc</th><th>Phone</th><th></th></tr></thead>
                    <tbody>
                      {tailors.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700 }}>{s.name}</td>
                          <td style={{ color: 'var(--cyan, #0891b2)', fontWeight: 700 }}>₹{s.rate_per_pc}/pc</td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.phone || '—'}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                              disabled={deactivating === s.id} onClick={() => deactivate(s.id)}>
                              {deactivating === s.id ? '…' : 'Deactivate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>

            {/* Inactive staff — owner only */}
            {isOwner && inactiveStaff.length > 0 && (
              <div className="card">
                <div className="card-hd" style={{ color: 'var(--muted)' }}>Inactive Staff <span className="badge" style={{ fontSize: 11, background: 'var(--light)', color: 'var(--muted)' }}>{inactiveStaff.length}</span></div>
                <table>
                  <thead><tr><th>Name</th><th>Role</th><th></th></tr></thead>
                  <tbody>
                    {inactiveStaff.map(s => (
                      <tr key={s.id} style={{ opacity: 0.6 }}>
                        <td style={{ fontWeight: 700 }}>{s.name}</td>
                        <td><span className="badge" style={{ fontSize: 11, background: 'var(--light)', color: 'var(--muted)' }}>{ROLE_LABEL[s.role]}</span></td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                            disabled={reactivating === s.id} onClick={() => reactivate(s.id)}>
                            {reactivating === s.id ? '…' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rate card */}
          <div className="card" style={{ alignSelf: 'flex-start' }}>
            <div className="card-hd">Rate Card</div>
            <div className="info-list">
              <div className="il-row"><span className="il-label">✂️ Cutting Master</span><span className="il-val" style={{ color: 'var(--accent)', fontWeight: 700 }}>Rate set per category</span></div>
              <div className="il-row"><span className="il-label">🧵 Tailor (Stitching)</span><span className="il-val" style={{ color: 'var(--cyan,#0891b2)', fontWeight: 700 }}>Rate set per category</span></div>
              <div className="il-row"><span className="il-label">⚙️ Configure Rates</span><span className="il-val" style={{ fontSize: 12, color: 'var(--muted)' }}>Settings → Product Config</span></div>
              <div className="il-row"><span className="il-label">💰 Payout</span><span className="il-val" style={{ fontSize: 12, color: 'var(--muted)' }}>Monthly settlement</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Staff Admins tab (owner only) ── */}
      {activeTab === 'admins' && isOwner && (
        <div className="g2" style={{ alignItems: 'flex-start' }}>
          <div className="card">
            <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Staff Admin Accounts
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddAdmin(true)}>+ New Admin</button>
            </div>
            <div className="alert alert-accent" style={{ marginBottom: 14 }}>
              <div className="a-icon" style={{ fontSize: 14 }}>ℹ️</div>
              <div className="a-body" style={{ fontSize: 12 }}>
                Staff admins can log daily work entries and manage staff members. They cannot see financial data or payroll amounts.
              </div>
            </div>
            {admins.length === 0
              ? <div className="empty-state">No staff admin accounts. Create one to let a supervisor log daily work.</div>
              : (
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Created</th><th></th></tr></thead>
                  <tbody>
                    {admins.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 700 }}>{a.name}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{a.email}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                            onClick={() => removeAdmin(a.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      )}

      {/* Add Staff modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Staff Member</h2>
            <div className="form-grid">
              <div className="field form-full">
                <label>Full Name</label>
                <input value={form.name} autoFocus placeholder="e.g. Ramesh Kumar"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addStaff()} />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, can_stitch: false }))}>
                  <option value="tailor">🧵 Tailor</option>
                  <option value="cutting_master">✂️ Cutting Master</option>
                </select>
              </div>
              <div className="field">
                <label>Phone (optional)</label>
                <input value={form.phone} type="tel" placeholder="Mobile number"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              {form.role === 'cutting_master' && (
                <div className="field form-full" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="add-cs" checked={form.can_stitch}
                    onChange={e => setForm(f => ({ ...f, can_stitch: e.target.checked }))}
                    style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                  <label htmlFor="add-cs" style={{ margin: 0, textTransform: 'none', letterSpacing: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    Also does stitching work (rate from product config)
                  </label>
                </div>
              )}
            </div>
            <div className="calc-box" style={{ marginTop: 14 }}>
              <div className="calc-row">
                <span className="cl">Role</span><span className="cv">{ROLE_LABEL[form.role]}</span>
              </div>
              <div className="calc-row">
                <span className="cl">Rate</span><span className="cv">Set via product config</span>
              </div>
              {form.can_stitch && (
                <div className="calc-row">
                  <span className="cl">Stitch rate</span><span className="cv">Set via product config</span>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addStaff} disabled={!form.name.trim()}>Add Staff</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Admin modal */}
      {showAddAdmin && (
        <div className="modal-overlay" onClick={() => setShowAddAdmin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Staff Admin Account</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              This person will be able to log daily work entries and manage staff — but will not see any financial data.
            </div>
            <div className="form-grid">
              <div className="field form-full">
                <label>Full Name</label>
                <input value={adminForm.name} autoFocus placeholder="Supervisor name"
                  onChange={e => setAdminForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field form-full">
                <label>Email (login)</label>
                <input value={adminForm.email} type="email" placeholder="supervisor@email.com"
                  onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field form-full">
                <label>Password</label>
                <input value={adminForm.password} type="password" placeholder="Set a password"
                  onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAddAdmin(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addAdmin}
                disabled={!adminForm.name || !adminForm.email || !adminForm.password}>
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
