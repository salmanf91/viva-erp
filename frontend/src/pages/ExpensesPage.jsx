import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt    = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CAT_ICON = {
  transport: '🚚',
  materials: '🧵',
  setup:     '🏪',
  overhead:  '🏠',
  other:     '📋',
};
const CAT_BG = {
  transport: 'var(--cyan-l)',
  materials: 'var(--orange-l)',
  setup:     'var(--yellow-l)',
  overhead:  'var(--accent-l)',
  other:     'var(--light)',
};

export default function ExpensesPage() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);

  const [expenses, setExpenses]   = useState([]);
  const [reasons, setReasons]     = useState([]);
  const [overhead, setOverhead]   = useState(null);
  const [summary, setSummary]     = useState([]);
  const [archived, setArchived]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [showArchiveBanner, setShowArchiveBanner] = useState(false);

  // Quick-entry form
  const [reasonId, setReasonId]   = useState('');
  const [amount, setAmount]       = useState('');
  const [expDate, setExpDate]     = useState(now.toISOString().slice(0,10));
  const [note, setNote]           = useState('');
  const [saving, setSaving]       = useState(false);

  // New reason inline form
  const [showNewReason, setShowNewReason] = useState(false);
  const [newReasonName, setNewReasonName] = useState('');
  const [newReasonCat, setNewReasonCat]   = useState('transport');

  // Edit modal
  const [editExp, setEditExp]     = useState(null);
  const [editAmt, setEditAmt]     = useState('');
  const [editNote, setEditNote]   = useState('');
  const [editDate, setEditDate]   = useState('');

  // Overhead
  const [elec, setElec]           = useState('');
  const [ohSaving, setOhSaving]   = useState(false);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      api.get(`/expenses?month=${month}&year=${year}`).then(r => {
        const data = r.data;
        setExpenses(Array.isArray(data) ? data : (data.expenses || []));
        setArchived(!!(data.is_archived));
      }),
      api.get('/expenses/reasons').then(r => setReasons(r.data)),
      api.get(`/expenses/overhead?month=${month}&year=${year}`)
        .then(r => { setOverhead(r.data); setElec(r.data?.electricity || ''); })
        .catch(() => { setOverhead(null); setElec(''); }),
      api.get(`/expenses/summary?month=${month}&year=${year}`).then(r => setSummary(r.data)),
    ]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [month, year]);

  const addExpense = async () => {
    if (!reasonId || !amount) return;
    setSaving(true);
    try {
      await api.post('/expenses', { reason_id: +reasonId, amount: +amount, expense_date: expDate, notes: note, month, year });
      setReasonId(''); setAmount(''); setNote('');
      loadAll();
    } finally { setSaving(false); }
  };

  const saveNewReason = async () => {
    if (!newReasonName.trim()) return;
    const r = await api.post('/expenses/reasons', { name: newReasonName.trim(), category: newReasonCat });
    setNewReasonName(''); setShowNewReason(false);
    await api.get('/expenses/reasons').then(r => setReasons(r.data));
    setReasonId(String(r.data.id));
  };

  const openEdit = e => {
    setEditExp(e);
    setEditAmt(String(e.amount));
    setEditNote(e.note || '');
    setEditDate(e.expense_date?.slice(0,10) || '');
  };

  const saveEdit = async () => {
    await api.put(`/expenses/${editExp.id}`, { amount: +editAmt, notes: editNote, expense_date: editDate });
    setEditExp(null);
    loadAll();
  };

  const deleteExpense = async id => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    loadAll();
  };

  const saveOverhead = async () => {
    setOhSaving(true);
    await api.post('/expenses/overhead', { month, year, electricity: +elec }).catch(() => {});
    setOhSaving(false);
    loadAll();
  };

  const doArchive = async () => {
    await api.post('/expenses/archive', { month, year });
    setShowArchiveBanner(false);
    loadAll();
  };

  // Group by date descending
  const byDay = expenses.reduce((acc, e) => {
    const d = (e.expense_date || '').slice(0,10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {});
  const sortedDays = Object.keys(byDay).sort((a,b) => b.localeCompare(a));

  const total = expenses.reduce((s,e) => s + Number(e.amount||0), 0);
  const dayTotal = day => byDay[day].reduce((s,e) => s+Number(e.amount||0), 0);

  const isToday = d => d === now.toISOString().slice(0,10);
  const fmtDay  = d => {
    const dt = new Date(d + 'T00:00:00');
    const base = dt.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    return isToday(d) ? base + ' — Today' : base;
  };

  if (loading) return <div className="spinner">Loading…</div>;

  return (
    <>
      {/* ── Year / Month breadcrumb ── */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {[now.getFullYear(), now.getFullYear()-1].map(y => (
            <div key={y}
              onClick={() => setYear(y)}
              style={{
                padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                background: year===y ? 'var(--accent)' : 'var(--light)',
                color: year===y ? '#fff' : 'var(--muted)',
                border: year===y ? 'none' : '1px solid var(--border)',
              }}
            >{y}</div>
          ))}
        </div>
        <span style={{ color:'var(--border)', fontSize:16 }}>›</span>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {MONTHS.map((m,i) => (
            <div key={i}
              onClick={() => setMonth(i+1)}
              style={{
                padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                background: month===i+1 ? 'var(--accent-l)' : 'var(--light)',
                color: month===i+1 ? 'var(--accent)' : 'var(--muted)',
                border: month===i+1 ? '1px solid #c4b5fd' : '1px solid var(--border)',
              }}
            >{m}</div>
          ))}
        </div>
        <span style={{ color:'var(--border)', fontSize:16 }}>›</span>
        <span style={{ fontSize:13, fontWeight:700 }}>{MONTHS[month-1]} {year}</span>
        {!archived && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={() => setShowArchiveBanner(v => !v)}>
            📦 Archive {MONTHS[month-1]}
          </button>
        )}
        {archived && <span className="badge b-accent" style={{ marginLeft:'auto' }}>📦 Archived</span>}
      </div>

      {/* Archive confirm banner */}
      {showArchiveBanner && (
        <div className="alert alert-yellow mb16">
          <div className="a-icon">📦</div>
          <div style={{ flex:1 }}>
            <div className="a-title">Archive {MONTHS[month-1]} {year}?</div>
            <div className="a-body">All {MONTHS[month-1]} expenses will be locked — no edits allowed. You can still view them anytime.</div>
          </div>
          <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
            <button className="btn btn-primary btn-sm" onClick={doArchive}>Yes, Archive</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchiveBanner(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── 2/1 grid: ledger left, summary right ── */}
      <div className="g21">

        {/* LEFT column */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Quick entry card */}
          {!archived && (
            <div className="card">
              <div className="card-hd">
                Quick Add Expense
                <a onClick={() => setShowNewReason(v => !v)}>+ New Reason</a>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 130px auto', gap:8, alignItems:'end' }}>
                <div className="field" style={{ margin:0 }}>
                  <label>Expense Reason</label>
                  <select value={reasonId} onChange={e => setReasonId(e.target.value)}>
                    <option value="">— Select reason —</option>
                    {['transport','materials','setup','other'].map(cat => {
                      const group = reasons.filter(r => r.category === cat);
                      if (!group.length) return null;
                      return (
                        <optgroup key={cat} label={`${CAT_ICON[cat]||'📋'} ${cat.charAt(0).toUpperCase()+cat.slice(1)}`}>
                          {group.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div className="field" style={{ margin:0 }}>
                  <label>Amount (₹)</label>
                  <input
                    type="number" placeholder="0"
                    style={{ textAlign:'right', fontSize:14, fontWeight:700 }}
                    value={amount} onChange={e => setAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExpense()}
                  />
                </div>
                <button className="btn btn-primary" style={{ alignSelf:'end' }} onClick={addExpense} disabled={saving || !reasonId || !amount}>
                  Save
                </button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                <div className="field" style={{ margin:0 }}>
                  <label>Date</label>
                  <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
                </div>
                <div className="field" style={{ margin:0 }}>
                  <label>Note (optional)</label>
                  <input type="text" placeholder="e.g. for Moonlight bundles" value={note} onChange={e => setNote(e.target.value)} />
                </div>
              </div>

              {/* New reason inline */}
              {showNewReason && (
                <div style={{ marginTop:12, background:'var(--light)', border:'1px solid var(--border)', borderRadius:8, padding:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:8 }}>Create New Expense Reason</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, alignItems:'end' }}>
                    <div className="field" style={{ margin:0 }}>
                      <label>Reason Name</label>
                      <input placeholder="e.g. Generator Fuel" value={newReasonName} onChange={e => setNewReasonName(e.target.value)} />
                    </div>
                    <div className="field" style={{ margin:0 }}>
                      <label>Category</label>
                      <select value={newReasonCat} onChange={e => setNewReasonCat(e.target.value)}>
                        <option value="transport">Transport</option>
                        <option value="materials">Materials</option>
                        <option value="setup">Shop & Setup</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ alignSelf:'end' }} onClick={saveNewReason}>Save Reason</button>
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>Once saved, appears in the dropdown for quick reuse.</div>
                </div>
              )}
            </div>
          )}

          {/* Day-grouped ledger */}
          <div className="card">
            <div className="card-hd">
              <span>{MONTHS[month-1]} {year} — Expense Log</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--red)' }}>−{fmt(total)}</span>
            </div>

            {sortedDays.length === 0 && <div className="empty-state">No expenses this month.</div>}

            {sortedDays.map(day => (
              <div key={day} style={{ marginBottom:4 }}>
                {/* Day header */}
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'8px 0 4px',
                  borderBottom:'2px solid var(--border)',
                  marginBottom:2,
                }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>
                    {fmtDay(day)}
                  </span>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{fmt(dayTotal(day))}</span>
                </div>

                {byDay[day].map((e, idx) => (
                  <div key={e.id} className="exp-row" style={{ borderBottom: idx === byDay[day].length-1 ? 'none' : undefined }}>
                    <div className="exp-left">
                      <div className="exp-icon" style={{ background: CAT_BG[e.category] || 'var(--light)' }}>
                        {e.icon || CAT_ICON[e.category] || '📋'}
                      </div>
                      <div>
                        <div className="exp-title">{e.reason_name}</div>
                        <div className="exp-cat">
                          {e.category?.charAt(0).toUpperCase() + e.category?.slice(1)}
                          {e.note ? ` · ${e.note}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="exp-amount">−{fmt(e.amount)}</div>
                      {!archived && (
                        <>
                          <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px', fontSize:11 }} onClick={() => openEdit(e)}>✏️</button>
                          <button className="btn btn-red btn-sm" style={{ padding:'3px 8px', fontSize:11 }} onClick={() => deleteExpense(e.id)}>✕</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ background:'var(--light)', borderRadius:8, padding:'10px 12px', marginTop:12, fontSize:12, color:'var(--muted)', border:'1px solid var(--border)' }}>
              📦 Fabric purchases are tracked under <strong>Purchases</strong> — to keep vendor bills, GST & disputes separate.
            </div>
          </div>

          {/* Overhead card */}
          <div className="card">
            <div className="card-hd">Monthly Overhead — {MONTHS[month-1]} {year}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div className="field" style={{ margin:0 }}>
                <label>Rent (fixed)</label>
                <input value="₹5,000" disabled style={{ background:'var(--light)', fontWeight:700, color:'var(--muted)' }} />
              </div>
              <div className="field" style={{ margin:0 }}>
                <label>Electricity (₹)</label>
                <input type="number" placeholder="e.g. 1200" value={elec} onChange={e => setElec(e.target.value)} disabled={archived} />
              </div>
            </div>
            {!archived && (
              <button className="btn btn-primary btn-sm" onClick={saveOverhead} disabled={ohSaving}>
                {ohSaving ? 'Saving…' : 'Save Overhead'}
              </button>
            )}
            {overhead && (
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:8 }}>
                Total overhead: {fmt(5000 + Number(elec||0))} · Used to calculate cost/pc in Production.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT column */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="stat s-red">
            <div className="s-label">This Month</div>
            <div className="s-val">{fmt(total)}</div>
            <div className="s-sub">Excl. fabric purchases</div>
          </div>

          {/* Category breakdown */}
          <div className="card">
            <div className="card-hd">By Category — {MONTHS[month-1]}</div>
            {['transport','materials','setup','other'].map(cat => {
              const catTotal = expenses.filter(e => e.category === cat).reduce((s,e) => s+Number(e.amount||0), 0);
              if (!catTotal) return null;
              return (
                <div key={cat} className="il-row" style={{ padding:'9px 0', display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                  <span style={{ color:'var(--muted)' }}>{CAT_ICON[cat]} {cat.charAt(0).toUpperCase()+cat.slice(1)}</span>
                  <span style={{ fontWeight:700 }}>{fmt(catTotal)}</span>
                </div>
              );
            })}
            {expenses.length === 0 && <div className="empty-state" style={{ padding:'16px 0' }}>No data.</div>}
          </div>

          {/* All-time summary */}
          <div className="card">
            <div className="card-hd">By Category — {MONTHS[month-1]} {year}</div>
            {summary.length === 0
              ? <div className="empty-state" style={{ padding:'16px 0' }}>No data.</div>
              : summary.map(s => (
                <div key={s.category} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                  <span style={{ color:'var(--muted)' }}>{CAT_ICON[s.category]||'📋'} {s.category}</span>
                  <span style={{ fontWeight:700, color:'var(--red)' }}>{fmt(s.total)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editExp && (
        <div className="modal-overlay" onClick={() => setEditExp(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Expense — {editExp.reason_name}</h2>
            <div className="form-grid">
              <div className="field">
                <label>Amount (₹)</label>
                <input type="number" value={editAmt} onChange={e => setEditAmt(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
              <div className="field form-full">
                <label>Note</label>
                <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Optional note" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditExp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
