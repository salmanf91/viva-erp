import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = n => Number(n || 0).toLocaleString('en-IN');
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const CAT_LABEL = { shawl_nighty: 'Shawl Nighty', ordinary_nighty: 'Ordinary Nighty', shawl_nighty_lace: 'Shawl + Lace' };
const getProductLabel = cat => CAT_LABEL[cat] || (cat ? cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—');

const toDateStr = d => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function ReportsPage() {
  const now = new Date();
  const [preset, setPreset] = useState('this_month');
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [toDate, setToDate] = useState(toDateStr(now));
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

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

    if (p === 'today') {
      const dStr = toDateStr(today);
      setFromDate(dStr);
      setToDate(dStr);
    } else if (p === 'this_week') {
      const first = new Date(today);
      first.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday
      setFromDate(toDateStr(first));
      setToDate(toDateStr(today));
    } else if (p === 'this_month') {
      setFromDate(`${y}-${String(m + 1).padStart(2, '0')}-01`);
      setToDate(toDateStr(today));
    } else if (p === 'last_month') {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(ly, lm + 1, 0).getDate();
      setFromDate(`${ly}-${String(lm + 1).padStart(2, '0')}-01`);
      setToDate(`${ly}-${String(lm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (p === 'this_quarter') {
      const qMonth = Math.floor(m / 3) * 3;
      setFromDate(`${y}-${String(qMonth + 1).padStart(2, '0')}-01`);
      setToDate(toDateStr(today));
    } else if (p === 'this_year') {
      // April to March FY or Jan to Dec
      setFromDate(`${y}-01-01`);
      setToDate(toDateStr(today));
    }
  };

  const loadReport = useCallback(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    const params = { from: fromDate, to: toDate };

    if (activeTab === 'overview') {
      api.get('/reports/overview', { params })
        .then(r => setOverviewData(r.data))
        .finally(() => setLoading(false));
    } else if (activeTab === 'sales') {
      api.get('/reports/sales', { params })
        .then(r => setSalesData(r.data))
        .finally(() => setLoading(false));
    } else if (activeTab === 'purchases') {
      api.get('/reports/purchases', { params })
        .then(r => setPurchaseData(r.data))
        .finally(() => setLoading(false));
    } else if (activeTab === 'production') {
      api.get('/reports/production', { params })
        .then(r => setProductionData(r.data))
        .finally(() => setLoading(false));
    } else if (activeTab === 'staff') {
      api.get('/reports/staff', { params })
        .then(r => setStaffData(r.data))
        .finally(() => setLoading(false));
    } else if (activeTab === 'expenses') {
      api.get('/reports/expenses', { params })
        .then(r => setExpenseData(r.data))
        .finally(() => setLoading(false));
    } else if (activeTab === 'pnl') {
      api.get('/reports/pnl', { params })
        .then(r => setPnlData(r.data))
        .finally(() => setLoading(false));
    } else if (activeTab === 'inventory') {
      api.get('/reports/inventory', { params })
        .then(r => setInventoryData(r.data))
        .finally(() => setLoading(false));
    }
  }, [activeTab, fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // CSV Export utility
  const exportCSV = () => {
    let filename = `viva_report_${activeTab}_${fromDate}_to_${toDate}.csv`;
    let headers = [];
    let rows = [];

    if (activeTab === 'sales' && salesData?.orders) {
      headers = ['Order Date', 'Order No', 'Client Name', 'City', 'Pieces', 'Total (₹)', 'Paid (₹)', 'Balance (₹)', 'Status'];
      rows = salesData.orders.map(o => [
        o.order_date, o.order_number, `"${o.client_name}"`, `"${o.client_city || ''}"`,
        o.total_pieces, o.total, o.amount_paid, o.balance_due, o.payment_status
      ]);
    } else if (activeTab === 'purchases' && purchaseData?.purchases) {
      headers = ['Invoice Date', 'Vendor Name', 'Quantity', 'Freight', 'Coolie', 'Tax', 'Advance Paid', 'Total (₹)', 'Status'];
      rows = purchaseData.purchases.map(p => [
        p.invoice_date, `"${p.vendor_name}"`, p.total_quantity, p.freight, p.coolie, p.tax_amount, p.advance_paid, p.total, p.status
      ]);
    } else if (activeTab === 'staff' && staffData?.staff_summary) {
      headers = ['Staff Name', 'Role', 'Total Allocated', 'Total Completed', 'Cut Pcs', 'Stitch Pcs', 'Total Earned (₹)', 'Settled (₹)', 'Pending (₹)'];
      rows = staffData.staff_summary.map(s => [
        `"${s.staff_name}"`, s.staff_role, s.total_allocated, s.total_completed, s.cut_pieces, s.stitch_pieces, s.total_earned, s.settled_amount, s.pending_amount
      ]);
    } else if (activeTab === 'expenses' && expenseData?.expenses) {
      headers = ['Expense Date', 'Reason', 'Category', 'Paid By', 'Amount (₹)', 'Reimbursed'];
      rows = expenseData.expenses.map(e => [
        e.expense_date, `"${e.reason_name}"`, e.reason_category, e.paid_by || 'Company', e.amount, e.reimbursed_at ? 'Yes' : 'No'
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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {/* ── Filter Bar ── */}
      <div className="card mb16" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              ['today', 'Today'],
              ['this_week', 'This Week'],
              ['this_month', 'This Month'],
              ['last_month', 'Last Month'],
              ['this_quarter', 'Quarter'],
              ['this_year', 'This Year'],
              ['custom', 'Custom'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => applyPreset(k)}
                style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                  border: preset === k ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: preset === k ? 'var(--accent-light, #fef3c7)' : 'var(--white)',
                  color: preset === k ? 'var(--accent)' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPreset('custom'); }}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>To:</span>
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setPreset('custom'); }}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }}
            />
            <button className="btn btn-ghost btn-sm" onClick={loadReport} style={{ height: 28, padding: '0 10px', fontSize: 11 }}>
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-Report Navigation Tabs ── */}
      <div className="tabs mb16" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {[
          ['overview', '📊 Overview'],
          ['sales', '🚚 Sales'],
          ['purchases', '📦 Purchases'],
          ['production', '✂️ Production'],
          ['staff', '👷 Staff & Payroll'],
          ['expenses', '🧾 Expenses'],
          ['pnl', '📈 P&L Statement'],
          ['inventory', '🏭 Inventory & Stock'],
        ].map(([t, label]) => (
          <div
            key={t}
            className={`tab${activeTab === t ? ' active' : ''}`}
            onClick={() => setActiveTab(t)}
            style={{ cursor: 'pointer' }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* ── Loading Spinner ── */}
      {loading && <div className="spinner" style={{ margin: '30px 0' }}>Loading report data…</div>}

      {/* ── Tab 1: Overview ── */}
      {!loading && activeTab === 'overview' && overviewData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top KPI Cards */}
          <div className="g4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Revenue</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
                {fmt(overviewData.sales?.total_sales)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Collected: <b>{fmt(overviewData.sales?.total_collected)}</b>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Fabric Purchases</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                {fmt(overviewData.purchases?.total_purchased)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Paid: <b>{fmt(overviewData.purchases?.total_paid)}</b>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Labor &amp; Payroll</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--cyan, #0891b2)', marginTop: 4 }}>
                {fmt(overviewData.labor?.total_labor_cost)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                {fmtInt(overviewData.labor?.completed_pieces)} pcs completed
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Operating Expenses</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>
                {fmt(overviewData.expenses?.total_amount)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                {overviewData.expenses?.total_count} transactions
              </div>
            </div>

            <div className="card" style={{ background: overviewData.profitability?.net_profit >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${overviewData.profitability?.net_profit >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Estimated Net Profit</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: overviewData.profitability?.net_profit >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
                {fmt(overviewData.profitability?.net_profit)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Net Margin: <b>{overviewData.profitability?.margin_pct}%</b>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Receivables</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--yellow)', marginTop: 4 }}>
                {fmt(overviewData.outstanding?.receivables)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Uncollected client balances
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
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
