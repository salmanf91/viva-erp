import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats]     = useState(null);
  const [pnl, setPnl]         = useState(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();

  const isVivaStudio = !user?.tenant_id || user?.tenant_id === 'viva-studio' || user?.tenant_name?.toLowerCase().includes('viva');

  useEffect(() => {
    const m = now.getMonth() + 1, y = now.getFullYear();
    Promise.all([
      api.get('/stock/dashboard').then(r => setStats(r.data)),
      api.get(`/finance/pnl?month=${m}&year=${y}`).then(r => setPnl(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner">Loading dashboard…</div>;

  return (
    <>
      {/* Quick Catalog & Pricing Access Bar */}
      <div className="card mb16" style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        boxShadow: '0 4px 14px rgba(49, 46, 129, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🏷️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>Product Catalogs &amp; Rate Lists</h3>
                <div style={{ fontSize: 12, color: '#c7d2fe', marginTop: 2 }}>
                  View wholesale, vendor &amp; customer prices, or manage design rates and profit margins in one place.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link
              to="/catalog-pricing"
              className="btn btn-sm"
              style={{ background: '#4f46e5', color: '#fff', fontWeight: 700, border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none' }}
              title="Open full rate master spreadsheet table"
            >
              📊 All Rates Master Table
            </Link>
            <Link
              to="/catalog/wholesale"
              target="_blank"
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none' }}
              title="View Wholesale Catalog"
            >
              🏢 Wholesale ↗
            </Link>
            <Link
              to="/catalog/retail-vendor"
              target="_blank"
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none' }}
              title="View Retail Vendor Catalog"
            >
              🏬 Retail Vendor ↗
            </Link>
            <Link
              to="/catalog/retail-customer"
              target="_blank"
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none' }}
              title="View Retail Customer Catalog"
            >
              🛍️ Customer ↗
            </Link>
            {isVivaStudio && (
              <Link
                to="/catalog/uae-vendor"
                target="_blank"
                className="btn btn-sm"
                style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', border: '1px solid rgba(52, 211, 153, 0.4)', textDecoration: 'none', fontWeight: 700 }}
                title="View UAE Vendor Catalog in Dirhams"
              >
                🇦🇪 UAE Vendor (AED) ↗
              </Link>
            )}
          </div>
        </div>
      </div>

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
          <div className="s-val">{stats?.stock_remaining ?? 0} pcs</div>
          <div className="s-sub">Finished &amp; ready to dispatch</div>
        </div>
        <div className="stat s-yellow">
          <div className="s-label">In Production</div>
          <div className="s-val">{stats?.stock_allocated ?? 0} pcs</div>
          <div className="s-sub">{stats?.active_batches ?? 0} active batch{stats?.active_batches !== 1 ? 'es' : ''}</div>
        </div>
      </div>

      {/* P&L snapshot */}
      {pnl && (
        <div className="card mb16">
          <div className="card-hd">
            📈 {now.toLocaleString('en-IN', { month: 'long' })} P&L Snapshot
            <a href="/finance">Full Report →</a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
            {[
              { label: 'Revenue',      value: fmt(pnl.revenue),      color: 'var(--green)' },
              { label: 'COGS',         value: fmt(pnl.cogs.total),   color: 'var(--red)'   },
              { label: 'OpEx',         value: fmt(pnl.opex.total),   color: 'var(--red)'   },
              { label: 'Net Profit',   value: fmt(pnl.net_profit),   color: pnl.net_profit >= 0 ? 'var(--green)' : 'var(--red)' },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: '10px 16px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Stock Summary</span>
              <a href="#/stock" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>View Stock →</a>
            </div>
            <div className="info-list">
              <div className="il-row">
                <span className="il-label">Total Fabric Received</span>
                <span className="il-val">{stats?.stock_in ?? 0} pcs</span>
              </div>
              <div className="il-row">
                <span className="il-label">In Production (Active)</span>
                <span className="badge b-yellow">{stats?.stock_allocated ?? 0} pcs</span>
              </div>
              <div className="il-row">
                <span className="il-label">Finished (Produced)</span>
                <span className="il-val" style={{ fontWeight: 700, color: 'var(--cyan, #0891b2)' }}>{stats?.stock_finished ?? 0} pcs</span>
              </div>
              <div className="il-row">
                <span className="il-label">Sold / Dispatched</span>
                <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>{stats?.stock_sold ?? 0} pcs</span>
              </div>
              <div className="il-row">
                <span className="il-label">Finished Goods (On Hand)</span>
                <span className="badge b-green">{stats?.stock_remaining ?? 0} pcs</span>
              </div>
              <div className="il-row">
                <span className="il-label">Available Raw Fabric</span>
                <span className="badge b-cyan">{stats?.stock_available ?? 0} pcs</span>
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
