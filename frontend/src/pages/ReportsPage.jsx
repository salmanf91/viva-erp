import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { exportToCSV } from '../utils/csvExport';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = n => Number(n || 0).toLocaleString('en-IN');
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtShort = fmtD;
const CAT_LABEL = { shawl_nighty: 'Shawl Nighty', ordinary_nighty: 'Ordinary Nighty', shawl_nighty_lace: 'Shawl + Lace' };
const getProductLabel = cat => CAT_LABEL[cat] || (cat ? cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—');

const toDateStr = d => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const REPORT_SECTIONS = [
  {
    id: 'executive',
    label: 'Executive & Financials',
    icon: '📊',
    tabs: [
      { id: 'overview', label: 'Executive Overview', icon: '📊' },
      { id: 'pnl', label: 'P&L Statement', icon: '📈' },
    ]
  },
  {
    id: 'commercial',
    label: 'Commercial & Sales',
    icon: '💼',
    tabs: [
      { id: 'sales', label: 'Sales Report', icon: '🚚' },
      { id: 'purchases', label: 'Fabric Purchases', icon: '📦' },
    ]
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing & Stock',
    icon: '🏭',
    tabs: [
      { id: 'production', label: 'Production Log', icon: '✂️' },
      { id: 'inventory', label: 'Inventory & Stock', icon: '🏭' },
    ]
  },
  {
    id: 'people',
    label: 'People & Overheads',
    icon: '👥',
    tabs: [
      { id: 'staff', label: 'Staff & Payroll', icon: '👷' },
      { id: 'expenses', label: 'Operating Expenses', icon: '🧾' },
    ]
  }
];

export default function ReportsPage() {
  const now = new Date();
  const [preset, setPreset] = useState('this_month');
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [toDate, setToDate] = useState(toDateStr(now));
  const [customFrom, setCustomFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [customTo, setCustomTo] = useState(toDateStr(now));
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Active section based on activeTab
  const activeSection = REPORT_SECTIONS.find(s => s.tabs.some(t => t.id === activeTab)) || REPORT_SECTIONS[0];

  // Tab Data States
  const [overviewData, setOverviewData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [purchaseData, setPurchaseData] = useState(null);
  const [productionData, setProductionData] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);

  // Preset Date Range Changer
  const applyPreset = p => {
    setPreset(p);
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (p === 'custom') {
      setIsCustomOpen(true);
      return;
    }
    setIsCustomOpen(false);

    if (p === 'today') {
      const dStr = toDateStr(today);
      setFromDate(dStr);
      setToDate(dStr);
      setCustomFrom(dStr);
      setCustomTo(dStr);
    } else if (p === 'this_week') {
      const first = new Date(today);
      first.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      const fStr = toDateStr(first);
      const tStr = toDateStr(today);
      setFromDate(fStr);
      setToDate(tStr);
      setCustomFrom(fStr);
      setCustomTo(tStr);
    } else if (p === 'this_month') {
      const fStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const tStr = toDateStr(today);
      setFromDate(fStr);
      setToDate(tStr);
      setCustomFrom(fStr);
      setCustomTo(tStr);
    } else if (p === 'last_month') {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(ly, lm + 1, 0).getDate();
      const fStr = `${ly}-${String(lm + 1).padStart(2, '0')}-01`;
      const tStr = `${ly}-${String(lm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setFromDate(fStr);
      setToDate(tStr);
      setCustomFrom(fStr);
      setCustomTo(tStr);
    } else if (p === 'this_quarter') {
      const qMonth = Math.floor(m / 3) * 3;
      const fStr = `${y}-${String(qMonth + 1).padStart(2, '0')}-01`;
      const tStr = toDateStr(today);
      setFromDate(fStr);
      setToDate(tStr);
      setCustomFrom(fStr);
      setCustomTo(tStr);
    } else if (p === 'this_year') {
      const fStr = `${y}-01-01`;
      const tStr = toDateStr(today);
      setFromDate(fStr);
      setToDate(tStr);
      setCustomFrom(fStr);
      setCustomTo(tStr);
    }
  };

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) return;
    setPreset('custom');
    setFromDate(customFrom);
    setToDate(customTo);
    setIsCustomOpen(false);
  };

  const loadReport = useCallback(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setErrorMsg(null);
    const params = { from: fromDate, to: toDate };

    let reqPromise;
    if (activeTab === 'overview') {
      reqPromise = api.get('/reports/overview', { params }).then(r => setOverviewData(r.data));
    } else if (activeTab === 'sales') {
      reqPromise = api.get('/reports/sales', { params }).then(r => setSalesData(r.data));
    } else if (activeTab === 'purchases') {
      reqPromise = api.get('/reports/purchases', { params }).then(r => setPurchaseData(r.data));
    } else if (activeTab === 'production') {
      reqPromise = api.get('/reports/production', { params }).then(r => setProductionData(r.data));
    } else if (activeTab === 'staff') {
      reqPromise = api.get('/reports/staff', { params }).then(r => setStaffData(r.data));
    } else if (activeTab === 'expenses') {
      reqPromise = api.get('/reports/expenses', { params }).then(r => setExpenseData(r.data));
    } else if (activeTab === 'pnl') {
      reqPromise = api.get('/reports/pnl', { params }).then(r => setPnlData(r.data));
    } else if (activeTab === 'inventory') {
      reqPromise = api.get('/reports/inventory', { params }).then(r => setInventoryData(r.data));
    }

    if (reqPromise) {
      reqPromise
        .catch(err => {
          console.error('Report fetch error:', err);
          setErrorMsg(err.response?.data?.message || err.message || 'Failed to load report data');
        })
        .finally(() => setLoading(false));
    }
  }, [activeTab, fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // CSV Export utility
  const exportCSV = () => {
    let filename = `viva_report_${activeTab}_${fromDate}_to_${toDate}`;
    let headers = [];
    let rows = [];

    if (activeTab === 'sales' && salesData?.orders) {
      headers = ['Order Date', 'Invoice No', 'Client Name', 'City', 'Pieces', 'Total (₹)', 'Paid (₹)', 'Balance (₹)', 'Status'];
      rows = salesData.orders.map(o => [
        o.order_date, o.invoice_number, o.client_name, o.client_city || '',
        o.total_pieces, o.total, o.amount_paid, o.balance_due, o.status
      ]);
    } else if (activeTab === 'purchases' && purchaseData?.purchases) {
      headers = ['Invoice Date', 'Vendor Name', 'Quantity', 'Freight', 'Coolie', 'Tax', 'Advance Paid', 'Total (₹)', 'Status'];
      rows = purchaseData.purchases.map(p => [
        p.invoice_date, p.vendor_name, p.total_quantity, p.freight, p.coolie, p.tax_amount, p.advance_paid, p.total, p.status
      ]);
    } else if (activeTab === 'staff' && staffData?.staff_summary) {
      headers = ['Staff Name', 'Role', 'Total Allocated', 'Total Completed', 'Cut Pcs', 'Stitch Pcs', 'Total Earned (₹)', 'Settled (₹)', 'Pending (₹)'];
      rows = staffData.staff_summary.map(s => [
        s.staff_name, s.staff_role, s.total_allocated, s.total_completed, s.cut_pieces, s.stitch_pieces, s.total_earned, s.settled_amount, s.pending_amount
      ]);
    } else if (activeTab === 'expenses' && expenseData?.expenses) {
      headers = ['Expense Date', 'Reason', 'Category', 'Paid By', 'Amount (₹)', 'Reimbursed'];
      rows = expenseData.expenses.map(e => [
        e.expense_date, e.reason_name, e.reason_category, e.paid_by || 'Company', e.amount, e.reimbursed_at ? 'Yes' : 'No'
      ]);
    } else if (activeTab === 'production' && productionData?.batches) {
      headers = ['Batch Date', 'Batch No', 'Category', 'Quantity', 'Cut Rate', 'Stitch Rate', 'Status'];
      rows = productionData.batches.map(b => [
        b.batch_date, b.batch_number, b.category, b.quantity, b.cut_rate, b.stitch_rate, b.status
      ]);
    } else if (activeTab === 'inventory' && inventoryData?.stock_by_category) {
      headers = ['Category', 'Purchased', 'Allocated', 'Finished', 'Sold', 'Stock on Hand', 'Unit Cost (₹)', 'Retail Price (₹)', 'Cost Valuation (₹)', 'Sales Valuation (₹)'];
      rows = inventoryData.stock_by_category.map(i => [
        i.category, i.fabric_purchased, i.fabric_allocated, i.finished_pieces, i.sold_pieces, i.stock_on_hand, i.unit_cost, i.unit_selling_price, i.stock_cost_valuation, i.stock_sales_valuation
      ]);
    } else {
      alert('CSV export ready for data tables in Sales, Purchases, Staff, Expenses, Production, and Inventory.');
      return;
    }

    exportToCSV(filename, headers, rows);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="reports-page">
      {/* ── Page Header ── */}
      <div className="sec-hd mb16" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="sec-title">📑 Reports &amp; Analytics</div>
          <div className="sec-sub">Comprehensive business insights across all operations</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Download CSV">
            📥 Export CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={printReport} title="Print report">
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* ── Consolidated Date Filter Bar ── */}
      <div className="card mb16" style={{ padding: '12px 18px', background: '#fff' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          {/* Quick-Select Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 4 }}>
              Period:
            </span>
            {[
              ['this_month', 'This Month'],
              ['last_month', 'Last Month'],
              ['this_quarter', 'Quarter'],
              ['this_year', 'This Year'],
              ['custom', 'Custom Range…'],
            ].map(([k, label]) => {
              const active = preset === k;
              return (
                <button
                  key={k}
                  onClick={() => applyPreset(k)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: active ? 700 : 600,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'var(--accent-l)' : '#fff',
                    color: active ? 'var(--accent)' : 'var(--muted)',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 1px 3px rgba(79, 70, 229, 0.15)' : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Active Scope Badge + Reload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text)',
                background: 'var(--light)',
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}
            >
              <span style={{ fontSize: 14 }}>📅</span>
              <span>{fmtD(fromDate)} — {fmtD(toDate)}</span>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={loadReport}
              disabled={loading}
              title="Refresh report data"
              style={{ height: 32, padding: '0 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }}>🔄</span>
              <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Inline Drawer for Custom Date Selection */}
        {isCustomOpen && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              background: 'var(--light)',
              padding: '10px 14px',
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Custom Range:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>To:</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', outline: 'none' }}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleApplyCustom}
              style={{ fontSize: 12, padding: '5px 14px', height: 30 }}
            >
              Apply Range
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setIsCustomOpen(false)}
              style={{ fontSize: 12, padding: '5px 12px', height: 30 }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Grouped Categorized Navigation ── */}
      <div className="card mb16" style={{ padding: '8px 12px', background: '#fff' }}>
        {/* Tier 1: Functional Sections */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          {REPORT_SECTIONS.map(section => {
            const isCurrentSection = section.tabs.some(t => t.id === activeTab);
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (!isCurrentSection) {
                    setActiveTab(section.tabs[0].id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: isCurrentSection ? '1.5px solid var(--accent)' : '1px solid transparent',
                  background: isCurrentSection ? 'var(--accent-l)' : 'transparent',
                  color: isCurrentSection ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: isCurrentSection ? 800 : 600,
                  fontSize: 13,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tier 2: Specific Sub-Reports for the Active Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 4 }}>
            Report:
          </span>
          {activeSection?.tabs.map(tabItem => {
            const isSelected = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                onClick={() => setActiveTab(tabItem.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--accent)' : '#fff',
                  color: isSelected ? '#fff' : 'var(--text)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 12,
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 4px rgba(79, 70, 229, 0.25)' : 'none',
                }}
              >
                <span>{tabItem.icon}</span>
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Loading Spinner ── */}
      {loading && <div className="spinner" style={{ margin: '30px 0' }}>Loading report data…</div>}

      {/* ── Error Banner ── */}
      {!loading && errorMsg && (
        <div className="alert alert-yellow mb16" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="a-icon">⚠️</div>
            <div className="a-body">{errorMsg}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadReport}>Retry</button>
        </div>
      )}

      {/* ── Tab 1: Overview ── */}
      {!loading && activeTab === 'overview' && overviewData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* TIER 1: EXECUTIVE HERO BANNER */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Card 1: Estimated Net Profit */}
            <div
              className="card"
              style={{
                padding: '20px 24px',
                background: (overviewData.profitability?.net_profit >= 0)
                  ? 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
                border: `1.5px solid ${overviewData.profitability?.net_profit >= 0 ? '#86efac' : '#fca5a5'}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🎯 Primary Bottom Line
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: overviewData.profitability?.net_profit >= 0 ? 'var(--green-l)' : 'var(--red-l)',
                    color: overviewData.profitability?.net_profit >= 0 ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {overviewData.profitability?.net_profit >= 0 ? '● Profitable Operation' : '● Operating at Loss'}
                </span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Estimated Net Profit</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: overviewData.profitability?.net_profit >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4, letterSpacing: '-0.5px' }}>
                {fmt(overviewData.profitability?.net_profit)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#fff', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  Net Margin: <strong style={{ color: overviewData.profitability?.net_profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{overviewData.profitability?.margin_pct}%</strong>
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Revenue minus Direct Costs &amp; Overheads
                </span>
              </div>
            </div>

            {/* Card 2: Total Revenue */}
            <div
              className="card"
              style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
                border: '1.5px solid #c7d2fe',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  💼 Top-Line Commercial
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'var(--accent-l)',
                    color: 'var(--accent)',
                  }}
                >
                  {overviewData.sales?.total_sales > 0
                    ? `${Math.min(100, Math.round(((overviewData.sales?.total_collected || 0) / overviewData.sales?.total_sales) * 100))}% Collected`
                    : '0% Collected'}
                </span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Total Billed Revenue</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent)', marginTop: 4, letterSpacing: '-0.5px' }}>
                {fmt(overviewData.sales?.total_sales)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#dcfce7', color: 'var(--green)', border: '1px solid #bbf7d0' }}>
                  ✓ Collected: {fmt(overviewData.sales?.total_collected)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#fef3c7', color: 'var(--yellow)', border: '1px solid #fde68a' }}>
                  ⏳ Pending: {fmt(Math.max(0, (overviewData.sales?.total_sales || 0) - (overviewData.sales?.total_collected || 0)))}
                </span>
              </div>
            </div>
          </div>

          {/* TIER 2: OPERATIONAL COST DRIVERS & WORKING CAPITAL */}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 4 }}>
            Operational Cost Drivers &amp; Working Capital
          </div>

          <div className="g4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {/* Fabric Purchases */}
            <div className="card" style={{ padding: '16px', borderTop: '3px solid #64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Fabric Purchases</div>
                <span style={{ fontSize: 16 }}>📦</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>
                {fmt(overviewData.purchases?.total_purchased)}
              </div>
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--light)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Paid:</span>
                <strong style={{ color: 'var(--text)' }}>{fmt(overviewData.purchases?.total_paid)}</strong>
              </div>
            </div>

            {/* Labor & Payroll */}
            <div className="card" style={{ padding: '16px', borderTop: '3px solid var(--cyan)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Labor &amp; Payroll</div>
                <span style={{ fontSize: 16 }}>✂️</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cyan)', marginTop: 6 }}>
                {fmt(overviewData.labor?.total_labor_cost)}
              </div>
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--cyan-l)', padding: '2px 8px', borderRadius: 4, color: 'var(--cyan)' }}>
                <strong>{fmtInt(overviewData.labor?.completed_pieces)}</strong> pcs completed
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="card" style={{ padding: '16px', borderTop: '3px solid var(--red)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Operating Overheads</div>
                <span style={{ fontSize: 16 }}>🧾</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)', marginTop: 6 }}>
                {fmt(overviewData.expenses?.total_amount)}
              </div>
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--red-l)', padding: '2px 8px', borderRadius: 4, color: 'var(--red)' }}>
                <strong>{overviewData.expenses?.total_count}</strong> expenses logged
              </div>
            </div>

            {/* Total Receivables */}
            <div className="card" style={{ padding: '16px', borderTop: '3px solid var(--yellow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Client Receivables</div>
                <span style={{ fontSize: 16 }}>⏳</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--yellow)', marginTop: 6 }}>
                {fmt(overviewData.outstanding?.receivables)}
              </div>
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--yellow-l)', padding: '2px 8px', borderRadius: 4, color: 'var(--yellow)' }}>
                <span>Uncollected client dues</span>
              </div>
            </div>
          </div>

          {/* Operational Breakdown Cards */}
          <div className="g2">
            <div className="card">
              <div className="card-hd">🚚 Sales &amp; Production Summary</div>
              <div className="info-list">
                <div className="il-row">
                  <span className="il-label">Orders Placed</span>
                  <span className="il-val">{overviewData.sales?.total_orders} orders</span>
                </div>
                <div className="il-row">
                  <span className="il-label">Units Sold</span>
                  <span className="il-val">{fmtInt(overviewData.sales?.units_sold)} pcs</span>
                </div>
                <div className="il-row">
                  <span className="il-label">Production Batches</span>
                  <span className="il-val">{overviewData.production?.total_batches} batches</span>
                </div>
                <div className="il-row">
                  <span className="il-label">Finished Garments</span>
                  <span className="il-val" style={{ color: 'var(--green)', fontWeight: 700 }}>
                    {fmtInt(overviewData.production?.finished_pieces)} pcs
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-hd">💰 Cost &amp; Liabilities Breakdown</div>
              <div className="info-list">
                <div className="il-row">
                  <span className="il-label">Fabric Purchase Cost</span>
                  <span className="il-val">{fmt(overviewData.purchases?.total_purchased)}</span>
                </div>
                <div className="il-row">
                  <span className="il-label">Tailoring &amp; Cutting Dues</span>
                  <span className="il-val">{fmt(overviewData.labor?.total_labor_cost)}</span>
                </div>
                <div className="il-row">
                  <span className="il-label">Direct Operating Overheads</span>
                  <span className="il-val">{fmt(overviewData.expenses?.total_amount)}</span>
                </div>
                <div className="il-row">
                  <span className="il-label">Outstanding Payables (Vendors)</span>
                  <span className="il-val" style={{ color: 'var(--red)', fontWeight: 700 }}>
                    {fmt(overviewData.outstanding?.payables)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Sales Reports ── */}
      {!loading && activeTab === 'sales' && salesData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Cards */}
          <div className="g4">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Billed Sales</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>{fmt(salesData.summary?.totalBilled)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{salesData.summary?.totalOrders} orders</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Collected Amount</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{fmt(salesData.summary?.totalPaid)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Pending Balance Due</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>{fmt(salesData.summary?.totalBalance)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Units Sold</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{fmtInt(salesData.summary?.totalPieces)} pcs</div>
            </div>
          </div>

          {/* Client Breakdown */}
          <div className="card">
            <div className="card-hd">👥 Client-wise Sales Summary</div>
            {salesData.client_summary?.length === 0 ? (
              <div className="empty-state">No sales in this period.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>City / Phone</th>
                    <th style={{ textAlign: 'right' }}>Orders</th>
                    <th style={{ textAlign: 'right' }}>Total Units</th>
                    <th style={{ textAlign: 'right' }}>Total Billed</th>
                    <th style={{ textAlign: 'right' }}>Collected</th>
                    <th style={{ textAlign: 'right' }}>Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.client_summary?.map(c => (
                    <tr key={c.client_id}>
                      <td style={{ fontWeight: 700 }}>{c.client_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.client_city || '—'} {c.client_phone ? `(${c.client_phone})` : ''}</td>
                      <td style={{ textAlign: 'right' }}>{c.order_count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtInt(c.total_quantity)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(c.total_billed)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(c.total_paid)}</td>
                      <td style={{ textAlign: 'right', color: c.total_balance > 0 ? 'var(--red)' : 'var(--muted)', fontWeight: 700 }}>
                        {fmt(c.total_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 800 }}>Total</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{salesData.client_summary?.reduce((s, c) => s + Number(c.order_count || 0), 0)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmtInt(salesData.client_summary?.reduce((s, c) => s + Number(c.total_quantity || 0), 0))}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--accent)' }}>{fmt(salesData.client_summary?.reduce((s, c) => s + Number(c.total_billed || 0), 0))}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--green)' }}>{fmt(salesData.client_summary?.reduce((s, c) => s + Number(c.total_paid || 0), 0))}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--red)' }}>{fmt(salesData.client_summary?.reduce((s, c) => s + Number(c.total_balance || 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Product Category Breakdown */}
          <div className="card">
            <div className="card-hd">👗 Product / Category Performance</div>
            <table>
              <thead>
                <tr>
                  <th>Product Category</th>
                  <th>Size</th>
                  <th style={{ textAlign: 'right' }}>Quantity Sold</th>
                  <th style={{ textAlign: 'right' }}>Average Rate</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {salesData.product_summary?.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{getProductLabel(p.category)}</td>
                    <td><span className="badge" style={{ fontSize: 10 }}>{p.size || 'Free Size'}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtInt(p.total_quantity)} pcs</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>₹{Number(p.avg_rate).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmt(p.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                  <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 800 }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmtInt(salesData.product_summary?.reduce((s, p) => s + Number(p.total_quantity || 0), 0))} pcs</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--accent)' }}>{fmt(salesData.product_summary?.reduce((s, p) => s + Number(p.total_amount || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Purchase Reports ── */}
      {!loading && activeTab === 'purchases' && purchaseData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Cards */}
          <div className="g4">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Purchases</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{fmt(purchaseData.summary?.totalAmount)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{purchaseData.summary?.totalBills} bills</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Advance / Paid</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{fmt(purchaseData.summary?.totalAdvance)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Transport Costs</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--cyan, #0891b2)', marginTop: 4 }}>{fmt(purchaseData.summary?.totalTransport)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Fabric Quantity</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>{fmtInt(purchaseData.summary?.totalQuantity)} pcs/mts</div>
            </div>
          </div>

          {/* Vendor Summary */}
          <div className="card">
            <div className="card-hd">🏭 Vendor-wise Purchase Summary</div>
            <table>
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>Bills</th>
                  <th style={{ textAlign: 'right' }}>Total Sourced</th>
                  <th style={{ textAlign: 'right' }}>Paid / Advance</th>
                  <th style={{ textAlign: 'right' }}>Balance Payable</th>
                </tr>
              </thead>
              <tbody>
                {purchaseData.vendor_summary?.map(v => (
                  <tr key={v.vendor_id}>
                    <td style={{ fontWeight: 700 }}>{v.vendor_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{v.vendor_phone || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{v.bills_count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(v.total_purchased)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(v.total_paid)}</td>
                    <td style={{ textAlign: 'right', color: v.balance_payable > 0 ? 'var(--red)' : 'var(--muted)', fontWeight: 700 }}>
                      {fmt(v.balance_payable)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                  <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 800 }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{purchaseData.vendor_summary?.reduce((s, v) => s + Number(v.bills_count || 0), 0)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmt(purchaseData.vendor_summary?.reduce((s, v) => s + Number(v.total_purchased || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--green)' }}>{fmt(purchaseData.vendor_summary?.reduce((s, v) => s + Number(v.total_paid || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--red)' }}>{fmt(purchaseData.vendor_summary?.reduce((s, v) => s + Number(v.balance_payable || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Purchase Category Breakdown */}
          <div className="card">
            <div className="card-hd">🧵 Fabric Sourcing Breakdown</div>
            <table>
              <thead>
                <tr>
                  <th>Fabric Category</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Avg Rate/pc</th>
                  <th style={{ textAlign: 'right' }}>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {purchaseData.item_summary?.map((it, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{getProductLabel(it.category)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtInt(it.total_quantity)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>₹{Number(it.avg_rate).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmt(it.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                  <td style={{ padding: '10px 12px', fontWeight: 800 }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmtInt(purchaseData.item_summary?.reduce((s, it) => s + Number(it.total_quantity || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--accent)' }}>{fmt(purchaseData.item_summary?.reduce((s, it) => s + Number(it.total_amount || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: Production Reports ── */}
      {!loading && activeTab === 'production' && productionData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="g4">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Batches</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{productionData.summary?.totalBatches}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Planned Volume</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>{fmtInt(productionData.summary?.totalPieces)} pcs</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Finished Goods</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{fmtInt(productionData.summary?.finishedPieces)} pcs</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>In Progress / Active</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--yellow)', marginTop: 4 }}>{fmtInt(productionData.summary?.activePieces)} pcs</div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">✂️ Production Batches Register</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Batch Number</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Batch Size</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Cut Rate</th>
                  <th style={{ textAlign: 'right' }}>Stitch Rate</th>
                </tr>
              </thead>
              <tbody>
                {productionData.batches?.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtShort(b.batch_date)}</td>
                    <td style={{ fontWeight: 700 }}>{b.batch_number}</td>
                    <td>{getProductLabel(b.category)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtInt(b.quantity)} pcs</td>
                    <td>
                      <span className={`badge ${b.status === 'finished' ? 'b-green' : b.status === 'cutting' ? 'b-accent' : 'b-cyan'}`} style={{ fontSize: 10 }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>₹{b.cut_rate}</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>₹{b.stitch_rate}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                  <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 800 }}>Total ({productionData.batches?.length || 0} batches)</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--accent)' }}>{fmtInt(productionData.batches?.reduce((s, b) => s + Number(b.quantity || 0), 0))} pcs</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 5: Staff & Payroll Reports ── */}
      {!loading && activeTab === 'staff' && staffData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="g4">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Pieces Completed</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{fmtInt(staffData.summary?.totalPieces)} pcs</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Earned Wages</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--cyan, #0891b2)', marginTop: 4 }}>{fmt(staffData.summary?.totalEarned)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Settled Wages</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{fmt(staffData.summary?.totalSettled)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Pending Labor Liability</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>{fmt(staffData.summary?.totalPending)}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">👷 Staff Output &amp; Wage Performance</div>
            <table>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right' }}>Total Output</th>
                  <th style={{ textAlign: 'right' }}>Cutting Pcs</th>
                  <th style={{ textAlign: 'right' }}>Stitching Pcs</th>
                  <th style={{ textAlign: 'right' }}>Earned Wages</th>
                  <th style={{ textAlign: 'right' }}>Settled</th>
                  <th style={{ textAlign: 'right' }}>Pending Dues</th>
                </tr>
              </thead>
              <tbody>
                {staffData.staff_summary?.map(s => (
                  <tr key={s.staff_id}>
                    <td style={{ fontWeight: 700 }}>{s.staff_name}</td>
                    <td>
                      <span className={`badge ${s.staff_role === 'cutting_master' ? 'b-accent' : 'b-cyan'}`} style={{ fontSize: 10 }}>
                        {s.staff_role === 'cutting_master' ? '✂️ Cutter' : '🧵 Tailor'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtInt(s.total_completed)} pcs</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{s.cut_pieces || 0}</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{s.stitch_pieces || 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--cyan, #0891b2)' }}>{fmt(s.total_earned)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(s.settled_amount)}</td>
                    <td style={{ textAlign: 'right', color: s.pending_amount > 0 ? 'var(--red)' : 'var(--muted)', fontWeight: 700 }}>
                      {fmt(s.pending_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                  <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 800 }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmtInt(staffData.staff_summary?.reduce((s, st) => s + Number(st.total_completed || 0), 0))} pcs</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{staffData.staff_summary?.reduce((s, st) => s + Number(st.cut_pieces || 0), 0)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{staffData.staff_summary?.reduce((s, st) => s + Number(st.stitch_pieces || 0), 0)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--cyan, #0891b2)' }}>{fmt(staffData.staff_summary?.reduce((s, st) => s + Number(st.total_earned || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--green)' }}>{fmt(staffData.staff_summary?.reduce((s, st) => s + Number(st.settled_amount || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--red)' }}>{fmt(staffData.staff_summary?.reduce((s, st) => s + Number(st.pending_amount || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 6: Expense Reports ── */}
      {!loading && activeTab === 'expenses' && expenseData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="g4">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Expenses</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>{fmt(expenseData.summary?.totalAmount)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{expenseData.summary?.totalCount} transactions</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Company Paid</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{fmt(expenseData.summary?.companyAmount)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Partner Paid</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--yellow)', marginTop: 4 }}>{fmt(expenseData.summary?.partnerAmount)}</div>
            </div>
          </div>

          <div className="g2">
            <div className="card">
              <div className="card-hd">📊 Category Breakdown</div>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Count</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseData.category_summary?.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, textTransform: 'capitalize' }}>{c.category}</td>
                      <td style={{ textAlign: 'right' }}>{c.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>{fmt(c.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800 }}>Total</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{expenseData.category_summary?.reduce((s, c) => s + Number(c.count || 0), 0)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--red)' }}>{fmt(expenseData.category_summary?.reduce((s, c) => s + Number(c.total_amount || 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="card">
              <div className="card-hd">🤝 Partner Expense &amp; Reimbursement Summary</div>
              <table>
                <thead>
                  <tr>
                    <th>Payer</th>
                    <th style={{ textAlign: 'right' }}>Total Paid</th>
                    <th style={{ textAlign: 'right' }}>Reimbursed</th>
                    <th style={{ textAlign: 'right' }}>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseData.partner_summary?.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{p.paid_by}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(p.total_amount)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(p.reimbursed_amount)}</td>
                      <td style={{ textAlign: 'right', color: p.pending_reimbursement > 0 ? 'var(--yellow)' : 'var(--muted)', fontWeight: 700 }}>
                        {fmt(p.pending_reimbursement)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800 }}>Total</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmt(expenseData.partner_summary?.reduce((s, p) => s + Number(p.total_amount || 0), 0))}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--green)' }}>{fmt(expenseData.partner_summary?.reduce((s, p) => s + Number(p.reimbursed_amount || 0), 0))}</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--yellow)' }}>{fmt(expenseData.partner_summary?.reduce((s, p) => s + Number(p.pending_reimbursement || 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 7: P&L Statement ── */}
      {!loading && activeTab === 'pnl' && pnlData && (
        <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Profit &amp; Loss Statement</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtShort(fromDate)} — {fmtShort(toDate)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {/* Revenue */}
            <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontWeight: 700 }}>1. Gross Revenue</div>
            <div style={{ paddingLeft: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>Total Billed Sales</span>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmt(pnlData.revenue?.total_sales)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: 'var(--muted)' }}>
                <span>Collected In Cash/Bank</span>
                <span>{fmt(pnlData.revenue?.sales_collected)}</span>
              </div>
            </div>

            {/* COGS */}
            <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontWeight: 700 }}>2. Cost of Goods Sold (COGS)</div>
            <div style={{ paddingLeft: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>Fabric Purchases</span>
                <span>{fmt(pnlData.cogs?.fabric)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>Tailoring &amp; Cutting Labor</span>
                <span>{fmt(pnlData.cogs?.labor?.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>Accessories &amp; Materials</span>
                <span>{fmt(pnlData.cogs?.materials_accessories)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)', fontWeight: 700 }}>
                <span>Total COGS</span>
                <span style={{ color: 'var(--red)' }}>{fmt(pnlData.cogs?.total_cogs)}</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: pnlData.gross_profit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, fontWeight: 800 }}>
              <span>Gross Profit</span>
              <span style={{ color: pnlData.gross_profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(pnlData.gross_profit)} ({pnlData.gross_margin_pct}%)
              </span>
            </div>

            {/* Operating Overheads */}
            <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontWeight: 700 }}>3. Operating Overheads</div>
            <div style={{ paddingLeft: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>Shop Rent</span>
                <span>{fmt(pnlData.operating_expenses?.rent)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>Electricity</span>
                <span>{fmt(pnlData.operating_expenses?.electricity)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>Transport &amp; Logistics</span>
                <span>{fmt(pnlData.operating_expenses?.transport)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>Setup &amp; Other General Expenses</span>
                <span>{fmt((pnlData.operating_expenses?.setup || 0) + (pnlData.operating_expenses?.other || 0))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)', fontWeight: 700 }}>
                <span>Total Operating Expenses</span>
                <span style={{ color: 'var(--red)' }}>{fmt(pnlData.operating_expenses?.total)}</span>
              </div>
            </div>

            {/* Net Profit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: pnlData.net_profit >= 0 ? '#ecfdf5' : '#fef2f2', border: `1.5px solid ${pnlData.net_profit >= 0 ? '#10b981' : '#ef4444'}`, borderRadius: 8, fontWeight: 800, fontSize: 16 }}>
              <span>Net Profit</span>
              <span style={{ color: pnlData.net_profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {fmt(pnlData.net_profit)} ({pnlData.net_margin_pct}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 8: Inventory & Stock ── */}
      {!loading && activeTab === 'inventory' && inventoryData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="g3">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Finished Stock on Hand</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
                {fmtInt(inventoryData.summary?.total_stock_on_hand)} pcs
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Stock Valuation (Cost)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--cyan, #0891b2)', marginTop: 4 }}>
                {fmt(inventoryData.summary?.total_cost_valuation)}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Stock Valuation (Retail / Sales)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
                {fmt(inventoryData.summary?.total_sales_valuation)}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">🏭 Inventory Position by Product Category</div>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Fabric In</th>
                  <th style={{ textAlign: 'right' }}>Fabric Allocated</th>
                  <th style={{ textAlign: 'right' }}>Finished Pcs</th>
                  <th style={{ textAlign: 'right' }}>Sold Pcs</th>
                  <th style={{ textAlign: 'right' }}>Stock on Hand</th>
                  <th style={{ textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ textAlign: 'right' }}>Cost Valuation</th>
                  <th style={{ textAlign: 'right' }}>Retail Valuation</th>
                </tr>
              </thead>
              <tbody>
                {inventoryData.stock_by_category?.map(s => (
                  <tr key={s.category}>
                    <td style={{ fontWeight: 700 }}>{getProductLabel(s.category)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmtInt(s.fabric_purchased)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmtInt(s.fabric_allocated)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--cyan, #0891b2)', fontWeight: 600 }}>{fmtInt(s.finished_pieces)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text)' }}>{fmtInt(s.sold_pieces)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>{fmtInt(s.stock_on_hand)} pcs</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>₹{s.unit_cost?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--cyan, #0891b2)' }}>{fmt(s.stock_cost_valuation)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmt(s.stock_sales_valuation)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                  <td style={{ padding: '10px 12px', fontWeight: 800 }}>Total</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmtInt(inventoryData.stock_by_category?.reduce((s, st) => s + Number(st.fabric_purchased || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmtInt(inventoryData.stock_by_category?.reduce((s, st) => s + Number(st.fabric_allocated || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--cyan, #0891b2)' }}>{fmtInt(inventoryData.stock_by_category?.reduce((s, st) => s + Number(st.finished_pieces || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>{fmtInt(inventoryData.stock_by_category?.reduce((s, st) => s + Number(st.sold_pieces || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--green)' }}>{fmtInt(inventoryData.stock_by_category?.reduce((s, st) => s + Number(st.stock_on_hand || 0), 0))} pcs</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--cyan, #0891b2)' }}>{fmt(inventoryData.stock_by_category?.reduce((s, st) => s + Number(st.stock_cost_valuation || 0), 0))}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--accent)' }}>{fmt(inventoryData.stock_by_category?.reduce((s, st) => s + Number(st.stock_sales_valuation || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
