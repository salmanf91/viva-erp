import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt    = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROLE_LABEL = { cutting_master: 'Cutting Master', tailor: 'Tailor' };
const ROLE_RATE  = { cutting_master: 5, tailor: 15 };

export default function StaffPage() {
  const now = new Date();
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth() + 1);
  const [staff, setStaff]       = useState([]);
  const [payroll, setPayroll]   = useState([]);
  const [liability, setLiability] = useState(0);
  const [showAdd, setShowAdd]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('payroll');
  const [deactivating, setDeactivating] = useState(null);

  const [form, setForm] = useState({ name: '', role: 'tailor', phone: '' });

  const loadStaff = () => Promise.all([
    api.get('/staff').then(r => setStaff(r.data)),
    api.get('/staff/liability').then(r => setLiability(r.data?.total_liability || 0)),
  ]);

  const loadPayroll = () =>
    api.get(`/staff/payroll?month=${month}&year=${year}`).then(r => setPayroll(r.data));

  useEffect(() => { loadStaff().finally(() => setLoading(false)); }, []);
  useEffect(() => { loadPayroll(); }, [month, year]);

  const addStaff = async () => {
    if (!form.name.trim()) return;
    await api.post('/staff', form);
    setShowAdd(false);
    setForm({ name: '', role: 'tailor', phone: '' });
    loadStaff();
  };

  const deactivate = async id => {
    if (!confirm('Remove this staff member? They will no longer appear in new batch assignments.')) return;
    setDeactivating(id);
    await api.delete(`/staff/${id}`);
    await loadStaff();
    setDeactivating(null);
  };

  const settle = async staffId => {
    await api.post('/staff/settle', { staff_id: staffId, month, year });
    loadPayroll();
    loadStaff();
  };

  const cutting = staff.filter(s => s.role === 'cutting_master');
  const tailors  = staff.filter(s => s.role === 'tailor');
  const pendingTotal = payroll.reduce((s, p) => s + Number(p.pending || 0), 0);

  if (loading) return <div className="spinner">Loading…</div>;

  return (
    <>
      {/* Header */}
      <div className="sec-hd mb16">
        <div>
          <div className="sec-title">Staff & Payroll</div>
          <div className="sec-sub">{staff.length} active member{staff.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Staff</button>
      </div>

      {/* Liability banner */}
      {liability > 0 && (
        <div className="alert alert-yellow mb16">
          <div className="a-icon">💸</div>
          <div>
            <div className="a-title">Labour Liability — {fmt(liability)}</div>
            <div className="a-body">Total unsettled payroll across all months. Settle from the Payroll tab.</div>
          </div>
        </div>
      )}

      {staff.length === 0 && (
        <div className="alert alert-yellow mb16">
          <div className="a-icon">⚠️</div>
          <div>
            <div className="a-title">No staff added yet</div>
            <div className="a-body">Add cutting masters and tailors to start tracking their dues.</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab${activeTab === 'payroll' ? ' active' : ''}`} onClick={() => setActiveTab('payroll')}>Payroll</div>
        <div className={`tab${activeTab === 'staff'   ? ' active' : ''}`} onClick={() => setActiveTab('staff')}>Staff Directory</div>
      </div>

      {/* ── Payroll tab ── */}
      {activeTab === 'payroll' && (
        <>
          {/* Month / year selector */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
            <select
              value={month}
              onChange={e => setMonth(+e.target.value)}
              style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}
            >
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select
              value={year}
              onChange={e => setYear(+e.target.value)}
              style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="card">
            <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{MONTHS[month-1]} {year} Payroll</span>
              {pendingTotal > 0 && (
                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--red)' }}>
                  {fmt(pendingTotal)} pending
                </span>
              )}
            </div>

            {payroll.length === 0 ? (
              <div className="empty-state">No payroll records for {MONTHS[month-1]} {year}.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Pieces</th>
                    <th style={{ textAlign: 'right' }}>Rate/pc</th>
                    <th style={{ textAlign: 'right' }}>Earned</th>
                    <th style={{ textAlign: 'right' }}>Settled</th>
                    <th style={{ textAlign: 'right' }}>Pending</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700 }}>{p.name}</td>
                      <td>
                        <span className={`badge ${p.role === 'cutting_master' ? 'b-accent' : 'b-cyan'}`} style={{ fontSize: 11 }}>
                          {p.role === 'cutting_master' ? '✂️ Cutting' : '🧵 Tailor'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{Number(p.total_pieces) || 0}</td>
                      <td style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>₹{p.rate_per_pc}/pc</td>
                      <td style={{ textAlign: 'right' }}>{fmt(p.total_due)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(p.settled)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(p.pending) > 0
                          ? <span className="badge b-yellow" style={{ fontSize: 11 }}>{fmt(p.pending)}</span>
                          : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        {Number(p.pending) > 0 && (
                          <button className="btn btn-primary btn-sm" onClick={() => settle(p.id)}>
                            Settle
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Staff Directory tab ── */}
      {activeTab === 'staff' && (
        <div className="g2" style={{ alignItems: 'flex-start' }}>
          {/* Directory table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Cutting Masters */}
            <div className="card">
              <div className="card-hd">
                ✂️ Cutting Masters
                <span className="badge b-accent" style={{ fontSize: 11 }}>{cutting.length}</span>
              </div>
              {cutting.length === 0 ? (
                <div className="empty-state" style={{ padding: '14px 0' }}>No cutting masters added.</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Name</th><th>Rate / pc</th><th>Phone</th><th></th></tr>
                  </thead>
                  <tbody>
                    {cutting.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.name}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{s.rate_per_pc} / pc</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.phone || '—'}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                            disabled={deactivating === s.id}
                            onClick={() => deactivate(s.id)}
                          >
                            {deactivating === s.id ? '…' : 'Remove'}
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
              <div className="card-hd">
                🧵 Tailors
                <span className="badge b-cyan" style={{ fontSize: 11 }}>{tailors.length}</span>
              </div>
              {tailors.length === 0 ? (
                <div className="empty-state" style={{ padding: '14px 0' }}>No tailors added.</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Name</th><th>Rate / pc</th><th>Phone</th><th></th></tr>
                  </thead>
                  <tbody>
                    {tailors.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.name}</td>
                        <td style={{ color: 'var(--cyan, #0891b2)', fontWeight: 700 }}>₹{s.rate_per_pc} / pc</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.phone || '—'}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                            disabled={deactivating === s.id}
                            onClick={() => deactivate(s.id)}
                          >
                            {deactivating === s.id ? '…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Rate card info */}
          <div className="card" style={{ alignSelf: 'flex-start' }}>
            <div className="card-hd">Rate Card</div>
            <div className="info-list">
              <div className="il-row">
                <span className="il-label">✂️ Cutting Master</span>
                <span className="il-val" style={{ color: 'var(--accent)', fontWeight: 700 }}>₹5 / piece</span>
              </div>
              <div className="il-row">
                <span className="il-label">🧵 Tailor (Stitching)</span>
                <span className="il-val" style={{ color: 'var(--cyan, #0891b2)', fontWeight: 700 }}>₹15 / piece</span>
              </div>
              <div className="il-row">
                <span className="il-label">🔗 Lace Work</span>
                <span className="il-val" style={{ color: 'var(--muted)', fontSize: 12 }}>Auto-added for Shawl+Lace</span>
              </div>
              <div className="il-row">
                <span className="il-label">💰 Payout</span>
                <span className="il-val" style={{ color: 'var(--muted)', fontSize: 12 }}>Monthly settlement</span>
              </div>
            </div>

            <div className="alert alert-accent" style={{ marginTop: 14, marginBottom: 0 }}>
              <div className="a-icon" style={{ fontSize: 14 }}>ℹ️</div>
              <div className="a-body" style={{ fontSize: 12 }}>
                Rates are fixed per role. To change a rate, remove the staff member and re-add with updated details.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Staff modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Staff Member</h2>
            <div className="form-grid">
              <div className="field form-full">
                <label>Full Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addStaff()}
                  autoFocus
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="cutting_master">✂️ Cutting Master — ₹5/pc</option>
                  <option value="tailor">🧵 Tailor — ₹15/pc</option>
                </select>
              </div>
              <div className="field">
                <label>Phone (optional)</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Mobile number"
                  type="tel"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="calc-box" style={{ marginTop: 14 }}>
              <div className="calc-row">
                <span className="cl">Role</span>
                <span className="cv">{ROLE_LABEL[form.role]}</span>
              </div>
              <div className="calc-row">
                <span className="cl">Rate</span>
                <span className="cv">₹{ROLE_RATE[form.role]} per piece</span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addStaff} disabled={!form.name.trim()}>Add Staff</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
