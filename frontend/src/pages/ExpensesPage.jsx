import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';

const ACC_META = {
  zip:     { unit: 'zips',    yieldPcs: 1,  hint: 'e.g. 60 zips (1 pack)' },
  thread:  { unit: 'threads', yieldPcs: 20, hint: 'e.g. 20 threads (2 boxes × 10)' },
  canvas:  { unit: 'canvases', yieldPcs: 40, hint: 'e.g. 5 canvases (1 canvas = 40 nighties)' },
  plastic: { unit: 'pcs',     yieldPcs: 1,  hint: '' },
  lace:    { unit: 'pcs',     yieldPcs: 1,  hint: '' },
};

const fmt    = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtD   = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
const fmtDSh = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : '—';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CAT_ICON = { transport:'🚚', materials:'🧵', setup:'🏪', overhead:'🏠', other:'📋' };
const CAT_BG   = { transport:'var(--cyan-l)', materials:'var(--orange-l)', setup:'var(--yellow-l)', overhead:'var(--accent-l)', other:'var(--light)' };
const CAT_COLOR= { transport:'var(--cyan)', materials:'#e67e00', setup:'var(--yellow)', overhead:'var(--accent)', other:'var(--muted)' };

// ── Accounts Tab ──────────────────────────────────────────────────────────────
function AccountsTab({ reasons, reimbModal, setReimbModal, reimbBy, setReimbBy, saveReimburse, openEdit, deleteExpense, archived }) {
  const now = new Date();
  const [allExp, setAllExp]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [fromDate, setFromDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10));
  const [toDate, setToDate]     = useState(now.toISOString().slice(0,10));
  const [catFilter, setCatFilter]       = useState('');
  const [paidByFilter, setPaidByFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'pending' | 'repaid' | 'company'
  const [page, setPage]                 = useState(1);
  const [pages, setPages]               = useState(1);
  const [stats, setStats]               = useState({ totalSpent: 0, totalPending: 0, totalRepaid: 0, outstanding: [] });

  const load = () => {
    setLoading(true);
    api.get(`/expenses?from=${fromDate}&to=${toDate}&page=${page}`).then(r => {
      const data = r.data;
      setAllExp(data.data || []);
      setPages(data.pages || 1);
      setStats(data.stats || { totalSpent: 0, totalPending: 0, totalRepaid: 0, outstanding: [] });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); }, [fromDate, toDate]);
  useEffect(() => { load(); }, [fromDate, toDate, page]);

  const paidByOptions = useMemo(() => [...new Set(allExp.map(e => e.paid_by).filter(Boolean))], [allExp]);

  const filtered = useMemo(() => allExp.filter(e => {
    if (catFilter    && e.category !== catFilter) return false;
    if (paidByFilter && e.paid_by  !== paidByFilter) return false;
    if (statusFilter === 'pending') return e.paid_by && !e.reimbursed_at;
    if (statusFilter === 'repaid')  return e.paid_by && !!e.reimbursed_at;
    if (statusFilter === 'company') return !e.paid_by;
    return true;
  }), [allExp, catFilter, paidByFilter, statusFilter]);

  const totalSpent   = stats.totalSpent;
  const totalPending = stats.totalPending;
  const totalRepaid  = stats.totalRepaid;
  const netCompany   = totalSpent - totalPending;
  const outstanding  = stats.outstanding;

  const TH = ({ children, right }) => (
    <th style={{ padding:'10px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em',
      color:'var(--muted)', textAlign: right ? 'right' : 'left', borderBottom:'2px solid var(--border)',
      whiteSpace:'nowrap', background:'var(--light)' }}>
      {children}
    </th>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Stat bar ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { label:'Total Spent',             val: totalSpent,   color:'var(--red)',    sub: `${filtered.length} entries` },
          { label:'Pending Reimbursement',   val: totalPending, color:'#e67e00',       sub: `${filtered.filter(e=>e.paid_by&&!e.reimbursed_at).length} entries` },
          { label:'Already Repaid',          val: totalRepaid,  color:'var(--green)',  sub: `${filtered.filter(e=>e.paid_by&&e.reimbursed_at).length} entries` },
          { label:'Net Company Cost',        val: netCompany,   color:'var(--accent)', sub: 'after reimbursements' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10,
            padding:'14px 16px', borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--muted)', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{fmt(s.val)}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display:'flex', gap:8, alignItems:'flex-end', flexWrap:'wrap' }}>
        <div className="field" style={{ margin:0 }}>
          <label>From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width:140 }} />
        </div>
        <div className="field" style={{ margin:0 }}>
          <label>To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width:140 }} />
        </div>
        <div className="field" style={{ margin:0 }}>
          <label>Category</label>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width:140 }}>
            <option value="">All Categories</option>
            {['transport','materials','setup','overhead','other'].map(c =>
              <option key={c} value={c}>{CAT_ICON[c]} {c.charAt(0).toUpperCase()+c.slice(1)}</option>
            )}
          </select>
        </div>
        <div className="field" style={{ margin:0 }}>
          <label>Paid By</label>
          <select value={paidByFilter} onChange={e => setPaidByFilter(e.target.value)} style={{ width:140 }}>
            <option value="">Everyone</option>
            {paidByOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin:0 }}>
          <label>Reimbursement</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width:160 }}>
            <option value="">All</option>
            <option value="pending">Pending Repayment</option>
            <option value="repaid">Repaid</option>
            <option value="company">Company Paid</option>
          </select>
        </div>
        {(catFilter||paidByFilter||statusFilter) && (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf:'end' }}
            onClick={() => { setCatFilter(''); setPaidByFilter(''); setStatusFilter(''); }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Ledger table ── */}
      <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        {loading ? (
          <div className="spinner" style={{ padding:32 }}>Loading…</div>
        ) : (
          <>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <TH>#</TH>
                  <TH>Date</TH>
                  <TH>Description</TH>
                  <TH>Category</TH>
                  <TH>Paid By</TH>
                  <TH right>Amount</TH>
                  <TH>Reimbursement</TH>
                  <TH>Note</TH>
                  <TH></TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:13 }}>No expenses found.</td></tr>
                )}
                {filtered.map((e, i) => {
                  const isPending = e.paid_by && !e.reimbursed_at;
                  const isRepaid  = e.paid_by && !!e.reimbursed_at;
                  const meta      = e.accessory_type ? ACC_META[e.accessory_type] : null;
                  const perNighty = meta && e.qty_purchased ? (e.amount / e.qty_purchased / meta.yieldPcs).toFixed(2) : null;

                  return (
                    <tr key={e.id} style={{
                      borderBottom:'1px solid var(--border)',
                      background: isPending ? '#fffbf0' : isRepaid ? '#f0fdf4' : '#fff',
                    }}>
                      <td style={{ padding:'11px 12px', fontSize:12, color:'var(--muted)', width:36 }}>{i+1}</td>
                      <td style={{ padding:'11px 12px', fontSize:12, whiteSpace:'nowrap', color:'var(--muted)' }}>{fmtDSh(e.expense_date?.slice(0,10))}</td>
                      <td style={{ padding:'11px 12px' }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{e.reason_name}</div>
                        {perNighty && (
                          <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>
                            {e.qty_purchased} {meta.unit} · ₹{perNighty}/nighty
                          </div>
                        )}
                      </td>
                      <td style={{ padding:'11px 12px' }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:12,
                          background: CAT_BG[e.category]||'var(--light)', color: CAT_COLOR[e.category]||'var(--muted)' }}>
                          {CAT_ICON[e.category]} {e.category?.charAt(0).toUpperCase()+e.category?.slice(1)}
                        </span>
                      </td>
                      <td style={{ padding:'11px 12px', fontSize:13, color: e.paid_by ? 'var(--text)' : 'var(--muted)' }}>
                        {e.paid_by || <span style={{ color:'var(--muted)', fontSize:12 }}>Company</span>}
                      </td>
                      <td style={{ padding:'11px 12px', textAlign:'right', fontSize:14, fontWeight:700, color:'var(--red)', whiteSpace:'nowrap' }}>
                        {fmt(e.amount)}
                      </td>
                      <td style={{ padding:'11px 12px', whiteSpace:'nowrap' }}>
                        {!e.paid_by ? (
                          <span style={{ fontSize:12, color:'var(--muted)' }}>—</span>
                        ) : isRepaid ? (
                          <div style={{ display:'flex', flexDirection:'column' }}>
                            <span style={{ fontSize:11, color:'var(--green)', fontWeight:700 }}>Repaid</span>
                            <span style={{ fontSize:10, color:'var(--muted)' }}>by {e.reimbursed_by} · {fmtDSh(e.reimbursed_at?.slice(0,10))}</span>
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ color:'var(--accent)', borderColor:'var(--accent)', padding:'2px 8px', fontSize:11 }}
                            onClick={() => setReimbModal({ id: e.id, name: e.paid_by, amount: e.amount })}>
                            Repay
                          </button>
                        )}
                      </td>
                      <td style={{ padding:'11px 12px', fontSize:12, color:'var(--muted)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {e.note || '—'}
                      </td>
                      <td style={{ padding:'11px 12px' }}>
                        {!archived && (
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 7px', fontSize:11 }} onClick={() => openEdit(e)}>✏️</button>
                            <button className="btn btn-red btn-sm"   style={{ padding:'2px 7px', fontSize:11 }} onClick={() => deleteExpense(e.id)}>✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background:'var(--light)', borderTop:'2px solid var(--border)' }}>
                    <td colSpan={5} style={{ padding:'10px 12px', fontSize:12, fontWeight:700, color:'var(--muted)' }}>
                      {filtered.length} entries
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontSize:15, fontWeight:800, color:'var(--red)' }}>
                      {fmt(totalSpent)}
                    </td>
                    <td colSpan={3} style={{ padding:'10px 12px', fontSize:12, color:'var(--muted)' }}>
                      {totalPending > 0 && <span style={{ color:'#e67e00', fontWeight:700 }}>⏳ {fmt(totalPending)} pending</span>}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>

            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 14, borderTop: '1px solid var(--border)', background: '#fff' }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} style={{
                    width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: page === p ? 'var(--accent)' : 'var(--light)',
                    color: page === p ? '#fff' : 'var(--muted)',
                  }}>{p}</button>
                ))}
                <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Outstanding reimbursements ── */}
      {outstanding.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #f6c97e', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', background:'#fff8ec', borderBottom:'1px solid #f6c97e', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14 }}>⏳</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#92400e' }}>Outstanding Reimbursements</span>
          </div>
          <div style={{ padding:'0 16px' }}>
            {outstanding.map(({ name, amt }) => (
              <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700 }}>{name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>owes reimbursement from company</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:18, fontWeight:800, color:'#e67e00' }}>{fmt(amt)}</span>
                  {!archived && (
                    <button className="btn btn-primary btn-sm"
                      onClick={() => {
                        // Find the most recent unreimbursed expense for this person
                        const e = allExp.find(x => x.paid_by === name && !x.reimbursed_at);
                        if (e) { setReimbModal(e); setReimbBy(''); }
                      }}>
                      💸 Repay
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const now = new Date();
  const [tab, setTab]       = useState('log');
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
  const [paidBy, setPaidBy]       = useState('');
  const [qty, setQty]             = useState('');
  const [saving, setSaving]       = useState(false);

  // New reason inline form
  const [showNewReason, setShowNewReason]   = useState(false);
  const [newReasonName, setNewReasonName]   = useState('');
  const [newReasonCat, setNewReasonCat]     = useState('transport');
  const [newReasonAcc, setNewReasonAcc]     = useState('');

  // Edit modal
  const [editExp, setEditExp]       = useState(null);
  const [editAmt, setEditAmt]       = useState('');
  const [editNote, setEditNote]     = useState('');
  const [editDate, setEditDate]     = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editQty, setEditQty]       = useState('');

  // Overhead
  const [rent, setRent]       = useState('');
  const [elec, setElec]       = useState('');
  const [ohSaving, setOhSaving] = useState(false);

  // Reimbursement modal (shared between tabs)
  const [reimbModal, setReimbModal] = useState(null);
  const [reimbBy, setReimbBy]       = useState('');

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      api.get(`/expenses?month=${month}&year=${year}&limit=1000`).then(r => {
        const data = r.data;
        const list = Array.isArray(data) ? data : (data.data || data.expenses || []);
        setExpenses(list);
        setArchived(!!(data.is_archived));
      }),
      api.get('/expenses/reasons').then(r => setReasons(r.data)),
      api.get(`/expenses/overhead?month=${month}&year=${year}`)
        .then(r => { setOverhead(r.data); setRent(r.data?.rent || ''); setElec(r.data?.electricity || ''); })
        .catch(() => { setOverhead(null); setRent(''); setElec(''); }),
      api.get(`/expenses/summary?month=${month}&year=${year}`).then(r => setSummary(r.data)),
    ]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [month, year]);

  const addExpense = async () => {
    if (!reasonId || !amount) return;
    setSaving(true);
    try {
      await api.post('/expenses', {
        reason_id: +reasonId, amount: +amount, expense_date: expDate,
        notes: note, paid_by: paidBy || null,
        qty_purchased: qty ? +qty : null,
        month, year,
      });
      setReasonId(''); setAmount(''); setNote(''); setPaidBy(''); setQty('');
      loadAll();
    } finally { setSaving(false); }
  };

  const saveNewReason = async () => {
    if (!newReasonName.trim()) return;
    const r = await api.post('/expenses/reasons', {
      name: newReasonName.trim(), category: newReasonCat,
      accessory_type: newReasonAcc || null,
    });
    setNewReasonName(''); setNewReasonAcc(''); setShowNewReason(false);
    await api.get('/expenses/reasons').then(r => setReasons(r.data));
    setReasonId(String(r.data.id));
  };

  const openEdit = e => {
    setEditExp(e);
    setEditAmt(String(e.amount));
    setEditNote(e.note || '');
    setEditDate(e.expense_date?.slice(0,10) || '');
    setEditPaidBy(e.paid_by || '');
    setEditQty(e.qty_purchased ? String(e.qty_purchased) : '');
  };

  const saveEdit = async () => {
    await api.put(`/expenses/${editExp.id}`, {
      amount: +editAmt, notes: editNote, expense_date: editDate,
      paid_by: editPaidBy || null,
      qty_purchased: editQty ? +editQty : null,
    });
    setEditExp(null);
    loadAll();
  };

  const deleteExpense = async id => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    loadAll();
  };

  const saveReimburse = async () => {
    await api.put(`/expenses/${reimbModal.id}/reimburse`, { reimbursed_by: reimbBy || null });
    setReimbModal(null); setReimbBy('');
    loadAll();
  };

  const saveOverhead = async () => {
    setOhSaving(true);
    await api.post('/expenses/overhead', { month, year, rent: rent !== '' ? +rent : 0, electricity: elec !== '' ? +elec : 0 }).catch(() => {});
    setOhSaving(false);
    loadAll();
  };

  const doArchive = async () => {
    await api.post('/expenses/archive', { month, year });
    setShowArchiveBanner(false);
    loadAll();
  };

  const byDay     = expenses.reduce((acc, e) => { const d = (e.expense_date||'').slice(0,10); if(!acc[d])acc[d]=[]; acc[d].push(e); return acc; }, {});
  const sortedDays= Object.keys(byDay).sort((a,b) => b.localeCompare(a));
  const total     = expenses.reduce((s,e) => s + Number(e.amount||0), 0);
  const dayTotal  = day => byDay[day].reduce((s,e) => s+Number(e.amount||0), 0);
  const isToday   = d => d === now.toISOString().slice(0,10);
  const fmtDay    = d => {
    const dt   = new Date(d + 'T00:00:00');
    const base = dt.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    return isToday(d) ? base + ' — Today' : base;
  };

  if (loading) return <div className="spinner">Loading…</div>;

  return (
    <>
      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'2px solid var(--border)' }}>
        {[
          { key:'log',      label:'📋 Log' },
          { key:'accounts', label:'📒 Accounts' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding:'9px 20px', fontSize:13, fontWeight:700, border:'none', cursor:'pointer',
              background:'none', color: tab===t.key ? 'var(--accent)' : 'var(--muted)',
              borderBottom: tab===t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom:-2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Log Tab ── */}
      {tab === 'log' && (
        <>
          {/* Year / Month breadcrumb */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:4 }}>
              {[now.getFullYear(), now.getFullYear()-1].map(y => (
                <div key={y} onClick={() => setYear(y)} style={{
                  padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                  background: year===y ? 'var(--accent)' : 'var(--light)',
                  color: year===y ? '#fff' : 'var(--muted)',
                  border: year===y ? 'none' : '1px solid var(--border)',
                }}>{y}</div>
              ))}
            </div>
            <span style={{ color:'var(--border)', fontSize:16 }}>›</span>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {MONTHS.map((m,i) => (
                <div key={i} onClick={() => setMonth(i+1)} style={{
                  padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                  background: month===i+1 ? 'var(--accent-l)' : 'var(--light)',
                  color: month===i+1 ? 'var(--accent)' : 'var(--muted)',
                  border: month===i+1 ? '1px solid #c4b5fd' : '1px solid var(--border)',
                }}>{m}</div>
              ))}
            </div>
            <span style={{ color:'var(--border)', fontSize:16 }}>›</span>
            <span style={{ fontSize:13, fontWeight:700 }}>{MONTHS[month-1]} {year}</span>
            {!archived
              ? <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={() => setShowArchiveBanner(v => !v)}>📦 Archive {MONTHS[month-1]}</button>
              : <span className="badge b-accent" style={{ marginLeft:'auto' }}>📦 Archived</span>
            }
          </div>

          {showArchiveBanner && (
            <div className="alert alert-yellow mb16">
              <div className="a-icon">📦</div>
              <div style={{ flex:1 }}>
                <div className="a-title">Archive {MONTHS[month-1]} {year}?</div>
                <div className="a-body">All {MONTHS[month-1]} expenses will be locked — no edits allowed.</div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
                <button className="btn btn-primary btn-sm" onClick={doArchive}>Yes, Archive</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowArchiveBanner(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="g21">
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Quick entry */}
              {!archived && (
                <div className="card">
                  <div className="card-hd">
                    Quick Add Expense
                    <a onClick={() => setShowNewReason(v => !v)}>+ New Reason</a>
                  </div>
                  {(() => {
                    const selReason = reasons.find(r => String(r.id) === String(reasonId));
                    const accMeta   = selReason?.accessory_type ? ACC_META[selReason.accessory_type] : null;
                    const perUnit   = accMeta && qty && amount ? (amount / qty).toFixed(2) : null;
                    const perNighty = perUnit ? (perUnit / accMeta.yieldPcs).toFixed(2) : null;
                    return (
                      <>
                        <div style={{ display:'grid', gridTemplateColumns:`1fr${accMeta?' 120px':''} 130px auto`, gap:8, alignItems:'end' }}>
                          <div className="field" style={{ margin:0 }}>
                            <label>Expense Reason</label>
                            <select value={reasonId} onChange={e => { setReasonId(e.target.value); setQty(''); }}>
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
                          {accMeta && (
                            <div className="field" style={{ margin:0 }}>
                              <label>Qty ({accMeta.unit})</label>
                              <input type="number" placeholder={accMeta.hint} value={qty} onChange={e => setQty(e.target.value)} />
                            </div>
                          )}
                          <div className="field" style={{ margin:0 }}>
                            <label>Amount (₹)</label>
                            <input type="number" placeholder="0"
                              style={{ textAlign:'right', fontSize:14, fontWeight:700 }}
                              value={amount} onChange={e => setAmount(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addExpense()} />
                          </div>
                          <button className="btn btn-primary" style={{ alignSelf:'end' }} onClick={addExpense} disabled={saving||!reasonId||!amount}>Save</button>
                        </div>
                        {perNighty && (
                          <div style={{ marginTop:6, padding:'7px 12px', background:'var(--accent-l)', borderRadius:7, fontSize:12, display:'flex', gap:14, flexWrap:'wrap', alignItems:'center' }}>
                            <span>₹{perUnit} / {accMeta.unit.replace(/s$/,'')}</span>
                            <span style={{ color:'var(--muted)' }}>÷ {accMeta.yieldPcs} nighties</span>
                            <span style={{ fontWeight:800, color:'var(--accent)' }}>= ₹{perNighty} / nighty</span>
                          </div>
                        )}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8 }}>
                          <div className="field" style={{ margin:0 }}>
                            <label>Date</label>
                            <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
                          </div>
                          <div className="field" style={{ margin:0 }}>
                            <label>Paid By</label>
                            <input type="text" placeholder="e.g. Salma, Khadeeja…" value={paidBy} onChange={e => setPaidBy(e.target.value)} />
                          </div>
                          <div className="field" style={{ margin:0 }}>
                            <label>Note (optional)</label>
                            <input type="text" placeholder="e.g. from Hamza traders" value={note} onChange={e => setNote(e.target.value)} />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  {showNewReason && (
                    <div style={{ marginTop:12, background:'var(--light)', border:'1px solid var(--border)', borderRadius:8, padding:12 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:8 }}>Create New Expense Reason</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8, alignItems:'end' }}>
                        <div className="field" style={{ margin:0 }}>
                          <label>Reason Name</label>
                          <input placeholder="e.g. Thread Purchase" value={newReasonName} onChange={e => setNewReasonName(e.target.value)} />
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
                        <div className="field" style={{ margin:0 }}>
                          <label>Accessory Type <span style={{ fontWeight:400, color:'var(--muted)' }}>(optional)</span></label>
                          <select value={newReasonAcc} onChange={e => setNewReasonAcc(e.target.value)}>
                            <option value="">— None —</option>
                            <option value="zip">Zip</option>
                            <option value="thread">Thread</option>
                            <option value="canvas">Canvas</option>
                            <option value="plastic">Plastic Bag</option>
                            <option value="lace">Lace</option>
                          </select>
                        </div>
                        <button className="btn btn-primary btn-sm" style={{ alignSelf:'end' }} onClick={saveNewReason}>Save</button>
                      </div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>
                        Set Accessory Type so the Qty field appears when you log this expense — used in the cost calculator.
                      </div>
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
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0 4px', borderBottom:'2px solid var(--border)', marginBottom:2 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>{fmtDay(day)}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{fmt(dayTotal(day))}</span>
                    </div>
                    {byDay[day].map((e, idx) => (
                      <div key={e.id} className="exp-row" style={{ borderBottom: idx===byDay[day].length-1 ? 'none' : undefined }}>
                        <div className="exp-left">
                          <div className="exp-icon" style={{ background: CAT_BG[e.category]||'var(--light)' }}>
                            {e.icon || CAT_ICON[e.category] || '📋'}
                          </div>
                          <div>
                            <div className="exp-title">{e.reason_name}</div>
                            <div className="exp-cat">
                              {e.category?.charAt(0).toUpperCase() + e.category?.slice(1)}
                              {e.qty_purchased ? (() => {
                                const meta = e.accessory_type ? ACC_META[e.accessory_type] : null;
                                const perN = meta ? (e.amount / e.qty_purchased / meta.yieldPcs).toFixed(2) : null;
                                return ` · ${e.qty_purchased} ${meta?.unit||'pcs'}${perN ? ` · ₹${perN}/nighty` : ''}`;
                              })() : ''}
                              {e.paid_by ? ` · 👤 ${e.paid_by}` : ''}
                              {e.note ? ` · ${e.note}` : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="exp-amount">−{fmt(e.amount)}</div>
                          {e.paid_by && (
                            e.reimbursed_at
                              ? <span style={{ fontSize:11, fontWeight:700, color:'var(--green)', background:'var(--green-l)', padding:'2px 8px', borderRadius:12, whiteSpace:'nowrap' }}>✓ Repaid</span>
                              : !archived && (
                                <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px', fontSize:11, color:'var(--green)', whiteSpace:'nowrap' }}
                                  onClick={() => { setReimbModal(e); setReimbBy(''); }}>💸 Repay</button>
                              )
                          )}
                          {!archived && (
                            <>
                              <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px', fontSize:11 }} onClick={() => openEdit(e)}>✏️</button>
                              <button className="btn btn-red btn-sm"   style={{ padding:'3px 8px', fontSize:11 }} onClick={() => deleteExpense(e.id)}>✕</button>
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

              {/* Overhead */}
              <div className="card">
                <div className="card-hd">Monthly Overhead — {MONTHS[month-1]} {year}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div className="field" style={{ margin:0 }}>
                    <label>Rent (₹)</label>
                    <input type="number" placeholder="e.g. 5000" value={rent} onChange={e => setRent(e.target.value)} disabled={archived} />
                  </div>
                  <div className="field" style={{ margin:0 }}>
                    <label>Electricity (₹)</label>
                    <input type="number" placeholder="e.g. 1200" value={elec} onChange={e => setElec(e.target.value)} disabled={archived} />
                  </div>
                </div>
                {!archived && (
                  <button className="btn btn-primary btn-sm" onClick={saveOverhead} disabled={ohSaving}>{ohSaving ? 'Saving…' : 'Save Overhead'}</button>
                )}
                {overhead && (
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:8 }}>
                    Total overhead: {fmt(Number(rent||0) + Number(elec||0))} · Used to calculate cost/pc in Production.
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="stat s-red">
                <div className="s-label">This Month</div>
                <div className="s-val">{fmt(total)}</div>
                <div className="s-sub">Excl. fabric purchases</div>
              </div>
              <div className="card">
                <div className="card-hd">By Category — {MONTHS[month-1]}</div>
                {['transport','materials','setup','other'].map(cat => {
                  const catTotal = expenses.filter(e => e.category===cat).reduce((s,e) => s+Number(e.amount||0), 0);
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
              <div className="card">
                <div className="card-hd">Summary — {MONTHS[month-1]} {year}</div>
                {summary.length === 0
                  ? <div className="empty-state" style={{ padding:'16px 0' }}>No data.</div>
                  : summary.map(s => (
                    <div key={s.category} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                      <span style={{ color:'var(--muted)' }}>{CAT_ICON[s.category]||'📋'} {s.category}</span>
                      <span style={{ fontWeight:700, color:'var(--red)' }}>{fmt(s.total)}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Accounts Tab ── */}
      {tab === 'accounts' && (
        <AccountsTab
          reasons={reasons}
          reimbModal={reimbModal} setReimbModal={setReimbModal}
          reimbBy={reimbBy} setReimbBy={setReimbBy}
          saveReimburse={saveReimburse}
          openEdit={openEdit}
          deleteExpense={deleteExpense}
          archived={archived}
        />
      )}

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
              <div className="field">
                <label>Paid By</label>
                <input value={editPaidBy} onChange={e => setEditPaidBy(e.target.value)} placeholder="e.g. Salma, Khadeeja…" />
              </div>
              {editExp?.accessory_type && (
                <div className="field">
                  <label>Qty ({ACC_META[editExp.accessory_type]?.unit || 'pcs'})</label>
                  <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)}
                    placeholder={ACC_META[editExp.accessory_type]?.hint} />
                </div>
              )}
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

      {/* Reimbursement modal */}
      {reimbModal && (
        <div className="modal-overlay" onClick={() => setReimbModal(null)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <h2>Repay Expense</h2>
            <p style={{ fontSize:13, color:'var(--muted)', margin:'8px 0 16px' }}>
              <b>{reimbModal.reason_name}</b> — {fmt(reimbModal.amount)} paid by <b>{reimbModal.paid_by}</b>
            </p>
            <div className="field">
              <label>Repaid by <span style={{ fontWeight:400, color:'var(--muted)' }}>(optional)</span></label>
              <input value={reimbBy} onChange={e => setReimbBy(e.target.value)} placeholder="e.g. company account…" autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setReimbModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveReimburse}>Mark as Repaid</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
