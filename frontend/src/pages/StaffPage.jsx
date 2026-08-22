import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const fmt    = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtShort = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROLE_LABEL = { cutting_master: 'Cutting Master', tailor: 'Tailor' };
const CAT_LABEL  = { shawl_nighty: 'Shawl Nighty', ordinary_nighty: 'Ordinary Nighty', shawl_nighty_lace: 'Shawl + Lace' };
const getProductLabel = cat => CAT_LABEL[cat] || (cat ? cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—');
const CATEGORIES = ['shawl_nighty', 'ordinary_nighty', 'shawl_nighty_lace'];

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
  const [editingStaff, setEditingStaff] = useState(null);

  // Work Entries state for Owner/Manager viewing and editing
  const [historyRows, setHistoryRows] = useState([]);
  const [historyStaffFilter, setHistoryStaffFilter] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryForm, setEntryForm] = useState({
    entry_date: '',
    completion_date: '',
    category: 'shawl_nighty',
    work_type: 'stitching',
    allocated_pcs: '',
    completed_pcs: '',
  });

  const [form, setForm] = useState({ name: '', role: 'tailor', phone: '', rate_per_pc: '', can_stitch: false });
  const [editForm, setEditForm] = useState({ name: '', role: 'tailor', phone: '', rate_per_pc: '', can_stitch: false });
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });

  const loadStaff = () => Promise.all([
    api.get('/staff').then(r => setStaff(r.data)),
    api.get('/staff/liability').then(r => setLiability(r.data?.total_liability || 0)),
  ]);
  const loadAdmins   = () => api.get('/staff/admins').then(r => setAdmins(r.data));
  const loadPayroll  = () => api.get(`/staff/payroll?month=${month}&year=${year}`).then(r => setPayroll(r.data));

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    const params = { month, year };
    if (historyStaffFilter) params.staff_id = historyStaffFilter;
    api.get('/staff/work-entries/history', { params })
      .then(r => setHistoryRows(r.data))
      .finally(() => setHistoryLoading(false));
  }, [month, year, historyStaffFilter]);

  useEffect(() => {
    Promise.all([loadStaff(), loadAdmins()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPayroll();
    loadHistory();
  }, [month, year, loadHistory]);

  const addStaff = async () => {
    if (!form.name.trim()) return;
    await api.post('/staff', form);
    setShowAdd(false); setForm({ name: '', role: 'tailor', phone: '', rate_per_pc: '', can_stitch: false });
    loadStaff();
  };

  const openEditStaff = s => {
    setEditingStaff(s);
    setEditForm({
      name: s.name || '',
      role: s.role || 'tailor',
      phone: s.phone || '',
      rate_per_pc: s.rate_per_pc !== undefined ? String(s.rate_per_pc) : '',
      can_stitch: !!s.can_stitch,
    });
  };

  const saveEditStaff = async () => {
    if (!editForm.name.trim()) return;
    try {
      await api.put(`/staff/${editingStaff.id}`, editForm);
      setEditingStaff(null);
      loadStaff();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update staff');
    }
  };

  const openEditEntry = entry => {
    setEditingEntry(entry);
    setEntryForm({
      entry_date: entry.entry_date || '',
      completion_date: entry.completion_date || entry.entry_date || '',
      category: entry.category || 'shawl_nighty',
      work_type: entry.work_type || 'stitching',
      allocated_pcs: String(entry.allocated_pcs || 0),
      completed_pcs: String(entry.completed_pcs || 0),
    });
  };

  const saveEditEntry = async () => {
    if (!editingEntry) return;
    try {
      await api.put(`/staff/work-entries/${editingEntry.id}`, {
        entry_date: entryForm.entry_date,
        completion_date: entryForm.completed_pcs > 0 ? (entryForm.completion_date || entryForm.entry_date) : null,
        category: entryForm.category,
        work_type: entryForm.work_type,
        allocated_pcs: +entryForm.allocated_pcs || 0,
        completed_pcs: +entryForm.completed_pcs || 0,
      });
      setEditingEntry(null);
      loadHistory();
      loadPayroll();
      loadStaff();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update entry');
    }
  };

  const deleteEntry = async entry => {
    if (!confirm(`Delete work entry for ${entry.staff_name} on ${fmtShort(entry.entry_date)}?`)) return;
    try {
      await api.delete(`/staff/work-entries/${entry.id}`);
      loadHistory();
      loadPayroll();
      loadStaff();
    } catch {
      alert('Failed to delete work entry');
    }
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
          <div className="sec-title">Staff &amp; Payroll</div>
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
        <div className={`tab${activeTab === 'payroll' ? ' active' : ''}`} onClick={() => setActiveTab('payroll')}>Payroll &amp; Settlement</div>
        <div className={`tab${activeTab === 'entries' ? ' active' : ''}`} onClick={() => setActiveTab('entries')}>📋 Work Entries &amp; Edits</div>
        <div className={`tab${activeTab === 'staff'   ? ' active' : ''}`} onClick={() => setActiveTab('staff')}>Staff Directory</div>
        {isOwner && <div className={`tab${activeTab === 'admins' ? ' active' : ''}`} onClick={() => setActiveTab('admins')}>Staff Admins</div>}
      </div>

      {/* ── Month/Year selector for Payroll & Entries tabs ── */}
      {(activeTab === 'payroll' || activeTab === 'entries') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {activeTab === 'entries' && (
            <select
              value={historyStaffFilter}
              onChange={e => setHistoryStaffFilter(e.target.value)}
              style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}
            >
              <option value="">All Staff Members</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role === 'cutting_master' ? 'Cutter' : 'Tailor'})</option>)}
            </select>
          )}
          <select value={month} onChange={e => setMonth(+e.target.value)}
            style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {/* ── Payroll tab ── */}
      {activeTab === 'payroll' && (
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
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11 }}
                              title="View & Edit entries for this staff"
                              onClick={() => {
                                setHistoryStaffFilter(String(p.id));
                                setActiveTab('entries');
                              }}
                            >
                              🔍 View Logs
                            </button>
                            {Number(p.pending) > 0 && (
                              <button className="btn btn-primary btn-sm" onClick={() => settle(p.id)}>Settle</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* ── Work Entries Tab (View, Filter, Edit, Delete any Entry) ── */}
      {activeTab === 'entries' && (
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Work Entries Log — {MONTHS[month-1]} {year}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{historyRows.length} entries</span>
          </div>

          {historyLoading ? <div className="spinner">Loading entries…</div> : historyRows.length === 0 ? (
            <div className="empty-state">No work entries logged for {MONTHS[month-1]} {year}.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Allocation Date</th>
                  <th>Completion Date</th>
                  <th>Staff Member</th>
                  <th>Category</th>
                  <th>Work Type</th>
                  <th style={{ textAlign: 'right' }}>Allocated</th>
                  <th style={{ textAlign: 'right' }}>Completed</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmtShort(r.entry_date)}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.completion_date ? fmtShort(r.completion_date) : '—'}</td>
                    <td style={{ fontWeight: 700 }}>
                      {r.staff_name}
                      <span className={`badge ${r.staff_role === 'tailor' ? 'b-cyan' : 'b-accent'}`} style={{ fontSize: 9, marginLeft: 6 }}>
                        {r.staff_role === 'tailor' ? 'Tailor' : 'Cutter'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{getProductLabel(r.category)}</td>
                    <td>
                      <span className={`badge ${r.work_type === 'stitching' ? 'b-cyan' : 'b-accent'}`} style={{ fontSize: 10 }}>
                        {r.work_type === 'stitching' ? '🧵 Stitching' : '✂️ Cutting'}
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
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          title="Edit this work entry"
                          onClick={() => openEditEntry(r)}
                        >
                          ✏️ Edit Entry
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '3px 8px', fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                          title="Delete this work entry"
                          onClick={() => deleteEntry(r)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEditStaff(s)}>
                                ✏️ Edit
                              </button>
                              <button className="btn btn-ghost btn-sm"
                                style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                                disabled={deactivating === s.id} onClick={() => deactivate(s.id)}>
                                {deactivating === s.id ? '…' : 'Deactivate'}
                              </button>
                            </div>
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
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEditStaff(s)}>
                                ✏️ Edit
                              </button>
                              <button className="btn btn-ghost btn-sm"
                                style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                                disabled={deactivating === s.id} onClick={() => deactivate(s.id)}>
                                {deactivating === s.id ? '…' : 'Deactivate'}
                              </button>
                            </div>
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
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEditStaff(s)}>
                              ✏️ Edit
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                              disabled={reactivating === s.id} onClick={() => reactivate(s.id)}>
                              {reactivating === s.id ? '…' : 'Reactivate'}
                            </button>
                          </div>
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

      {/* ── Edit Work Entry Modal (Allocation/Completion Dates, Category, Pcs) ── */}
      {editingEntry && (
        <div className="modal-overlay" onClick={() => setEditingEntry(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>✏️ Edit Staff Work Entry</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              Staff Member: <b>{editingEntry.staff_name}</b> ({editingEntry.staff_role})
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Allocation Date</label>
                <input
                  type="date"
                  value={entryForm.entry_date}
                  onChange={e => setEntryForm(f => ({ ...f, entry_date: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Completion Date (if finished)</label>
                <input
                  type="date"
                  value={entryForm.completion_date}
                  onChange={e => setEntryForm(f => ({ ...f, completion_date: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Product Category</label>
                <select value={entryForm.category} onChange={e => setEntryForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{getProductLabel(c)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Work Type</label>
                <select value={entryForm.work_type} onChange={e => setEntryForm(f => ({ ...f, work_type: e.target.value }))}>
                  <option value="cutting">✂️ Cutting</option>
                  <option value="stitching">🧵 Stitching</option>
                </select>
              </div>
              <div className="field">
                <label>Allocated (pcs)</label>
                <input
                  type="number"
                  min="0"
                  value={entryForm.allocated_pcs}
                  onChange={e => setEntryForm(f => ({ ...f, allocated_pcs: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Completed (pcs)</label>
                <input
                  type="number"
                  min="0"
                  value={entryForm.completed_pcs}
                  onChange={e => setEntryForm(f => ({ ...f, completed_pcs: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditingEntry(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEditEntry}>Save Changes</button>
            </div>
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
              <div className="field">
                <label>Custom Rate/pc (optional ₹)</label>
                <input value={form.rate_per_pc} type="number" placeholder="Default category rate"
                  onChange={e => setForm(f => ({ ...f, rate_per_pc: e.target.value }))} />
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
                <span className="cl">Rate</span><span className="cv">{form.rate_per_pc ? `₹${form.rate_per_pc}/pc (custom)` : 'Set via product config'}</span>
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

      {/* Edit Staff modal */}
      {editingStaff && (
        <div className="modal-overlay" onClick={() => setEditingStaff(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Staff Member</h2>
            <div className="form-grid">
              <div className="field form-full">
                <label>Full Name</label>
                <input value={editForm.name} autoFocus placeholder="e.g. Ramesh Kumar"
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveEditStaff()} />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="tailor">🧵 Tailor</option>
                  <option value="cutting_master">✂️ Cutting Master</option>
                </select>
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={editForm.phone} type="tel" placeholder="Mobile number"
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="field">
                <label>Base Rate/pc (₹)</label>
                <input value={editForm.rate_per_pc} type="number" placeholder="e.g. 15"
                  onChange={e => setEditForm(f => ({ ...f, rate_per_pc: e.target.value }))} />
              </div>
              {editForm.role === 'cutting_master' && (
                <div className="field form-full" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="edit-cs" checked={editForm.can_stitch}
                    onChange={e => setEditForm(f => ({ ...f, can_stitch: e.target.checked }))}
                    style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                  <label htmlFor="edit-cs" style={{ margin: 0, textTransform: 'none', letterSpacing: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    Also does stitching work
                  </label>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditingStaff(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEditStaff} disabled={!editForm.name.trim()}>Save Changes</button>
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
