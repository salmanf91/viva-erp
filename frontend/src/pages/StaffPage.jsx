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
import StaffReportTab from '../components/StaffReportTab';

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

  // Work Entries state for Owner/Manager viewing, logging and editing
  const [historyRows, setHistoryRows] = useState([]);
  const [historyStaffFilter, setHistoryStaffFilter] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [entryForm, setEntryForm] = useState({
    staff_id: '',
    entry_date: '',
    completion_date: '',
    work_type: 'cutting',
    default_category: 'ordinary_nighty',
    items: [
      { id: 1, entry_id: null, category: 'ordinary_nighty', size: '', allocated_pcs: '', completed_pcs: '' }
    ],
  });
  const [addEntryForm, setAddEntryForm] = useState({
    staff_id: '',
    entry_date: new Date().toISOString().slice(0, 10),
    completion_date: new Date().toISOString().slice(0, 10),
    work_type: 'cutting',
    default_category: 'ordinary_nighty',
    items: [
      { id: 1, category: 'ordinary_nighty', size: '', allocated_pcs: '', completed_pcs: '' }
    ],
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
  const loadConfigs  = () => api.get('/production/configs').then(r => setConfigs(r.data)).catch(() => []);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    const params = { month, year };
    if (historyStaffFilter) params.staff_id = historyStaffFilter;
    api.get('/staff/work-entries/history', { params })
      .then(r => setHistoryRows(r.data))
      .finally(() => setHistoryLoading(false));
  }, [month, year, historyStaffFilter]);

  useEffect(() => {
    Promise.all([loadStaff(), loadAdmins(), loadConfigs()]).finally(() => setLoading(false));
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
      staff_id: entry.staff_id,
      entry_date: entry.entry_date ? entry.entry_date.slice(0, 10) : '',
      completion_date: entry.completion_date ? entry.completion_date.slice(0, 10) : (entry.entry_date ? entry.entry_date.slice(0, 10) : ''),
      work_type: entry.work_type || 'cutting',
      default_category: entry.category || 'ordinary_nighty',
      items: [
        {
          id: 1,
          entry_id: entry.id,
          category: entry.category || 'ordinary_nighty',
          size: entry.size || '',
          allocated_pcs: String(entry.allocated_pcs || 0),
          completed_pcs: String(entry.completed_pcs || 0),
        }
      ],
    });
  };

  const saveEditEntry = async () => {
    if (!editingEntry) return;

    const validItems = (entryForm.items || []).filter(
      item => (Number(item.allocated_pcs) > 0 || Number(item.completed_pcs) > 0)
    );

    if (validItems.length === 0) {
      return alert('Please enter allocated or completed pieces for at least one item/size');
    }

    try {
      // 1. Update the original entry (item with entry_id)
      const primaryItem = validItems.find(it => it.entry_id === editingEntry.id) || validItems[0];
      await api.put(`/staff/work-entries/${editingEntry.id}`, {
        entry_date: entryForm.entry_date,
        completion_date: Number(primaryItem.completed_pcs) > 0 ? (entryForm.completion_date || entryForm.entry_date) : null,
        category: primaryItem.category,
        size: primaryItem.size ? String(primaryItem.size).trim() : null,
        work_type: entryForm.work_type,
        allocated_pcs: Number(primaryItem.allocated_pcs) || 0,
        completed_pcs: Number(primaryItem.completed_pcs) || 0,
      });

      // 2. If additional size rows were added during edit, insert them as new work entries
      const newItems = validItems.filter(it => it !== primaryItem && !it.entry_id);
      if (newItems.length > 0) {
        await api.post('/staff/work-entries', {
          staff_id: Number(editingEntry.staff_id),
          entry_date: entryForm.entry_date,
          completion_date: entryForm.completion_date,
          work_type: entryForm.work_type,
          items: newItems.map(it => ({
            category: it.category,
            size: it.size ? String(it.size).trim() : null,
            allocated_pcs: Number(it.allocated_pcs) || 0,
            completed_pcs: Number(it.completed_pcs) || 0,
          })),
        });
      }

      setEditingEntry(null);
      loadHistory();
      loadPayroll();
      loadStaff();
    } catch (e) {
      alert('Failed to update work entry: ' + (e.response?.data?.message || e.message));
    }
  };

  const saveAddEntry = async () => {
    if (!addEntryForm.staff_id) return alert('Please select a staff member');

    const validItems = (addEntryForm.items || []).filter(
      item => (Number(item.allocated_pcs) > 0 || Number(item.completed_pcs) > 0)
    );

    if (validItems.length === 0) {
      return alert('Please enter allocated or completed pieces for at least one item/size');
    }

    try {
      await api.post('/staff/work-entries', {
        staff_id: Number(addEntryForm.staff_id),
        entry_date: addEntryForm.entry_date,
        completion_date: addEntryForm.completion_date,
        work_type: addEntryForm.work_type,
        items: validItems.map(it => ({
          category: it.category,
          size: it.size ? String(it.size).trim() : null,
          allocated_pcs: Number(it.allocated_pcs) || 0,
          completed_pcs: Number(it.completed_pcs) || 0,
        })),
      });

      setShowAddEntry(false);
      setAddEntryForm({
        staff_id: '',
        entry_date: new Date().toISOString().slice(0, 10),
        completion_date: new Date().toISOString().slice(0, 10),
        work_type: 'cutting',
        default_category: 'ordinary_nighty',
        items: [
          { id: 1, category: 'ordinary_nighty', size: '', allocated_pcs: '', completed_pcs: '' }
        ],
      });
      loadHistory();
      loadPayroll();
      loadStaff();
    } catch (err) {
      alert('Failed to save work entries: ' + (err.response?.data?.message || err.message));
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
        <div className={`tab${activeTab === 'report'  ? ' active' : ''}`} onClick={() => setActiveTab('report')}>📄 Staff Report</div>
        <div className={`tab${activeTab === 'staff'   ? ' active' : ''}`} onClick={() => setActiveTab('staff')}>Staff Directory</div>
        {isOwner && <div className={`tab${activeTab === 'admins' ? ' active' : ''}`} onClick={() => setActiveTab('admins')}>Staff Admins</div>}
      </div>

      {/* ── Month/Year selector for Payroll & Entries tabs ── */}
      {(activeTab === 'payroll' || activeTab === 'entries') && (() => {
        const prevM = month === 1 ? 12 : month - 1;
        const prevY = month === 1 ? year - 1 : year;
        const cycleLabel = `21 ${MONTHS[prevM - 1]} ${prevY !== year ? prevY : ''} – 20 ${MONTHS[month - 1]} ${year}`;

        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>💰 Salary Cycle:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>{cycleLabel}</span>
              <span className="badge b-cyan" style={{ fontSize: 10, padding: '2px 8px' }}>Payout: 20th {MONTHS[month - 1]}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                {MONTHS.map((m, i) => {
                  const mNum = i + 1;
                  const prevMName = MONTHS[mNum === 1 ? 11 : mNum - 2];
                  return (
                    <option key={i} value={mNum}>
                      {m} (21 {prevMName} – 20 {m})
                    </option>
                  );
                })}
              </select>
              <select value={year} onChange={e => setYear(+e.target.value)}
                style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        );
      })()}

      {/* ── Payroll tab ── */}
      {activeTab === 'payroll' && (() => {
        const prevM = month === 1 ? 12 : month - 1;
        const prevY = month === 1 ? year - 1 : year;
        const cycleLabel = `21 ${MONTHS[prevM - 1]} – 20 ${MONTHS[month - 1]} ${year}`;

        return (
          <div className="card">
            <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span>{MONTHS[month-1]} {year} Payroll</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginLeft: 10 }}>({cycleLabel} · Payout: 20th {MONTHS[month-1]})</span>
              </div>
              {pendingTotal > 0 && <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--red)' }}>{fmt(pendingTotal)} pending</span>}
            </div>
            {payroll.length === 0
              ? <div className="empty-state">No payroll records for {MONTHS[month-1]} {year} ({cycleLabel}).</div>
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
        );
      })()}

      {/* ── Work Entries Tab (View, Filter, Edit, Delete any Entry) ── */}
      {activeTab === 'entries' && (
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Work Entries Log — {MONTHS[month-1]} {year}</span>
              <span className="badge b-accent" style={{ fontSize: 11 }}>{historyRows.length} entries</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <a href="/staff-log" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none', border: '1px solid var(--border)', background: 'var(--white)' }}>
                📋 Open Daily Log View →
              </a>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddEntry(true)}>
                + Log Work Entry
              </button>
            </div>
          </div>

          {historyLoading ? <div className="spinner">Loading entries…</div> : historyRows.length === 0 ? (
            <div className="empty-state">
              <p>No work entries logged for {MONTHS[month-1]} {year}.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => setShowAddEntry(true)}>
                + Log First Work Entry
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Allocation Date</th>
                  <th>Completion Date</th>
                  <th>Staff Member</th>
                  <th>Category / Size</th>
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
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>{getProductLabel(r.category)}</span>
                        {r.size && (
                          <span className="badge" style={{ fontSize: 10, background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', fontWeight: 700, padding: '1px 5px' }}>
                            📏 {r.size}
                          </span>
                        )}
                      </div>
                    </td>
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

      {/* ── Staff Report tab (shareable piece-rate output without wages) ── */}
      {activeTab === 'report' && (
        <StaffReportTab />
      )}

      {/* ── Edit Work Entry Modal (Multi-Item & Multi-Size Supported) ── */}
      {editingEntry && (() => {
        const currentStaff = staff.find(s => String(s.id) === String(editingEntry.staff_id));
        const currentProd = configs.find(p => (p.category || '').toLowerCase() === (entryForm.default_category || '').toLowerCase() || (p.name || '').toLowerCase() === (entryForm.default_category || '').toLowerCase());
        const configuredSizes = (currentProd?.size_rates || []).map(s => s.size_label).filter(Boolean);
        const standardSizes = configuredSizes.length > 0 ? configuredSizes : ['38', '40', '42', '44'];
        const allSizeOptions = configuredSizes.length > 0 ? configuredSizes : ['Free Size', 'S', 'M', 'L', 'XL', 'XXL', '38', '40', '42', '44'];

        const addEditItemRow = (sizeVal = '') => {
          setEntryForm(f => ({
            ...f,
            items: [
              ...f.items,
              { id: Date.now() + Math.random(), category: f.default_category || 'ordinary_nighty', size: sizeVal, allocated_pcs: '', completed_pcs: '' }
            ]
          }));
        };

        const addAllStandardSizesEdit = () => {
          const existing = entryForm.items[0] || {};
          const newItems = standardSizes.map((sz, idx) => ({
            id: Date.now() + idx,
            entry_id: idx === 0 ? existing.entry_id : undefined,
            category: entryForm.default_category || existing.category || 'ordinary_nighty',
            size: sz,
            allocated_pcs: idx === 0 ? existing.allocated_pcs : '',
            completed_pcs: idx === 0 ? existing.completed_pcs : '',
          }));
          setEntryForm(f => ({ ...f, items: newItems }));
        };

        const updateEditItemRow = (id, key, val) => {
          setEntryForm(f => ({
            ...f,
            items: f.items.map(it => it.id === id ? { ...it, [key]: val } : it)
          }));
        };

        const removeEditItemRow = (id) => {
          setEntryForm(f => ({
            ...f,
            items: f.items.length > 1 ? f.items.filter(it => it.id !== id) : f.items
          }));
        };

        const totalAllocPcs = entryForm.items.reduce((s, it) => s + (Number(it.allocated_pcs) || 0), 0);
        const totalCompPcs  = entryForm.items.reduce((s, it) => s + (Number(it.completed_pcs) || 0), 0);

        return (
          <div className="modal-overlay" onClick={() => setEditingEntry(null)}>
            <div className="modal" style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h2 style={{ margin: 0 }}>✏️ Edit Staff Work Entry</h2>
                <span className="badge b-accent" style={{ fontSize: 11 }}>Multi-Size Log</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Staff Member: <b>{editingEntry.staff_name}</b> ({editingEntry.staff_role === 'cutting_master' ? '✂️ Cutting Master' : '🧵 Tailor'})
              </div>

              <div style={{ overflowY: 'auto', paddingRight: 4, flex: 1 }}>
                {/* General Details (Dates, Work Type, Category) */}
                <div className="form-grid" style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
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
                    <label>Work Type</label>
                    <select
                      value={entryForm.work_type}
                      onChange={e => setEntryForm(f => ({ ...f, work_type: e.target.value }))}
                    >
                      <option value="cutting">✂️ Cutting</option>
                      <option value="stitching">🧵 Stitching</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Default Product Category</label>
                    <select
                      value={entryForm.default_category}
                      onChange={e => {
                        const newCat = e.target.value;
                        setEntryForm(f => ({
                          ...f,
                          default_category: newCat,
                          items: f.items.map(it => ({ ...it, category: newCat }))
                        }));
                      }}
                    >
                      {configs.length > 0
                        ? configs.map(c => <option key={c.category} value={c.category}>{c.display_name || c.name || getProductLabel(c.category)}</option>)
                        : CATEGORIES.map(c => <option key={c} value={c}>{getProductLabel(c)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Quick Add Helper Chips */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Quick Add Size:</span>
                    {allSizeOptions.map(sz => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => addEditItemRow(sz)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        + {sz}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addAllStandardSizesEdit}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--accent)', color: 'var(--accent)', background: '#ede9fe' }}
                  >
                    ⚡ Pre-fill All Sizes (38, 40, 42, 44)
                  </button>
                </div>

                {/* Items & Sizes Multi-Row Container */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                  {/* Desktop Table View */}
                  <div className="desktop-only" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Product Category</th>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '22%' }}>Size / Variation</th>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '18%', textAlign: 'right' }}>Allocated (pcs)</th>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '18%', textAlign: 'right' }}>Completed (pcs)</th>
                          <th style={{ padding: '8px 6px', width: '40px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {entryForm.items.map((item, idx) => (
                          <tr key={item.id || idx} style={{ borderBottom: idx < entryForm.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '6px 10px' }}>
                              <select
                                value={item.category}
                                onChange={e => updateEditItemRow(item.id, 'category', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                              >
                                {configs.length > 0
                                  ? configs.map(c => <option key={c.category} value={c.category}>{c.display_name || c.name || getProductLabel(c.category)}</option>)
                                  : CATEGORIES.map(c => <option key={c} value={c}>{getProductLabel(c)}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <input
                                type="text"
                                placeholder="e.g. 38, XL"
                                value={item.size}
                                onChange={e => updateEditItemRow(item.id, 'size', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.allocated_pcs}
                                onChange={e => updateEditItemRow(item.id, 'allocated_pcs', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, textAlign: 'right', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.completed_pcs}
                                onChange={e => updateEditItemRow(item.id, 'completed_pcs', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}
                              />
                            </td>
                            <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeEditItemRow(item.id)}
                                disabled={entryForm.items.length === 1}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: entryForm.items.length > 1 ? '#ef4444' : '#cbd5e1',
                                  cursor: entryForm.items.length > 1 ? 'pointer' : 'default',
                                  fontSize: 14,
                                  padding: '2px 4px'
                                }}
                                title="Remove size row"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="mobile-only" style={{ padding: 8 }}>
                    {entryForm.items.map((item, idx) => (
                      <div key={item.id || idx} className="line-item-card" style={{ padding: '10px 12px', marginBottom: 8 }}>
                        <div className="line-item-card-header">
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Item #{idx + 1}</span>
                          {entryForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEditItemRow(item.id)}
                              style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Product Category</label>
                            <select
                              value={item.category}
                              onChange={e => updateEditItemRow(item.id, 'category', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                            >
                              {configs.length > 0
                                ? configs.map(c => <option key={c.category} value={c.category}>{c.display_name || c.name || getProductLabel(c.category)}</option>)
                                : CATEGORIES.map(c => <option key={c} value={c}>{getProductLabel(c)}</option>)}
                            </select>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Size / Variation</label>
                              <input
                                type="text"
                                placeholder="e.g. 38, XL"
                                value={item.size}
                                onChange={e => updateEditItemRow(item.id, 'size', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, boxSizing: 'border-box' }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Allocated (pcs)</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.allocated_pcs}
                                onChange={e => updateEditItemRow(item.id, 'allocated_pcs', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, textAlign: 'right', fontWeight: 600, boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Completed (pcs)</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={item.completed_pcs}
                              onChange={e => updateEditItemRow(item.id, 'completed_pcs', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, textAlign: 'right', fontWeight: 600, color: 'var(--green)', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: '6px 10px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                      <span>Total ({entryForm.items.length} sizes)</span>
                      <span>Alloc: {totalAllocPcs} pcs · Done: <span style={{ color: 'var(--green)' }}>{totalCompPcs} pcs</span></span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => addEditItemRow('')}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', border: '1px dashed #cbd5e1', padding: '8px', fontSize: 12, color: 'var(--accent)' }}
                >
                  + Add Another Size / Item Row
                </button>
              </div>

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setEditingEntry(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={saveEditEntry}
                  disabled={totalAllocPcs === 0 && totalCompPcs === 0}
                >
                  Save Changes ({entryForm.items.length} {entryForm.items.length === 1 ? 'Entry' : 'Entries'})
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Add Work Entry Modal for Admin / Manager / Owner (Multi-Item & Multi-Size Log) ── */}
      {showAddEntry && (() => {
        const currentStaff = staff.find(s => String(s.id) === String(addEntryForm.staff_id));
        const isCutter = currentStaff?.role === 'cutting_master';
        const currentProd = configs.find(p => (p.category || '').toLowerCase() === (addEntryForm.default_category || '').toLowerCase() || (p.name || '').toLowerCase() === (addEntryForm.default_category || '').toLowerCase());
        const configuredSizes = (currentProd?.size_rates || []).map(s => s.size_label).filter(Boolean);
        const standardSizes = configuredSizes.length > 0 ? configuredSizes : ['38', '40', '42', '44'];
        const allSizeOptions = configuredSizes.length > 0 ? configuredSizes : ['Free Size', 'S', 'M', 'L', 'XL', 'XXL', '38', '40', '42', '44'];

        const addItemRow = (sizeVal = '') => {
          setAddEntryForm(f => ({
            ...f,
            items: [
              ...f.items,
              { id: Date.now() + Math.random(), category: f.default_category || 'ordinary_nighty', size: sizeVal, allocated_pcs: '', completed_pcs: '' }
            ]
          }));
        };

        const addAllStandardSizes = () => {
          const newItems = standardSizes.map((sz, idx) => ({
            id: Date.now() + idx,
            category: addEntryForm.default_category || 'ordinary_nighty',
            size: sz,
            allocated_pcs: '',
            completed_pcs: ''
          }));
          setAddEntryForm(f => ({ ...f, items: newItems }));
        };

        const updateItemRow = (id, key, val) => {
          setAddEntryForm(f => ({
            ...f,
            items: f.items.map(it => it.id === id ? { ...it, [key]: val } : it)
          }));
        };

        const removeItemRow = (id) => {
          setAddEntryForm(f => ({
            ...f,
            items: f.items.length > 1 ? f.items.filter(it => it.id !== id) : f.items
          }));
        };

        const totalAllocPcs = addEntryForm.items.reduce((s, it) => s + (Number(it.allocated_pcs) || 0), 0);
        const totalCompPcs  = addEntryForm.items.reduce((s, it) => s + (Number(it.completed_pcs) || 0), 0);

        return (
          <div className="modal-overlay" onClick={() => setShowAddEntry(false)}>
            <div className="modal" style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h2 style={{ margin: 0 }}>➕ Log Staff Work Entries</h2>
                <span className="badge b-accent" style={{ fontSize: 11 }}>Multi-Size Log</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Log multiple items and sizes for a staff member at once without creating separate single entries.
              </div>

              <div style={{ overflowY: 'auto', paddingRight: 4, flex: 1 }}>
                {/* General Details (Staff, Dates, Work Type) */}
                <div className="form-grid" style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <div className="field form-full">
                    <label>Staff Member *</label>
                    <select
                      value={addEntryForm.staff_id}
                      onChange={e => {
                        const selectedId = e.target.value;
                        const selectedStaff = staff.find(s => String(s.id) === String(selectedId));
                        const defaultWorkType = selectedStaff?.role === 'cutting_master' ? 'cutting' : 'stitching';
                        setAddEntryForm(f => ({ ...f, staff_id: selectedId, work_type: defaultWorkType }));
                      }}
                      autoFocus
                    >
                      <option value="">-- Select Staff Member --</option>
                      {activeStaff.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role === 'cutting_master' ? '✂️ Cutting Master' : '🧵 Tailor'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Allocation Date</label>
                    <input
                      type="date"
                      value={addEntryForm.entry_date}
                      onChange={e => setAddEntryForm(f => ({ ...f, entry_date: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Completion Date (if finished)</label>
                    <input
                      type="date"
                      value={addEntryForm.completion_date}
                      onChange={e => setAddEntryForm(f => ({ ...f, completion_date: e.target.value }))}
                    />
                  </div>

                  <div className="field">
                    <label>Work Type</label>
                    <select
                      value={addEntryForm.work_type}
                      onChange={e => setAddEntryForm(f => ({ ...f, work_type: e.target.value }))}
                    >
                      <option value="cutting">✂️ Cutting</option>
                      <option value="stitching">🧵 Stitching</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Default Product Category</label>
                    <select
                      value={addEntryForm.default_category}
                      onChange={e => {
                        const newCat = e.target.value;
                        setAddEntryForm(f => ({
                          ...f,
                          default_category: newCat,
                          items: f.items.map(it => ({ ...it, category: newCat }))
                        }));
                      }}
                    >
                      {configs.length > 0
                        ? configs.map(c => <option key={c.category} value={c.category}>{c.display_name || c.name || getProductLabel(c.category)}</option>)
                        : CATEGORIES.map(c => <option key={c} value={c}>{getProductLabel(c)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Quick Add Helper Chips */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Quick Add Size:</span>
                    {allSizeOptions.map(sz => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => addItemRow(sz)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        + {sz}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addAllStandardSizes}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--accent)', color: 'var(--accent)', background: '#ede9fe' }}
                  >
                    ⚡ Pre-fill All Sizes (38, 40, 42, 44)
                  </button>
                </div>

                {/* Items & Sizes Multi-Row Container */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                  {/* Desktop Table View */}
                  <div className="desktop-only" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>Product Category</th>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '22%' }}>Size / Variation</th>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '18%', textAlign: 'right' }}>Allocated (pcs)</th>
                          <th style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', width: '18%', textAlign: 'right' }}>Completed (pcs)</th>
                          <th style={{ padding: '8px 6px', width: '40px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {addEntryForm.items.map((item, idx) => (
                          <tr key={item.id || idx} style={{ borderBottom: idx < addEntryForm.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '6px 10px' }}>
                              <select
                                value={item.category}
                                onChange={e => updateItemRow(item.id, 'category', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                              >
                                {configs.length > 0
                                  ? configs.map(c => <option key={c.category} value={c.category}>{c.display_name || c.name || getProductLabel(c.category)}</option>)
                                  : CATEGORIES.map(c => <option key={c} value={c}>{getProductLabel(c)}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <input
                                type="text"
                                placeholder="e.g. 38, XL"
                                value={item.size}
                                onChange={e => updateItemRow(item.id, 'size', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.allocated_pcs}
                                onChange={e => updateItemRow(item.id, 'allocated_pcs', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, textAlign: 'right', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.completed_pcs}
                                onChange={e => updateItemRow(item.id, 'completed_pcs', e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}
                              />
                            </td>
                            <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeItemRow(item.id)}
                                disabled={addEntryForm.items.length === 1}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: addEntryForm.items.length > 1 ? '#ef4444' : '#cbd5e1',
                                  cursor: addEntryForm.items.length > 1 ? 'pointer' : 'default',
                                  fontSize: 14,
                                  padding: '2px 4px'
                                }}
                                title="Remove size row"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f8fafc', borderTop: '1.5px solid #e2e8f0', fontWeight: 700 }}>
                          <td colSpan={2} style={{ padding: '8px 10px', color: '#475569' }}>
                            Total ({addEntryForm.items.length} size{addEntryForm.items.length !== 1 ? 's' : ''})
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text)' }}>
                            {totalAllocPcs} pcs
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--green)' }}>
                            {totalCompPcs} pcs
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="mobile-only" style={{ padding: 8 }}>
                    {addEntryForm.items.map((item, idx) => (
                      <div key={item.id || idx} className="line-item-card" style={{ padding: '10px 12px', marginBottom: 8 }}>
                        <div className="line-item-card-header">
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Item #{idx + 1}</span>
                          {addEntryForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(item.id)}
                              style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Product Category</label>
                            <select
                              value={item.category}
                              onChange={e => updateItemRow(item.id, 'category', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                            >
                              {configs.length > 0
                                ? configs.map(c => <option key={c.category} value={c.category}>{c.display_name || c.name || getProductLabel(c.category)}</option>)
                                : CATEGORIES.map(c => <option key={c} value={c}>{getProductLabel(c)}</option>)}
                            </select>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Size / Variation</label>
                              <input
                                type="text"
                                placeholder="e.g. 38, XL"
                                value={item.size}
                                onChange={e => updateItemRow(item.id, 'size', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, boxSizing: 'border-box' }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Allocated (pcs)</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.allocated_pcs}
                                onChange={e => updateItemRow(item.id, 'allocated_pcs', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, textAlign: 'right', fontWeight: 600, boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Completed (pcs)</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={item.completed_pcs}
                              onChange={e => updateItemRow(item.id, 'completed_pcs', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, textAlign: 'right', fontWeight: 600, color: 'var(--green)', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: '6px 10px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                      <span>Total ({addEntryForm.items.length} sizes)</span>
                      <span>Alloc: {totalAllocPcs} pcs · Done: <span style={{ color: 'var(--green)' }}>{totalCompPcs} pcs</span></span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => addItemRow('')}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', border: '1px dashed #cbd5e1', padding: '8px', fontSize: 12, color: 'var(--accent)' }}
                >
                  + Add Another Size / Item Row
                </button>
              </div>

              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowAddEntry(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={saveAddEntry}
                  disabled={!addEntryForm.staff_id || (totalAllocPcs === 0 && totalCompPcs === 0)}
                >
                  Save {addEntryForm.items.length} {addEntryForm.items.length === 1 ? 'Entry' : 'Entries'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
