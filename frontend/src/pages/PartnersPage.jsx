import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function PartnersPage() {
  const [partners, setPartners]   = useState([]);
  const [reminders, setReminders] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [showRem, setShowRem]     = useState(false);
  const [loading, setLoading]     = useState(true);

  const [payForm, setPayForm] = useState({
    amount: '', mode: 'cash', note: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [remForm, setRemForm] = useState({ note: '', type: 'warning' });

  const load = () => Promise.all([
    api.get('/partners').then(r => setPartners(r.data)),
    api.get('/partners/reminders').then(r => setReminders(r.data)),
  ]).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const addPayment = async () => {
    if (!selectedPartner || !payForm.amount) return;
    await api.post('/partners/payments', {
      partner_id:   selectedPartner.id,
      amount:       +payForm.amount,
      payment_date: payForm.date,
      mode:         payForm.mode,
      note:         payForm.note || null,
    });
    setPayForm({ amount: '', mode: 'cash', note: '', date: new Date().toISOString().slice(0, 10) });
    setSelectedPartner(null);
    load();
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

  const pendingReminders = reminders.filter(r => !r.is_resolved);

  if (loading) return <div className="spinner">Loading…</div>;

  return (
    <>
      {/* Active reminder banners */}
      {pendingReminders.map(r => (
        <div key={r.id} className={`reminder ${r.type === 'critical' ? 'reminder-red' : 'reminder-yellow'} mb12`}>
          <div className="r-icon">{r.type === 'critical' ? '🔔' : '⏰'}</div>
          <div style={{ flex: 1 }}>
            <div className="r-title">{r.title}</div>
            {r.body && r.body !== r.title && <div className="r-body">{r.body}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => resolveReminder(r.id)}>
            Resolve
          </button>
        </div>
      ))}

      {/* Partner cards */}
      <div className="g2 mb16">
        {partners.map((p, i) => {
          const paid   = Number(p.paid_capital || 0);
          const target = Number(p.committed_capital || 0);
          const pct    = target > 0 ? Math.min(100, Math.round(paid / target * 100)) : 0;
          const isPaid = paid >= target && target > 0;
          const styles = [
            { card: 'pc-a', fill: 'var(--accent)' },
            { card: 'pc-b', fill: 'var(--cyan)' },
          ];
          const s = styles[i % 2];
          return (
            <div key={p.id} className={`partner-card ${s.card}`}>
              <div className="pc-name">
                <span>{p.name}</span>
                {isPaid
                  ? <span className="badge b-green">✓ Fully Paid</span>
                  : <span className="badge b-yellow">⏳ Balance Pending</span>}
              </div>
              <div className="pc-amount">{fmt(paid)}</div>
              <div className="pc-sub">
                Committed: {fmt(target)} · Paid: {fmt(paid)} · Pending: {fmt(Math.max(0, target - paid))}
              </div>
              <div className="progress mt8">
                <div className="progress-fill" style={{ width: pct + '%', background: s.fill }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                <span>{Math.round(100 / Math.max(partners.length, 1))}% stake</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedPartner(p)}
                  style={{ color: 'var(--accent)' }}
                >
                  + Add Payment
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="g2">
        {/* Record payment form */}
        <div className="card">
          <div className="card-hd">Record Capital Payment</div>
          <div className="form-grid">
            <div className="field">
              <label>Partner</label>
              <select
                value={selectedPartner?.id || ''}
                onChange={e => setSelectedPartner(partners.find(p => p.id === +e.target.value) || null)}
              >
                <option value="">Select partner…</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Amount Paid (₹)</label>
              <input
                type="number" placeholder="e.g. 45000"
                value={payForm.amount}
                onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Mode</label>
              <select value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="upi">UPI / NEFT</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="field form-full">
              <label>Note (optional)</label>
              <input
                type="text" placeholder="e.g. First tranche"
                value={payForm.note}
                onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          {selectedPartner && payForm.amount && (
            <div className="calc-box mt12">
              <div className="calc-row">
                <span className="cl">Recording payment for</span>
                <span className="cv">{selectedPartner.name}</span>
              </div>
              <div className="calc-row">
                <span className="cl">Amount</span>
                <span className="cv green">{fmt(+payForm.amount)}</span>
              </div>
            </div>
          )}
          <div className="row mt12">
            <button
              className="btn btn-primary"
              onClick={addPayment}
              disabled={!selectedPartner || !payForm.amount}
            >
              Save Payment
            </button>
            <button className="btn btn-ghost" onClick={() => {
              setSelectedPartner(null);
              setPayForm({ amount: '', mode: 'cash', note: '', date: new Date().toISOString().slice(0, 10) });
            }}>
              Clear
            </button>
          </div>
        </div>

        {/* Reminders panel */}
        <div className="card">
          <div className="card-hd">
            Active Reminders
            <a onClick={() => setShowRem(true)}>+ Add Reminder</a>
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
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: r.is_resolved ? 'var(--muted)' : r.type === 'critical' ? 'var(--red)' : 'var(--yellow)',
                  }}>
                    {r.type === 'critical' ? '🔴' : r.is_resolved ? '✅' : '⏳'} {r.title}
                  </div>
                  <span className={`badge ${r.is_resolved ? 'b-gray' : r.type === 'critical' ? 'b-red' : 'b-yellow'}`}>
                    {r.is_resolved ? 'Resolved' : r.type === 'critical' ? 'Track' : 'Open'}
                  </span>
                </div>
                {r.body && r.body !== r.title && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{r.body}</div>
                )}
                {!r.is_resolved && (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => resolveReminder(r.id)}>
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add reminder modal */}
      {showRem && (
        <div className="modal-overlay" onClick={() => setShowRem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Reminder</h2>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Note</label>
              <input
                autoFocus
                placeholder="e.g. Collect Partner B balance"
                value={remForm.note}
                onChange={e => setRemForm(f => ({ ...f, note: e.target.value }))}
              />
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
