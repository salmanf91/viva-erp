import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['shawl_nighty', 'ordinary_nighty', 'shawl_nighty_lace'];
const CAT_LABEL  = { shawl_nighty: 'Shawl Nighty', ordinary_nighty: 'Ordinary Nighty', shawl_nighty_lace: 'Shawl + Lace' };
const getProductLabel = cat => CAT_LABEL[cat] || cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const toDateStr = d => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const fmtDate   = s => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort  = s => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function StaffLogPage() {
  const [tab, setTab] = useState('log');

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1.5px solid var(--border)' }}>
        {[['log','📋 Daily Log'],['history','📆 History'],['staff','👷 Staff']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
              background: 'transparent', borderBottom: tab === t ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--muted)', borderRadius: 0,
            }}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'log'     && <DailyLogTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'staff'   && <StaffTab />}
    </>
  );
}

// ── Daily Log Tab ─────────────────────────────────────────────────────────────

function DailyLogTab() {
  const [date, setDate]         = useState(toDateStr(new Date()));
  const [staff, setStaff]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(null);

  const [newEntry, setNewEntry]         = useState({});
  const [showAddEntry, setShowAddEntry] = useState({}); // staffId -> category (string)
  const [editEntry, setEditEntry]       = useState({}); // key -> {allocated, completed}

  const [products, setProducts] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/staff/work-entries', { params: { date } })
      .then(r => setStaff(r.data))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/production/configs')
      .then(r => setProducts(r.data))
      .catch(() => {});
  }, []);

  const changeDate = delta => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(toDateStr(d));
  };

  const saveEntry = async (staffId, category, work_type, allocated, completed) => {
    const allocNum = +allocated || 0;
    const doneNum  = Math.min(+completed || 0, allocNum);
    if (allocNum === 0) return;
    const key = `${staffId}-${category}-${work_type}`;
    setSaving(key);
    try {
      const res = await api.post('/staff/work-entries', {
        staff_id: staffId, entry_date: date, category, work_type,
        allocated_pcs: allocNum, completed_pcs: doneNum,
      });
      setStaff(prev => prev.map(s => {
        if (s.id !== staffId) return s;
        const exists = s.entries.find(e => e.category === category && e.work_type === work_type);
        const entries = exists
          ? s.entries.map(e => e.category === category && e.work_type === work_type ? res.data : e)
          : [...s.entries, res.data];
        return { ...s, entries };
      }));
      setShowAddEntry(p => ({ ...p, [staffId]: null }));
      setNewEntry(p => ({ ...p, [staffId]: null }));
      setEditEntry(p => { const n = { ...p }; delete n[key]; return n; });
    } finally { setSaving(null); }
  };

  const openAddEntry = (staffId, category) => {
    const s = staff.find(x => x.id === staffId);
    const wt = s?.role === 'cutting_master' ? 'cutting' : 'stitching';
    setNewEntry(p => ({ ...p, [staffId]: { category, work_type: wt, allocated: '', completed: '' } }));
    setShowAddEntry(p => ({ ...p, [staffId]: category }));
  };

  const closeAddEntry = (staffId) => {
    setShowAddEntry(p => ({ ...p, [staffId]: null }));
    setNewEntry(p => ({ ...p, [staffId]: null }));
  };

  const deleteEntry = async (entry) => {
    if (!confirm(`Delete this entry for ${getProductLabel(entry.category)}?`)) return;
    const key = `${entry.staff_id}-${entry.category}-${entry.work_type}`;
    setSaving(key);
    try {
      await api.delete(`/staff/work-entries/${entry.id}`);
      setStaff(prev => prev.map(s => {
        if (s.id !== entry.staff_id) return s;
        return { ...s, entries: s.entries.filter(e => e.id !== entry.id) };
      }));
    } catch {
      alert('Failed to delete entry');
    } finally {
      setSaving(null);
    }
  };

  const startEdit = (entry) => {
    const key = `${entry.staff_id}-${entry.category}-${entry.work_type}`;
    setEditEntry(p => ({ ...p, [key]: { allocated: String(entry.allocated_pcs), completed: String(entry.completed_pcs) } }));
  };

  const cancelEdit = (entry) => {
    const key = `${entry.staff_id}-${entry.category}-${entry.work_type}`;
    setEditEntry(p => { const n = { ...p }; delete n[key]; return n; });
  };

  const tailors = staff.filter(s => s.role === 'tailor');
  const cutters = staff.filter(s => s.role === 'cutting_master');
  const isToday = date === toDateStr(new Date());

  return (
    <>
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => changeDate(-1)}>← Prev</button>
        <div style={{
          flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15,
          background: 'var(--white)', border: '1.5px solid var(--border)',
          borderRadius: 10, padding: '8px 16px',
        }}>
          {fmtDate(date)}
          {isToday && <span className="badge b-green" style={{ marginLeft: 8, fontSize: 10 }}>Today</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => changeDate(1)} disabled={isToday}>Next →</button>
        {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDate(toDateStr(new Date()))}>Today</button>}
      </div>

      {loading ? <div className="spinner">Loading…</div> : (
        <>
          <SectionLabel>🧵 Tailors ({tailors.length})</SectionLabel>
          {tailors.length === 0 && <EmptyCard>No active tailors.</EmptyCard>}
          {tailors.map(s => (
            <StaffCard key={s.id} staff={s} workType="stitching"
              saving={saving} editEntry={editEntry}
              newEntry={newEntry[s.id]} showAdd={showAddEntry[s.id]}
              products={products}
              onSetNew={v => setNewEntry(p => ({ ...p, [s.id]: v }))}
              onOpenAdd={cat => openAddEntry(s.id, cat)}
              onCloseAdd={() => closeAddEntry(s.id)}
              onSave={(cat, wt, alloc, done) => saveEntry(s.id, cat, wt, alloc, done)}
              onStartEdit={startEdit} onCancelEdit={cancelEdit}
              onSetEdit={(key, v) => setEditEntry(p => ({ ...p, [key]: v }))}
              onDelete={deleteEntry}
            />
          ))}

          <SectionLabel style={{ marginTop: 20 }}>✂️ Cutting Masters ({cutters.length})</SectionLabel>
          {cutters.length === 0 && <EmptyCard>No active cutting masters.</EmptyCard>}
          {cutters.map(s => (
            <StaffCard key={s.id} staff={s} workType="cutting"
              saving={saving} editEntry={editEntry}
              newEntry={newEntry[s.id]} showAdd={showAddEntry[s.id]}
              products={products}
              onSetNew={v => setNewEntry(p => ({ ...p, [s.id]: v }))}
              onOpenAdd={cat => openAddEntry(s.id, cat)}
              onCloseAdd={() => closeAddEntry(s.id)}
              onSave={(cat, wt, alloc, done) => saveEntry(s.id, cat, wt, alloc, done)}
              onStartEdit={startEdit} onCancelEdit={cancelEdit}
              onSetEdit={(key, v) => setEditEntry(p => ({ ...p, [key]: v }))}
              onDelete={deleteEntry}
            />
          ))}
        </>
      )}


    </>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const now = new Date();
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [year, setYear]       = useState(now.getFullYear());
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList]     = useState([]);
  const [rows, setRows]               = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    api.get('/staff').then(r => setStaffList(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { month, year };
    if (staffFilter) params.staff_id = staffFilter;
    api.get('/staff/work-entries/history', { params })
      .then(r => setRows(r.data))
      .finally(() => setLoading(false));
  }, [month, year, staffFilter]);

  const changeMonth = delta => {
    let m = month + delta;
    let y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  // Group rows by staff
  const byStaff = {};
  for (const r of rows) {
    if (!byStaff[r.staff_id]) byStaff[r.staff_id] = { name: r.staff_name, role: r.staff_role, entries: [] };
    byStaff[r.staff_id].entries.push(r);
  }

  const totalPcs = rows.reduce((s, r) => s + (r.completed_pcs || 0), 0);
  const pendingPcs = rows.reduce((s, r) => s + (r.remaining_pcs > 0 ? r.remaining_pcs : 0), 0);

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(-1)}>← Prev</button>
        <div style={{
          fontWeight: 700, fontSize: 15, background: 'var(--white)',
          border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 20px',
        }}>
          {MONTH_NAMES[month - 1]} {year}
        </div>
        <button className="btn btn-ghost btn-sm"
          disabled={month === now.getMonth() + 1 && year === now.getFullYear()}
          onClick={() => changeMonth(1)}>Next →</button>

        <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
          style={{ marginLeft: 'auto', minWidth: 180, padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13 }}>
          <option value="">All Staff</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.role === 'cutting_master' ? 'Cutter' : 'Tailor'})</option>
          ))}
        </select>
      </div>

      {/* Summary chips */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="chip chip-green">✅ {totalPcs} pcs completed</div>
          {pendingPcs > 0 && <div className="chip chip-yellow">⏳ {pendingPcs} pcs pending</div>}
          <div className="chip">{rows.length} entries · {Object.keys(byStaff).length} staff</div>
        </div>
      )}

      {loading ? <div className="spinner">Loading…</div> : rows.length === 0 ? (
        <div className="card"><div className="empty-state">No entries for {MONTH_NAMES[month - 1]} {year}.</div></div>
      ) : (
        Object.entries(byStaff).map(([sid, s]) => {
          const totAlloc = s.entries.reduce((a, e) => a + (e.allocated_pcs || 0), 0);
          const totDone  = s.entries.reduce((a, e) => a + (e.completed_pcs || 0), 0);
          const totPend  = s.entries.reduce((a, e) => a + (e.remaining_pcs > 0 ? e.remaining_pcs : 0), 0);
          return (
            <div key={sid} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                  <span className={`badge ${s.role === 'tailor' ? 'b-cyan' : 'b-accent'}`} style={{ fontSize: 10 }}>
                    {s.role === 'tailor' ? '🧵 Tailor' : '✂️ Cutter'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}>
                  <span>Alloc: <b style={{ color: 'var(--text)' }}>{totAlloc}</b></span>
                  <span>Done: <b style={{ color: 'var(--green)' }}>{totDone}</b></span>
                  {totPend > 0 && <span>Pending: <b style={{ color: 'var(--yellow)' }}>{totPend}</b></span>}
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Allocated</th>
                    <th style={{ textAlign: 'right' }}>Completed</th>
                    <th style={{ textAlign: 'right' }}>Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.entries.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtShort(r.entry_date)}</td>
                      <td style={{ fontWeight: 600 }}>{CAT_LABEL[r.category] || r.category}</td>
                      <td>
                        <span className={`badge ${r.work_type === 'stitching' ? 'b-cyan' : 'b-accent'}`} style={{ fontSize: 10 }}>
                          {r.work_type === 'stitching' ? '🧵' : '✂️'} {r.work_type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{r.allocated_pcs}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: r.completed_pcs >= r.allocated_pcs ? 'var(--green)' : 'var(--text)' }}>
                        {r.completed_pcs}
                      </td>
                      <td style={{ textAlign: 'right', color: r.remaining_pcs > 0 ? 'var(--yellow)' : 'var(--green)', fontSize: 12 }}>
                        {r.remaining_pcs > 0 ? `${r.remaining_pcs} left` : '—'}
                      </td>
                      <td>
                        {r.is_settled
                          ? <span className="badge b-green" style={{ fontSize: 10 }}>Settled</span>
                          : r.remaining_pcs > 0
                            ? <span className="badge b-yellow" style={{ fontSize: 10 }}>Pending</span>
                            : <span className="badge b-accent" style={{ fontSize: 10 }}>Done</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab() {
  const [staff, setStaff]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [deactivating, setDeactivating] = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({ name: '', role: 'tailor', phone: '', can_stitch: false });
  const [saving, setSaving]         = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/staff').then(r => setStaff(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addStaff = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/staff', form);
      setShowAdd(false);
      setForm({ name: '', role: 'tailor', phone: '', can_stitch: false });
      load();
    } finally { setSaving(false); }
  };

  const deactivate = async id => {
    if (!confirm('Deactivate this staff member?')) return;
    setDeactivating(id);
    await api.delete(`/staff/${id}`);
    load();
    setDeactivating(null);
  };

  const active   = staff.filter(s => s.is_active);
  const inactive = staff.filter(s => !s.is_active);
  const tailors  = active.filter(s => s.role === 'tailor');
  const cutters  = active.filter(s => s.role === 'cutting_master');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Staff</button>
      </div>

      {loading ? <div className="spinner">Loading…</div> : (
        <>
          <SectionLabel>🧵 Tailors ({tailors.length})</SectionLabel>
          {tailors.length === 0 && <EmptyCard>No active tailors.</EmptyCard>}
          <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
            {tailors.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: i < tailors.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  {s.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.phone}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="badge b-cyan" style={{ fontSize: 10 }}>🧵 Tailor</span>
                  <button className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                    disabled={deactivating === s.id} onClick={() => deactivate(s.id)}>
                    {deactivating === s.id ? '…' : 'Deactivate'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <SectionLabel style={{ marginTop: 16 }}>✂️ Cutting Masters ({cutters.length})</SectionLabel>
          {cutters.length === 0 && <EmptyCard>No active cutting masters.</EmptyCard>}
          <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
            {cutters.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: i < cutters.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  {s.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.phone}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="badge b-accent" style={{ fontSize: 10 }}>✂️ Cutter</span>
                  {!!s.can_stitch && <span className="badge b-green" style={{ fontSize: 10 }}>Also Stitches</span>}
                  <button className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                    disabled={deactivating === s.id} onClick={() => deactivate(s.id)}>
                    {deactivating === s.id ? '…' : 'Deactivate'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {inactive.length > 0 && (
            <>
              <SectionLabel style={{ marginTop: 16 }}>🔒 Inactive ({inactive.length})</SectionLabel>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {inactive.map((s, i) => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', opacity: 0.6,
                    borderBottom: i < inactive.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.role === 'tailor' ? 'Tailor' : 'Cutting Master'}</div>
                    </div>
                    <span className="badge" style={{ fontSize: 10 }}>Inactive</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, textAlign: 'center' }}>
                Reactivation can only be done by the owner/manager from the main Staff &amp; Payroll page.
              </div>
            </>
          )}
        </>
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
                  <input type="checkbox" id="cs-stitch" checked={form.can_stitch}
                    onChange={e => setForm(f => ({ ...f, can_stitch: e.target.checked }))}
                    style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                  <label htmlFor="cs-stitch" style={{ margin: 0, textTransform: 'none', letterSpacing: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    Also does stitching work
                  </label>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addStaff} disabled={!form.name.trim() || saving}>
                {saving ? 'Adding…' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── StaffCard ─────────────────────────────────────────────────────────────────

// ── StaffCard ─────────────────────────────────────────────────────────────────

function StaffCard({ staff, workType, saving, editEntry, newEntry, showAdd,
  onSetNew, onOpenAdd, onCloseAdd, onSave, onStartEdit, onCancelEdit, onSetEdit,
  onDelete, products = [], style: cardStyle }) {

  const isCutter = staff.role === 'cutting_master';
  const entries = staff.entries || [];

  // Group entries by category
  const entriesByCat = entries.reduce((acc, e) => {
    acc[e.category] = e;
    return acc;
  }, {});

  // Determine active categories to show in the list (existing entries + category currently being added)
  const activeCategories = Array.from(new Set([
    ...entries.map(e => e.category),
    ...(showAdd ? [showAdd] : [])
  ]));

  return (
    <div className="card" style={{ marginBottom: 12, padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', ...cardStyle }}>
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{staff.name}</span>
          <span className={`badge ${isCutter ? 'b-accent' : 'b-cyan'}`} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>
            {isCutter ? '✂️ Cutting Master' : '🧵 Tailor'}
          </span>
          {isCutter && !!staff.can_stitch && (
            <span className="badge b-green" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>Also Stitches</span>
          )}
          {staff.carryover_pcs > 0 && (
            <span className="badge b-yellow" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>
              ⏳ {staff.carryover_pcs} pcs pending
            </span>
          )}
        </div>
      </div>

      {/* Entries List */}
      {(entries.length > 0 || showAdd) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: !showAdd ? 14 : 0 }}>
          {activeCategories.map(cat => {
            const entry = entriesByCat[cat];
            const isAddingThisCat = showAdd === cat;
            const eKey = entry ? `${entry.staff_id}-${entry.category}-${entry.work_type}` : '';
            const isEditingThisCat = entry && !!editEntry[eKey];

            if (isAddingThisCat) {
              // Add form for this category
              const allocated = newEntry?.allocated ? +newEntry.allocated : 0;
              const savingKey = `${staff.id}-${cat}-${newEntry?.work_type || workType}`;
              return (
                <div key={cat} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    New Log: {getProductLabel(cat)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {isCutter && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Work Type</span>
                        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 3, width: 'fit-content' }}>
                          <button
                            onClick={() => onSetNew({ ...newEntry, work_type: 'cutting' })}
                            style={{
                              padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer',
                              background: newEntry?.work_type === 'cutting' ? 'var(--white)' : 'transparent',
                              boxShadow: newEntry?.work_type === 'cutting' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                              color: newEntry?.work_type === 'cutting' ? 'var(--text)' : 'var(--muted)',
                              transition: 'all 0.15s'
                            }}
                          >
                            ✂️ Cutting
                          </button>
                          <button
                            onClick={() => onSetNew({ ...newEntry, work_type: 'stitching' })}
                            style={{
                              padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer',
                              background: newEntry?.work_type === 'stitching' ? 'var(--white)' : 'transparent',
                              boxShadow: newEntry?.work_type === 'stitching' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                              color: newEntry?.work_type === 'stitching' ? 'var(--text)' : 'var(--muted)',
                              transition: 'all 0.15s'
                            }}
                          >
                            🧵 Stitching
                          </button>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Allocated (pcs)</span>
                        <input
                          type="number"
                          placeholder="e.g. 50"
                          min="0"
                          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 13 }}
                          value={newEntry?.allocated || ''}
                          onChange={e => onSetNew({ ...newEntry, allocated: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Completed (pcs)</span>
                        <input
                          type="number"
                          placeholder="e.g. 45"
                          min="0"
                          max={allocated || undefined}
                          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 13 }}
                          value={newEntry?.completed || ''}
                          onChange={e => {
                            const val = +e.target.value;
                            const capped = allocated > 0 ? Math.min(val, allocated) : val;
                            onSetNew({ ...newEntry, completed: String(capped) });
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ height: 32, padding: '0 16px', borderRadius: 6, fontSize: 12 }}
                        disabled={!newEntry?.allocated || saving === savingKey}
                        onClick={() => onSave(cat, newEntry?.work_type || workType, newEntry?.allocated, newEntry?.completed)}
                      >
                        {saving === savingKey ? 'Saving…' : 'Save Entry'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ height: 32, padding: '0 12px', borderRadius: 6, fontSize: 12, border: '1px solid #cbd5e1', background: 'transparent' }}
                        onClick={onCloseAdd}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (entry) {
              const ed = editEntry[eKey] || {};
              const edAlloc = ed.allocated !== undefined ? +ed.allocated : entry.allocated_pcs;
              const remaining = (entry.allocated_pcs || 0) - (entry.completed_pcs || 0);

              if (isEditingThisCat) {
                // Edit form for this entry
                return (
                  <div key={entry.id} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Edit Log: {getProductLabel(cat)} {isCutter && `(${entry.work_type})`}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Allocated (pcs)</span>
                          <input
                            type="number"
                            min="0"
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 13 }}
                            value={ed.allocated}
                            onChange={ev => onSetEdit(eKey, { ...ed, allocated: ev.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Completed (pcs)</span>
                          <input
                            type="number"
                            min="0"
                            max={edAlloc || undefined}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontSize: 13 }}
                            value={ed.completed}
                            onChange={ev => {
                              const capped = edAlloc > 0 ? Math.min(+ev.target.value, edAlloc) : +ev.target.value;
                              onSetEdit(eKey, { ...ed, completed: String(capped) });
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ height: 32, padding: '0 16px', borderRadius: 6, fontSize: 12 }}
                          disabled={saving === eKey}
                          onClick={() => onSave(entry.category, entry.work_type, ed.allocated, ed.completed)}
                        >
                          {saving === eKey ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ height: 32, padding: '0 12px', borderRadius: 6, fontSize: 12, border: '1px solid #cbd5e1', background: 'transparent' }}
                          onClick={() => onCancelEdit(entry)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Normal Render of Saved Row
              const pct = entry.allocated_pcs > 0 ? Math.round((entry.completed_pcs / entry.allocated_pcs) * 100) : 0;
              const isSettled = !!entry.is_settled;

              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                  {/* Category Label */}
                  <div style={{ minWidth: 120, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
                      {cat === 'shawl_nighty' ? '🧵' : cat === 'ordinary_nighty' ? '👗' : '✨'} {getProductLabel(cat)}
                    </span>
                    {isCutter && (
                      <span style={{ fontSize: 10, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {entry.work_type === 'stitching' ? 'Stitching' : 'Cutting'}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 100 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: 'var(--muted)' }}>Completed</span>
                      <span style={{ color: '#475569' }}>{entry.completed_pcs} / {entry.allocated_pcs} pcs</span>
                    </div>
                    <div style={{ background: '#e2e8f0', height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                      <div
                        style={{
                          background: entry.completed_pcs >= entry.allocated_pcs ? '#10b981' : '#f59e0b',
                          width: `${Math.min(100, pct)}%`,
                          height: '100%',
                          borderRadius: 3,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>

                  {/* Badges / Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isSettled ? (
                      <span className="badge b-green" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        ✓ Settled
                      </span>
                    ) : remaining > 0 ? (
                      <span className="badge b-yellow" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        ⏳ {remaining} left
                      </span>
                    ) : (
                      <span className="badge b-green" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        ✓ Done
                      </span>
                    )}

                    {/* Actions */}
                    {!isSettled && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ height: 26, width: 26, display: 'inline-flex', padding: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'transparent' }}
                          title="Edit log"
                          onClick={() => onStartEdit(entry)}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ height: 26, width: 26, display: 'inline-flex', padding: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'transparent', color: 'var(--red)', borderColor: '#fca5a5' }}
                          title="Delete log"
                          onClick={() => onDelete(entry)}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Quick Log Dropdown */}
      {!showAdd && products.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Quick Log:
          </span>
          <select
            value=""
            onChange={e => {
              if (e.target.value) {
                onOpenAdd(e.target.value);
              }
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: 'var(--white)',
              color: 'var(--muted)',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
          >
            <option value="" disabled>+ Select Product...</option>
            {products.map(p => (
              <option key={p.category} value={p.category}>
                {getProductLabel(p.category)}
              </option>
            ))}
          </select>
        </div>
      )}

      {entries.length === 0 && !showAdd && (
        <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '8px 0', border: '1px dashed var(--border)', borderRadius: 10, background: '#f8fafc' }}>
          No work entries logged for today. Use the buttons above to log work.
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, style }) {
  return (
    <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, ...style }}>
      {children}
    </div>
  );
}

function EmptyCard({ children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="empty-state">{children}</div>
    </div>
  );
}
