import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt  = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const INV_SOURCES = [
  { value: 'own',             label: 'Own Funds' },
  { value: 'external_credit', label: 'External Credit / Loan' },
  { value: 'income',          label: 'Other Income' },
];
const DRW_SOURCES = [
  { value: 'personal',      label: 'Personal Use' },
  { value: 'expense_repay', label: 'Expense Repayment' },
  { value: 'loan_repay',    label: 'Loan Repayment' },
  { value: 'other',         label: 'Other' },
];
const SOURCE_LABEL = Object.fromEntries([...INV_SOURCES, ...DRW_SOURCES].map(s => [s.value, s.label]));
const PARTNER_COLORS = ['var(--accent)', 'var(--cyan)', 'var(--green)'];

const TAB_STYLE = (active) => ({
  padding: '9px 20px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
  background: 'none', color: active ? 'var(--accent)' : 'var(--muted)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2,
  transition: 'all .15s',
});

export default function PartnersPage() {
  const [tab, setTab]             = useState('overview');   // 'overview' | 'ledger' | 'reminders'
  const [partners, setPartners]   = useState([]);
  const [reminders, setReminders] = useState([]);
  const [ledger, setLedger]       = useState({});           // { [partnerId]: [...rows] }
  const [activePid, setActivePid] = useState(null);         // selected partner for capital ledger tab
  const [loading, setLoading]     = useState(true);
  const [showRem, setShowRem]     = useState(false);
  const [remForm, setRemForm]     = useState({ note: '', type: 'warning' });

  // ── Capital form state ──
  const emptyForm = () => ({
    partner_id: '', type: 'investment', source: 'own',
    amount: '', mode: 'cash', note: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [form, setForm] = useState(emptyForm());

  const load = () => Promise.all([
    api.get('/partners').then(r => setPartners(r.data)),
    api.get('/partners/reminders').then(r => setReminders(r.data)),
  ]).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  // auto-select first partner for capital ledger tab
  useEffect(() => {
    if (partners.length && !activePid) setActivePid(partners[0].id);
  }, [partners]);

  const loadLedger = async id => {
    const r = await api.get(`/partners/${id}/ledger`);
    setLedger(prev => ({ ...prev, [id]: r.data }));
  };

  useEffect(() => {
    if (tab === 'ledger' && activePid && !ledger[activePid]) loadLedger(activePid);
  }, [tab, activePid]);

  const saveTransaction = async () => {
    if (!form.partner_id || !form.amount) return;
    await api.post('/partners/payments', {
      partner_id: +form.partner_id, amount: +form.amount,
      type: form.type, source: form.source,
      payment_date: form.date, mode: form.mode, note: form.note || null,
    });
    setForm(emptyForm());
    await load();
    if (activePid) {
      const r = await api.get(`/partners/${activePid}/ledger`);
      setLedger(prev => ({ ...prev, [activePid]: r.data }));
    }
  };

  const addReminder = async () => {
    if (!remForm.note.trim()) return;
    await api.post('/partners/reminders', { note: remForm.note, type: remForm.type });
    setShowRem(false);
    setRemForm({ note: '', type: 'warning' });
    load();
  };

  const resolveReminder = async id => {
    await api.put(`/partners/reminders/${id}/resolve`);
    load();
  };

  if (loading) return <div className="spinner">Loading…</div>;

  const pendingReminders = reminders.filter(r => !r.is_resolved);
  const sources = form.type === 'investment' ? INV_SOURCES : DRW_SOURCES;

  return (
    <>
      {/* Header */}
      <div className="sec-hd mb16">
        <div>
          <div className="sec-title">Capital &amp; Partners</div>
          <div className="sec-sub">
            Equity Investment, Drawings &amp; Partner Capital Ledgers
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button style={TAB_STYLE(tab === 'overview')} onClick={() => setTab('overview')}>
          💼 Capital Overview
        </button>
        <button style={TAB_STYLE(tab === 'ledger')} onClick={() => setTab('ledger')}>
          📒 Capital Ledger
        </button>
        <button style={TAB_STYLE(tab === 'reminders')} onClick={() => setTab('reminders')}>
          🔔 Reminders {pendingReminders.length > 0 && <span className="badge b-yellow" style={{ fontSize: 10, marginLeft: 4 }}>{pendingReminders.length}</span>}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: 💼 CAPITAL OVERVIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* Partner summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${partners.length + 1}, 1fr)`, gap: 12, marginBottom: 20 }}>
            {partners.map((p, i) => {
              const invested = Number(p.total_invested || 0);
              const drawn    = Number(p.total_drawn    || 0);
              const net      = Number(p.net_capital    || 0);
              const color    = PARTNER_COLORS[i % PARTNER_COLORS.length];
              return (
                <div key={p.id} className="card" style={{ borderTop: `3px solid ${color}`, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color, marginBottom: 10 }}>{p.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Total Invested</span>
                      <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(invested)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Total Drawn</span>
                      <span style={{ fontWeight: 700, color: drawn > 0 ? 'var(--red)' : 'var(--muted)' }}>−{fmt(drawn)}</span>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ fontWeight: 700 }}>Net Capital</span>
                      <span style={{ fontWeight: 800, color }}>{fmt(net)}</span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm"
                    style={{ marginTop: 12, width: '100%', fontSize: 12, color }}
                    onClick={() => { setActivePid(p.id); setTab('ledger'); }}>
                    📒 View Capital Ledger
                  </button>
                </div>
              );
            })}
            {/* Combined */}
            <div className="card" style={{ borderTop: '3px solid var(--muted)', padding: '16px 18px', background: 'var(--light)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Combined Capital</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Total Invested</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(partners.reduce((s, p) => s + Number(p.total_invested || 0), 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Total Drawn</span>
                  <span style={{ fontWeight: 700, color: 'var(--red)' }}>−{fmt(partners.reduce((s, p) => s + Number(p.total_drawn || 0), 0))}</span>
                </div>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ fontWeight: 700 }}>Net Capital</span>
                  <span style={{ fontWeight: 800 }}>{fmt(partners.reduce((s, p) => s + Number(p.net_capital || 0), 0))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Record capital transaction form */}
          <div className="card">
            <div className="card-hd">Record Capital Transaction</div>
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxWidth: 300 }}>
              {[
                { val: 'investment', label: '↑ Investment', color: 'var(--green)' },
                { val: 'drawing',    label: '↓ Drawing',    color: 'var(--red)' },
              ].map(t => (
                <button key={t.val} onClick={() => setForm(f => ({ ...f, type: t.val, source: t.val === 'investment' ? 'own' : 'personal' }))}
                  style={{
                    flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: form.type === t.val ? t.color : 'var(--white)',
                    color: form.type === t.val ? '#fff' : 'var(--muted)',
                    transition: 'all .15s',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Partner</label>
                <select value={form.partner_id} onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))}>
                  <option value="">Select partner…</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Amount (₹)</label>
                <input type="number" placeholder="e.g. 15000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="field">
                <label>{form.type === 'investment' ? 'Source' : 'Reason'}</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Mode</label>
                <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / NEFT</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="field">
                <label>Note <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
                <input placeholder="e.g. First tranche" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            {form.partner_id && form.amount && (
              <div className="calc-box mt12" style={{
                borderColor: form.type === 'investment' ? '#86efac' : '#fca5a5',
                background:  form.type === 'investment' ? '#f0fdf4'  : '#fef2f2',
              }}>
                <div className="calc-row">
                  <span className="cl">{partners.find(p => p.id === +form.partner_id)?.name}</span>
                  <span className="cv">{form.type === 'investment' ? '↑ Investment' : '↓ Drawing'}</span>
                </div>
                <div className="calc-row">
                  <span className="cl">{SOURCE_LABEL[form.source]}</span>
                  <span className="cv" style={{ color: form.type === 'investment' ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>
                    {form.type === 'investment' ? '+' : '−'}{fmt(+form.amount)}
                  </span>
                </div>
              </div>
            )}
            <div className="row mt12">
              <button className="btn btn-primary" onClick={saveTransaction} disabled={!form.partner_id || !form.amount}>Save Capital Transaction</button>
              <button className="btn btn-ghost" onClick={() => setForm(emptyForm())}>Clear</button>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: 📒 CAPITAL LEDGER
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'ledger' && (
        <div className="card">
          {/* Partner selector tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {partners.map((p, i) => {
              const color = PARTNER_COLORS[i % PARTNER_COLORS.length];
              const active = activePid === p.id;
              return (
                <button key={p.id}
                  onClick={() => { setActivePid(p.id); if (!ledger[p.id]) loadLedger(p.id); }}
                  style={{
                    padding: '7px 18px', borderRadius: 8, border: `2px solid ${active ? color : 'var(--border)'}`,
                    background: active ? color : 'var(--white)', color: active ? '#fff' : 'var(--text)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>
                  {p.name}
                </button>
              );
            })}
          </div>

          {(() => {
            const p     = partners.find(x => x.id === activePid);
            const rows  = ledger[activePid] || [];
            const color = PARTNER_COLORS[partners.indexOf(p) % PARTNER_COLORS.length];
            if (!p) return null;
            return (
              <>
                {/* Mini summary */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total Invested', value: fmt(p.total_invested), color: 'var(--green)' },
                    { label: 'Total Drawn',    value: fmt(p.total_drawn),    color: 'var(--red)' },
                    { label: 'Net Capital',    value: fmt(p.net_capital),    color },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--light)', borderRadius: 8, padding: '10px 16px', minWidth: 140 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {rows.length === 0
                  ? <div className="empty-state">No capital transactions yet.</div>
                  : (
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Source / Reason</th>
                          <th>Mode</th>
                          <th>Note</th>
                          <th style={{ textAlign: 'right', color: 'var(--green)' }}>Invested (+)</th>
                          <th style={{ textAlign: 'right', color: 'var(--red)' }}>Drawn (−)</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, idx) => (
                          <tr key={r.id} style={{ background: r.type === 'drawing' ? 'var(--red-l)' : 'inherit' }}>
                            <td style={{ color: 'var(--muted)', fontSize: 12 }}>{idx + 1}</td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtD(r.payment_date?.slice(0, 10))}</td>
                            <td>
                              {r.type === 'investment'
                                ? <span className="badge b-green" style={{ fontSize: 11 }}>↑ Investment</span>
                                : <span className="badge b-red"   style={{ fontSize: 11 }}>↓ Drawing</span>}
                            </td>
                            <td style={{ fontSize: 12 }}>{SOURCE_LABEL[r.source] || r.source || '—'}</td>
                            <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{r.mode || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.note || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>
                              {r.type === 'investment' ? fmt(r.amount) : ''}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>
                              {r.type === 'drawing' ? fmt(r.amount) : ''}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color }}>
                              {fmt(r.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--light)', fontWeight: 800 }}>
                          <td colSpan={6} style={{ fontSize: 13, color: 'var(--muted)' }}>Net Capital</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)', fontSize: 13 }}>{fmt(p.total_invested)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--red)', fontSize: 13 }}>−{fmt(p.total_drawn)}</td>
                          <td style={{ textAlign: 'right', color, fontSize: 14 }}>{fmt(p.net_capital)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
              </>
            );
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: 🔔 REMINDERS
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'reminders' && (
        <div className="card">
          <div className="card-hd">
            Reminders
            <a onClick={() => setShowRem(true)}>+ Add</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reminders.length === 0 && <div className="empty-state">No reminders.</div>}
            {reminders.map(r => (
              <div key={r.id} style={{
                border: `1px solid ${r.is_resolved ? 'var(--border)' : r.type === 'critical' ? '#fca5a5' : '#fcd34d'}`,
                background: r.is_resolved ? 'var(--light)' : r.type === 'critical' ? 'var(--red-l)' : 'var(--yellow-l)',
                borderRadius: 8, padding: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: r.is_resolved ? 'var(--muted)' : r.type === 'critical' ? 'var(--red)' : 'var(--yellow)' }}>
                    {r.type === 'critical' ? '🔴' : r.is_resolved ? '✅' : '⏳'} {r.title}
                  </div>
                  <span className={`badge ${r.is_resolved ? 'b-gray' : r.type === 'critical' ? 'b-red' : 'b-yellow'}`}>
                    {r.is_resolved ? 'Resolved' : r.type === 'critical' ? 'Critical' : 'Open'}
                  </span>
                </div>
                {r.body && r.body !== r.title && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{r.body}</div>}
                {!r.is_resolved && (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => resolveReminder(r.id)}>Mark Resolved</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add reminder modal */}
      {showRem && (
        <div className="modal-overlay" onClick={() => setShowRem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Reminder</h2>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Note</label>
              <input autoFocus placeholder="e.g. Collect Partner B balance"
                value={remForm.note} onChange={e => setRemForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 4 }}>
              <label>Type</label>
              <select value={remForm.type} onChange={e => setRemForm(f => ({ ...f, type: e.target.value }))}>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowRem(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addReminder} disabled={!remForm.note.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
