import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function DashboardPage() {
  const [stats, setStats]           = useState(null);
  const [reminders, setReminders]   = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/stock/dashboard').then(r => setStats(r.data)),
      api.get('/partners/reminders').then(r => setReminders(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const resolveReminder = async id => {
    await api.put(`/partners/reminders/${id}/resolve`);
    setReminders(rs => rs.map(r => r.id === id ? { ...r, is_resolved: true } : r));
  };

  if (loading) return <div className="spinner">Loading dashboard…</div>;

  const pendingReminders = reminders.filter(r => !r.is_resolved);

  return (
    <>
      {/* Dynamic reminder alerts */}
      {pendingReminders.map(r => (
        <div key={r.id} className={`alert ${r.type === 'critical' ? 'alert-red' : 'alert-yellow'} mb12`}>
          <div className="a-icon">{r.type === 'critical' ? '⚠️' : '📌'}</div>
          <div style={{ flex: 1 }}>
            <div className="a-title">{r.title}</div>
            {r.body && r.body !== r.title && <div className="a-body">{r.body}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => resolveReminder(r.id)}>Dismiss</button>
        </div>
      ))}

      {/* KPI row */}
      <div className="g4 mb16">
        <div className="stat s-green">
          <div className="s-label">Cash in Hand</div>
          <div className="s-val">{fmt(stats?.cash_in_hand)}</div>
          <div className="s-sub">After all expenses</div>
        </div>
        <div className="stat s-accent">
          <div className="s-label">Total Capital</div>
          <div className="s-val">{fmt(stats?.capital)}</div>
          <div className="s-sub">Partners combined</div>
        </div>
        <div className="stat s-cyan">
          <div className="s-label">Stock on Hand</div>
          <div className="s-val">{stats?.stock_available ?? 0} pcs</div>
          <div className="s-sub">Ready / unallocated</div>
        </div>
        <div className="stat s-yellow">
          <div className="s-label">In Production</div>
          <div className="s-val">{stats?.stock_allocated ?? 0} pcs</div>
          <div className="s-sub">{stats?.active_batches ?? 0} active batch{stats?.active_batches !== 1 ? 'es' : ''}</div>
        </div>
      </div>

      {/* Body */}
      <div className="g21">
        {/* Capital flow */}
        <div className="card">
          <div className="card-hd">Capital Flow Summary <a>View Expenses →</a></div>
          <div className="info-list">
            <div className="il-row">
              <span className="il-label">💰 Total Partner Capital</span>
              <span className="il-val" style={{ color: 'var(--green)' }}>+{fmt(stats?.capital)}</span>
            </div>
            <div className="il-row">
              <span className="il-label">📦 Fabric Purchases</span>
              <span className="il-val" style={{ color: 'var(--red)' }}>−{fmt(stats?.fabric_purchases)}</span>
            </div>
            <div className="il-row">
              <span className="il-label">🧾 Other Expenses</span>
              <span className="il-val" style={{ color: 'var(--red)' }}>−{fmt(stats?.other_expenses)}</span>
            </div>
            <div className="il-row">
              <span className="il-label">👷 Labour Liability (pending)</span>
              <span className="il-val" style={{ color: 'var(--yellow)' }}>{fmt(stats?.labor_liability)}</span>
            </div>
            <hr className="divider" />
            <div className="il-row">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Cash Remaining</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: stats?.cash_in_hand >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(stats?.cash_in_hand)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-hd">Stock Summary</div>
            <div className="info-list">
              <div className="il-row">
                <span className="il-label">Total Received</span>
                <span className="il-val">{stats?.stock_in ?? 0} pcs</span>
              </div>
              <div className="il-row">
                <span className="il-label">In Production</span>
                <span className="badge b-accent">{stats?.stock_allocated ?? 0} pcs</span>
              </div>
              <div className="il-row">
                <span className="il-label">Available</span>
                <span className="badge b-green">{stats?.stock_available ?? 0} pcs</span>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-hd">Production</div>
            <div className="info-list">
              <div className="il-row">
                <span className="il-label">Active Batches</span>
                <span className="badge b-yellow">{stats?.active_batches ?? 0}</span>
              </div>
              <div className="il-row">
                <span className="il-label">Labour Pending</span>
                <span className="il-val" style={{ color: 'var(--red)' }}>{fmt(stats?.labor_liability)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
