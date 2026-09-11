import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api/client';

const DEFAULT_CAT_LABEL = {
  shawl_nighty: 'Shawl Nighty',
  ordinary_nighty: 'Ordinary Nighty',
  shawl_nighty_lace: 'Shawl Nighty + Lace'
};
const getProductLabel = cat => DEFAULT_CAT_LABEL[cat] || cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const formatSize = s => !s ? '' : s === 'xxl' ? '2XL' : s === 'xxxl' ? '3XL' : s === 'xxxxl' ? '4XL' : s.toUpperCase();

const fmt   = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtD  = s => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);

export default function SalesPage() {
  const [tab, setTab] = useState('orders');
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh(r => r + 1);

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1.5px solid var(--border)' }}>
        {[
          ['orders',   '🚚 Deliveries & Invoices'],
          ['receipts', '🧾 Payment Receipts'],
          ['clients',  '👥 Clients']
        ].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
              background: 'transparent', borderBottom: tab === t ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--muted)', borderRadius: 0,
            }}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'orders'   && <OrdersTab key={refresh} onReload={reload} />}
      {tab === 'receipts' && <ReceiptsTab key={refresh} onReload={reload} />}
      {tab === 'clients'  && <ClientsTab key={refresh} />}
    </>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab({ onReload }) {
  const [orders, setOrders]   = useState([]);
  const [clients, setClients] = useState([]);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [total, setTotal]     = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filter, setFilter]             = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [datePreset, setDatePreset]     = useState('all'); // 'all', 'today', 'this_week', 'this_month', 'custom'
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [search, setSearch]             = useState('');

  const [showNew, setShowNew]     = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [invoice, setInvoice]     = useState(null);

  // Load clients dropdown
  useEffect(() => {
    api.get('/sales/clients').then(r => setClients(r.data || [])).catch(() => {});
  }, []);

  // Compute effective start and end dates from datePreset
  const { effStart, effEnd } = useMemo(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const d = now.toISOString().slice(0, 10);
      return { effStart: d, effEnd: d };
    }
    if (datePreset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(new Date().setDate(diff)).toISOString().slice(0, 10);
      const end = new Date().toISOString().slice(0, 10);
      return { effStart: start, effEnd: end };
    }
    if (datePreset === 'this_month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const start = `${y}-${m}-01`;
      const end = new Date().toISOString().slice(0, 10);
      return { effStart: start, effEnd: end };
    }
    if (datePreset === 'custom') {
      return { effStart: startDate, effEnd: endDate };
    }
    return { effStart: '', effEnd: '' };
  }, [datePreset, startDate, endDate]);

  const load = () => {
    setLoading(true);
    const params = {
      page,
      limit: 20,
      ...(filter !== 'all' ? { status: filter } : {}),
      ...(clientFilter !== 'all' ? { client_id: clientFilter } : {}),
      ...(effStart ? { from: effStart } : {}),
      ...(effEnd ? { to: effEnd } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    };
    const summaryParams = {
      ...(clientFilter !== 'all' ? { client_id: clientFilter } : {}),
      ...(effStart ? { from: effStart } : {}),
      ...(effEnd ? { to: effEnd } : {}),
    };
    Promise.all([
      api.get('/sales', { params }),
      api.get('/sales/summary', { params: summaryParams }),
    ]).then(([o, s]) => {
      setOrders(o.data.data || []);
      setPages(o.data.pages || 1);
      setTotal(o.data.total || 0);
      setSummary(s.data);
    })
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); }, [filter, clientFilter, datePreset, effStart, effEnd, search]);
  useEffect(() => { load(); }, [filter, clientFilter, datePreset, effStart, effEnd, search, page]);

  const openInvoice = async order => {
    const r = await api.get(`/sales/${order.id}`);
    setInvoice(r.data);
  };

  const openEdit = async order => {
    const r = await api.get(`/sales/${order.id}`);
    setEditOrder(r.data);
  };

  const [payModal,     setPayModal]     = useState(null);
  const [receiptModal, setReceiptModal] = useState(null); // orderId

  const recordPayment = async (id, amount, date, payment_mode) => {
    const res = await api.post(`/sales/${id}/payment`, { amount, payment_date: date, payment_mode });
    setPayModal(null);
    setReceiptModal(res.data?.receipt_no || id);
    load(); onReload();
  };

  const del = async id => {
    if (!confirm('Delete this delivery record?')) return;
    await api.delete(`/sales/${id}`);
    load(); onReload();
  };

  return (
    <>
      {/* Summary */}
      {summary && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <SummaryChip label="Total Billed"    value={fmt(summary.total_billed)}    color="var(--text)" />
          <SummaryChip label="Received"        value={fmt(summary.total_received)}   color="var(--green)" />
          <SummaryChip label="Outstanding"     value={fmt(summary.total_pending)}    color="var(--orange)" />
          <SummaryChip label="Pending Orders"  value={summary.pending_count}         color="var(--yellow)" small />
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Status Filter */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3 }}>
          {[['all','All'],['pending','Outstanding'],['paid','Paid']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                borderRadius: 6, background: filter === v ? 'var(--white)' : 'transparent',
                color: filter === v ? 'var(--text)' : 'var(--muted)',
                boxShadow: filter === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}>{l}</button>
          ))}
        </div>

        {/* Client Filter */}
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }}
        >
          <option value="all">👥 All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.city ? `(${c.city})` : ''}</option>
          ))}
        </select>

        {/* Date Preset Selector */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3 }}>
          {[
            ['all', 'All Time'],
            ['today', 'Today'],
            ['this_week', 'This Week'],
            ['this_month', 'This Month'],
            ['custom', 'Custom'],
          ].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDatePreset(k)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                borderRadius: 6,
                background: datePreset === k ? 'var(--white)' : 'transparent',
                color: datePreset === k ? 'var(--text)' : 'var(--muted)',
                boxShadow: datePreset === k ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
            />
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search invoice, client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, width: 200 }}
        />

        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowNew(true)}>
          + New Delivery
        </button>
      </div>

      {/* Table */}
      {loading ? <div className="spinner">Loading…</div> : orders.length === 0 ? (
        <div className="card"><div className="empty-state">No deliveries found.</div></div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ minWidth: 640, margin: 0 }}>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Items</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const subtotal   = +o.subtotal || 0;
                    const discountAmt = +o.discount || 0;
                    const taxable    = Math.max(0, subtotal - discountAmt);
                    const gst        = o.include_gst ? taxable * (+o.gst_percent / 100) : 0;
                    const total      = o.total !== undefined ? +o.total : (taxable + gst);
                    const amtPaid    = +o.amount_paid || 0;
                    const balance    = total - amtPaid;
                    const isPartial  = o.status === 'partial';
                    const isPending  = o.status === 'pending';
                    return (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>{o.invoice_number}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtD(o.order_date?.slice(0, 10))}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{o.client_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.client_city}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{o.item_count}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                          {fmt(total)}
                          {discountAmt > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>
                              Disc: −{fmt(discountAmt)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${o.status === 'paid' ? 'b-green' : isPartial ? 'b-yellow' : 'b-accent'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--accent)' }} onClick={() => openInvoice(o)}>
                              Invoice
                            </button>
                            {amtPaid > 0 && (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--green)' }}
                                onClick={() => setReceiptModal(o.id)}>
                                Receipt
                              </button>
                            )}
                            {(isPending || isPartial) && (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--accent)' }}
                                onClick={() => setPayModal({ id: o.id, invoiceNo: o.invoice_number, clientName: o.client_name, total, amtPaid, balance })}>
                                + Payment
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--accent)' }} onClick={() => openEdit(o)}>
                              ✏️ Edit
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => del(o.id)}>
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 }}>
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

      {showNew      && <NewOrderModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); onReload(); }} />}
      {editOrder    && <NewOrderModal order={editOrder} onClose={() => setEditOrder(null)} onSaved={() => { setEditOrder(null); load(); onReload(); }} />}
      {invoice      && <InvoiceModal order={invoice} onClose={() => setInvoice(null)} />}
      {payModal     && <RecordPaymentModal info={payModal} onClose={() => setPayModal(null)} onSave={recordPayment} />}
      {receiptModal && <PaymentReceiptModal orderId={receiptModal} onClose={() => setReceiptModal(null)} />}
    </>
  );
}

function SummaryChip({ label, value, color, small }) {
  return (
    <div className="card" style={{ padding: '10px 16px', minWidth: 120, flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 20 : 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ── New Order Modal ───────────────────────────────────────────────────────────

function NewOrderModal({ order, onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [clients, setClients]   = useState([]);
  const [clientId, setClientId] = useState(order ? String(order.client_id) : '');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCity, setNewClientCity] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const [date, setDate]         = useState(order ? order.order_date : today());
  const [notes, setNotes]       = useState(order ? (order.notes || '') : '');
  const [discountAmount, setDiscountAmount] = useState(order ? String(Number(order.discount || 0) || '') : '');
  const [includeGst, setIncludeGst] = useState(order ? !!order.include_gst : false);
  const [gstPct, setGstPct]     = useState(order ? String(Number(order.gst_percent)) : '5');
  const [amountReceived, setAmountReceived] = useState(order ? String(order.amount_paid || '') : '');
  const [paymentMode, setPaymentMode] = useState('upi');
  const [items, setItems]       = useState(order && order.items ? order.items.map(it => ({ ...it, size: it.size || '' })) : [{ category: 'shawl_nighty', size: '', quantity: '', rate_per_pc: '' }]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/sales/clients').then(r => setClients(r.data)),
      api.get('/production/configs').then(r => setProducts(r.data))
    ]).catch(() => {});
  }, []);

  const addItem  = () => {
    const firstProduct = products[0]?.category || 'shawl_nighty';
    setItems(prev => [...prev, { category: firstProduct, size: '', quantity: '', rate_per_pc: '' }]);
  };
  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i));
  const setItem  = (i, field, val) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const handleCategoryChange = (i, category) => {
    const prod = products.find(p => p.category === category);
    const size = items[i].size || '';
    let rate = '';
    if (prod) {
      const sizeRateObj = size ? (prod.size_rates || []).find(r => r.size_label.toLowerCase() === size.toLowerCase()) : null;
      rate = sizeRateObj ? sizeRateObj.selling_rate : (prod.selling_rate || '');
    }
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, category, rate_per_pc: rate } : it));
  };

  const handleSizeChange = (i, size) => {
    const prod = products.find(p => p.category === items[i].category);
    let rate = '';
    if (prod) {
      const sizeRateObj = size ? (prod.size_rates || []).find(r => r.size_label.toLowerCase() === size.toLowerCase()) : null;
      rate = sizeRateObj ? sizeRateObj.selling_rate : (prod.selling_rate || '');
    }
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, size, rate_per_pc: rate } : it));
  };

  const createClientInline = async () => {
    if (!newClientName.trim()) return;
    const r = await api.post('/sales/clients', { name: newClientName.trim(), city: newClientCity.trim(), phone: newClientPhone.trim() });
    setClients(prev => [...prev, r.data].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(String(r.data.id));
    setShowNewClient(false);
    setNewClientName(''); setNewClientCity(''); setNewClientPhone('');
  };

  const subtotal    = items.reduce((s, it) => s + (+it.quantity || 0) * (+it.rate_per_pc || 0), 0);
  const discountAmt = parseFloat(discountAmount) || 0;
  const taxable     = Math.max(0, subtotal - discountAmt);
  const gstAmt      = includeGst ? taxable * (+gstPct / 100) : 0;
  const total       = taxable + gstAmt;

  const save = async () => {
    if (!clientId || !date) return;
    const validItems = items.filter(it => it.quantity && it.rate_per_pc);
    if (!validItems.length) return;
    setSaving(true);
    try {
      const payload = {
        client_id: +clientId, order_date: date, notes,
        include_gst: includeGst, gst_percent: includeGst ? +gstPct : 0,
        discount: discountAmt,
        amount_paid: parseFloat(amountReceived) || 0,
        payment_mode: paymentMode,
        items: validItems.map(it => ({ category: it.category, size: it.size || null, quantity: +it.quantity, rate_per_pc: +it.rate_per_pc })),
      };
      if (order) {
        await api.put(`/sales/${order.id}`, payload);
      } else {
        await api.post('/sales', payload);
      }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 620, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2>{order ? 'Edit Delivery' : 'New Delivery'}</h2>

        <div className="form-grid">
          {/* Client */}
          <div className="field form-full">
            <label>Client</label>
            {showNewClient ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)', padding: 12, borderRadius: 8, border: '1.5px solid var(--accent)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Add New Client</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                  <input placeholder="Client / Company Name *" autoFocus value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createClientInline()} />
                  <input placeholder="City" value={newClientCity}
                    onChange={e => setNewClientCity(e.target.value)} />
                </div>
                <input placeholder="Phone (optional)" value={newClientPhone}
                  onChange={e => setNewClientPhone(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={createClientInline} disabled={!newClientName.trim()}>Add &amp; Select</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowNewClient(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">— Select client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.city ? `, ${c.city}` : ''}</option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewClient(true)} style={{ whiteSpace: 'nowrap' }}>
                  + New Client
                </button>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="field">
            <label>Delivery Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {/* Notes */}
          <div className="field">
            <label>Notes (optional)</label>
            <input placeholder="e.g. via courier, partial delivery…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Items */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Items</div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={addItem}>+ Add Item</button>
          </div>

          {/* Line Items Container */}
          <div>
            {/* Desktop Table View */}
            <div className="desktop-only" style={{ border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1.5fr 1fr 100px 120px 110px 32px',
                background: 'var(--surface)', padding: '8px 12px', gap: 8,
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted)',
              }}>
                <div>Category</div>
                <div>Size</div>
                <div style={{ textAlign: 'right' }}>Qty (pcs)</div>
                <div style={{ textAlign: 'right' }}>Rate / pc (₹)</div>
                <div style={{ textAlign: 'right' }}>Amount</div>
                <div></div>
              </div>

              {items.map((it, i) => {
                const amt = (+it.quantity || 0) * (+it.rate_per_pc || 0);
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1.5fr 1fr 100px 120px 110px 32px',
                    padding: '10px 12px', gap: 8, alignItems: 'center',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    background: '#fff',
                  }}>
                    <select value={it.category} onChange={e => handleCategoryChange(i, e.target.value)}
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13, width: '100%' }}>
                      {products.map(p => <option key={p.category} value={p.category}>{getProductLabel(p.category)}</option>)}
                    </select>

                    <select value={it.size} onChange={e => handleSizeChange(i, e.target.value)}
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13, width: '100%' }}>
                      <option value="">—</option>
                      {(products.find(p => p.category === it.category)?.size_rates || []).map(sr => (
                        <option key={sr.size_label} value={sr.size_label}>{sr.size_label.toUpperCase()}</option>
                      ))}
                    </select>

                    <input type="number" min="0" placeholder="0" value={it.quantity}
                      onChange={e => setItem(i, 'quantity', e.target.value)}
                      style={{ textAlign: 'right', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13, width: '100%' }} />

                    <input type="number" min="0" step="0.01" placeholder="0.00" value={it.rate_per_pc}
                      onChange={e => setItem(i, 'rate_per_pc', e.target.value)}
                      style={{ textAlign: 'right', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13, width: '100%' }} />

                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: amt ? 'var(--text)' : 'var(--muted)' }}>
                      {amt ? fmt(amt) : '—'}
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, lineHeight: 1, padding: 0 }}>
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Card-Based Items Editor */}
            <div className="mobile-only">
              {items.map((it, i) => {
                const amt = (+it.quantity || 0) * (+it.rate_per_pc || 0);
                return (
                  <div key={i} className="line-item-card">
                    <div className="line-item-card-header">
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Item #{i + 1}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: amt ? 'var(--accent)' : 'var(--muted)' }}>
                          {amt ? fmt(amt) : '₹0.00'}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(i)}
                            style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Product Category</label>
                        <select
                          value={it.category}
                          onChange={e => handleCategoryChange(i, e.target.value)}
                          style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                        >
                          {products.map(p => <option key={p.category} value={p.category}>{getProductLabel(p.category)}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Size</label>
                          <select
                            value={it.size}
                            onChange={e => handleSizeChange(i, e.target.value)}
                            style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                          >
                            <option value="">— Default</option>
                            {(products.find(p => p.category === it.category)?.size_rates || []).map(sr => (
                              <option key={sr.size_label} value={sr.size_label}>{sr.size_label.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Qty (pcs) *</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={it.quantity}
                            onChange={e => setItem(i, 'quantity', e.target.value)}
                            style={{ width: '100%', textAlign: 'right', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Rate / pc (₹) *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={it.rate_per_pc}
                          onChange={e => setItem(i, 'rate_per_pc', e.target.value)}
                          style={{ width: '100%', textAlign: 'right', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Discount & GST Controls */}
        <div className="g2" style={{ marginTop: 14 }}>
          <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              Discount (₹)
            </label>
            <input type="number" min="0" step="0.01" placeholder="0" value={discountAmount}
              onChange={e => setDiscountAmount(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13 }} />
          </div>

          <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: includeGst ? 8 : 0 }}>
              <input type="checkbox" id="gst-toggle" checked={includeGst}
                onChange={e => setIncludeGst(e.target.checked)}
                style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              <label htmlFor="gst-toggle" style={{ margin: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                Include GST
              </label>
            </div>
            {includeGst && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>GST %</label>
                <select value={gstPct} onChange={e => setGstPct(e.target.value)} style={{ width: 80 }}>
                  {['5','12','18','28'].map(p => <option key={p} value={p}>{p}%</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Initial Payment / Advance Received */}
        <div style={{ marginTop: 14, padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              💵 Payment Received Now (Optional)
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Leave blank if unpaid</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Amount Received (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amountReceived}
                onChange={e => setAmountReceived(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 700 }}
              />
            </div>

            {parseFloat(amountReceived) > 0 && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Payment Method</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'upi',           label: '📱 UPI / GPay' },
                    { id: 'cash',          label: '💵 Cash' },
                    { id: 'phonepe',       label: '🟣 PhonePe' },
                    { id: 'bank_transfer', label: '🏦 Bank' },
                    { id: 'cheque',        label: '📝 Cheque' },
                  ].map(pm => {
                    const active = paymentMode === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMode(pm.id)}
                        style={{
                          padding: '5px 9px',
                          borderRadius: 6,
                          border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: active ? 'var(--accent-l)' : '#fff',
                          color: active ? 'var(--accent)' : 'var(--text)',
                          fontWeight: active ? 700 : 500,
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        {pm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Subtotal: <b style={{ color: 'var(--text)' }}>{fmt(subtotal)}</b></div>
          {discountAmt > 0 && (
            <div style={{ fontSize: 13, color: 'var(--green)' }}>
              Discount: <b>−{fmt(discountAmt)}</b>
            </div>
          )}
          {includeGst && <div style={{ fontSize: 13, color: 'var(--muted)' }}>GST ({gstPct}%): <b style={{ color: 'var(--text)' }}>{fmt(gstAmt)}</b></div>}
          <div style={{ fontSize: 16, fontWeight: 800 }}>Total: {fmt(total)}</div>
          {parseFloat(amountReceived) > 0 && (
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
              Paid Now: {fmt(amountReceived)} ({paymentMode.toUpperCase()})
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}
            disabled={saving || !clientId || !items.some(it => it.quantity && it.rate_per_pc)}>
            {saving ? 'Saving…' : 'Save & Generate Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Record Payment Modal ──────────────────────────────────────────────────────

function RecordPaymentModal({ info, onClose, onSave }) {
  const { id, invoiceNo, clientName, total, amtPaid, balance } = info;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState('upi');
  const [saving, setSaving] = useState(false);
  const amt     = Number(amount);
  const isOver  = amt > balance;
  const isFull  = amt > 0 && Math.abs(amt - balance) < 0.01;

  const PAYMENT_MODES = [
    { id: 'upi',           label: '📱 UPI / GPay' },
    { id: 'cash',          label: '💵 Cash' },
    { id: 'phonepe',       label: '🟣 PhonePe' },
    { id: 'bank_transfer', label: '🏦 Bank Transfer' },
    { id: 'cheque',        label: '📝 Cheque' },
    { id: 'other',         label: '⚪ Other' },
  ];

  const save = async () => {
    if (!amt || amt <= 0 || isOver) return;
    setSaving(true);
    try { await onSave(id, amt, date, paymentMode); } finally { setSaving(false); }
  };

  const r = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
        <h2>Record Payment</h2>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{invoiceNo} · {clientName}</div>

        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: 'var(--muted)' }}>Invoice Total</span>
            <span style={{ fontWeight: 700 }}>{r(total)}</span>
          </div>
          {amtPaid > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--muted)' }}>Already Received</span>
              <span style={{ fontWeight: 700, color: 'var(--green)' }}>{r(amtPaid)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span style={{ fontWeight: 700 }}>Balance Due</span>
            <span style={{ fontWeight: 800, color: 'var(--orange)' }}>{r(balance)}</span>
          </div>
        </div>

        <div className="field">
          <label>Amount Received Now (₹)</label>
          <input type="number" autoFocus min="1" max={balance} step="0.01"
            placeholder={`e.g. ${Number(balance).toLocaleString('en-IN')}`}
            value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()} />
          {isOver  && <div style={{ fontSize: 12, color: 'var(--red)',   marginTop: 4 }}>Cannot exceed balance due</div>}
          {isFull  && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>✓ This will mark the invoice as fully paid</div>}
          {!isFull && amt > 0 && !isOver && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Remaining after this: {r(balance - amt)} — you can record more payments later
            </div>
          )}
        </div>

        <div className="field">
          <label>Payment Method / Received Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 4 }}>
            {PAYMENT_MODES.map(pm => {
              const active = paymentMode === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMode(pm.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'var(--accent-l)' : '#fff',
                    color: active ? 'var(--accent)' : 'var(--text)',
                    fontWeight: active ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all .15s'
                  }}
                >
                  {pm.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Payment Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}
            disabled={saving || !amt || amt <= 0 || isOver}>
            {saving ? 'Saving…' : 'Record & Get Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Payment Receipt Modal ─────────────────────────────────────────────────────

function PaymentReceiptModal({ receiptKey, orderId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const printRef = useRef();

  const targetKey = receiptKey || orderId;

  useEffect(() => {
    if (!targetKey) return;
    api.get(`/sales/receipts/${targetKey}`)
      .then(r => setReceipt(r.data))
      .catch(async () => {
        // Fallback for legacy order
        try {
          const r = await api.get(`/sales/${targetKey}`);
          const ord = r.data;
          const subtotal   = ord.items?.reduce((s, it) => s + it.quantity * it.rate_per_pc, 0) || 0;
          const discountAmt = Number(ord.discount || 0);
          const taxable    = Math.max(0, subtotal - discountAmt);
          const gstAmt     = ord.include_gst ? taxable * (ord.gst_percent / 100) : 0;
          const total      = taxable + gstAmt;
          const amtPaid    = Number(ord.amount_paid || 0);
          setReceipt({
            receipt_no: `RCP-${ord.invoice_number}`,
            payment_date: ord.order_date,
            payment_mode: 'cash',
            notes: ord.notes || '',
            client: {
              id: ord.client_id,
              name: ord.client_name,
              city: ord.client_city,
              phone: ord.client_phone,
              address: ord.client_address,
            },
            total_amount: amtPaid,
            allocations: [{
              order_id: ord.id,
              invoice_number: ord.invoice_number,
              order_date: ord.order_date,
              amount_paid_in_receipt: amtPaid,
              order_total: total,
              order_amount_paid: amtPaid,
              balance_remaining: Math.max(0, total - amtPaid),
              status: ord.status,
            }],
            client_total_outstanding: (ord.other_outstanding || []).reduce((s, o) => s + Math.max(0, Number(o.total || 0) - Number(o.amount_paid || 0)), 0),
            other_outstanding: ord.other_outstanding || [],
          });
        } catch (e) {
          console.error('Failed to load receipt', e);
        }
      });
  }, [targetKey]);

  if (!receipt) return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 320, textAlign: 'center', padding: 40 }}>
        <div className="spinner">Loading receipt…</div>
      </div>
    </div>
  );

  const m         = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const fmtDate   = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const receiptNo = receipt.receipt_no || 'RCP-0000';
  const modeLabel = !receipt.payment_mode ? 'Cash' : receipt.payment_mode === 'upi' ? 'UPI / Online' : receipt.payment_mode === 'bank_transfer' ? 'Bank Transfer' : receipt.payment_mode === 'cheque' ? 'Cheque' : receipt.payment_mode.charAt(0).toUpperCase() + receipt.payment_mode.slice(1);

  const printStyles = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; color:#1a1a1a; background:#fff; font-size:13px; }
    .wrap { max-width:780px; margin:0 auto; }
    .hdr { display:flex; justify-content:space-between; align-items:flex-start; padding:28px 40px 22px; border-bottom:1px solid #f0e8d0; }
    .brand { display:flex; align-items:center; gap:14px; }
    .brand img { height:52px; }
    .brand-name { font-size:22px; font-weight:800; color:#C8860A; }
    .brand-sub { font-size:10px; color:#aaa; letter-spacing:.08em; text-transform:uppercase; margin-top:2px; }
    .meta-right { text-align:right; }
    .meta-right .title { font-size:26px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
    .meta-right .ref { font-size:12px; color:#C8860A; font-weight:700; margin-top:4px; }
    .meta-right .date { font-size:11px; color:#777; margin-top:2px; }
    .parties { display:grid; grid-template-columns:1fr 1fr; margin:0 40px; border-bottom:1px solid #f0e8d0; }
    .party { padding:18px 0; }
    .party+.party { padding-left:28px; border-left:1px solid #f0e8d0; }
    .party-lbl { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:#C8860A; margin-bottom:6px; }
    .party-name { font-size:15px; font-weight:800; }
    .party-detail { font-size:12px; color:#666; margin-top:3px; }
    .tbl-wrap { padding:22px 40px 0; }
    table { width:100%; border-collapse:collapse; }
    thead tr { border-bottom:2px solid #C8860A; }
    th { padding:7px 10px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#C8860A; text-align:left; }
    th.r { text-align:right; }
    tbody tr { border-bottom:1px solid #f5f0e8; }
    tbody tr:last-child { border-bottom:none; }
    td { padding:10px 10px; font-size:13px; }
    td.r { text-align:right; }
    tbody tr:nth-child(even) { background:#fdfaf4; }
    .totals { display:flex; justify-content:flex-end; padding:14px 40px 0; }
    .totals-box { min-width:280px; }
    .t-row { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; color:#555; border-bottom:1px solid #f5f0e8; }
    .t-row.received  { font-size:16px; font-weight:800; color:#059669; border-top:2px solid #1a1a1a; border-bottom:none; padding-top:10px; margin-top:4px; }
    .t-row.balance   { font-size:14px; font-weight:700; color:#c0390b; border-bottom:none; padding-top:4px; }
    .status { margin:14px 40px 0; padding:10px 14px; background:#fdfaf4; border-left:3px solid #C8860A; border-radius:0 5px 5px 0; font-size:12px; color:#555; }
    .footer { margin:20px 40px 0; padding:14px 0 28px; border-top:1px solid #f0e8d0; display:flex; justify-content:space-between; align-items:center; }
    .footer-note { font-size:12px; color:#bbb; font-style:italic; }
    .footer-brand { font-size:11px; color:#C8860A; font-weight:700; letter-spacing:.06em; }
    @media print { @page { margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  `;

  const print = () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${receiptNo}</title><style>${printStyles}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 720, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0 }}>🧾 Official Payment Receipt</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{receiptNo} · {modeLabel}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={print}>🖨 Print / PDF</button>
        </div>

        {/* ── printable area ── */}
        <div ref={printRef} style={{ background: '#fff', border: '1px solid #f0e8d0', borderRadius: 10, overflow: 'hidden', fontFamily: "'Segoe UI',Arial,sans-serif", color: '#1a1a1a', fontSize: 13 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '26px 36px 20px', borderBottom: '1px solid #f0e8d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src="/logo.png" alt="Viva Studio" style={{ height: 52, width: 'auto' }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, background: 'linear-gradient(135deg,#C8860A,#8B5500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Viva Studio</div>
                <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 2 }}>Garment Studio</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#059669' }}>RECEIPT</div>
              <div style={{ fontSize: 13, color: '#C8860A', fontWeight: 800, marginTop: 4 }}>{receiptNo}</div>
              <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>Date: {fmtDate(receipt.payment_date)}</div>
              <div style={{ fontSize: 11, color: '#4338ca', fontWeight: 700, marginTop: 2 }}>Payment Mode: {modeLabel}</div>
            </div>
          </div>

          {/* From / To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', margin: '0 36px', borderBottom: '1px solid #f0e8d0' }}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: '#C8860A', marginBottom: 6 }}>From</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Viva Studio</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>Garment Manufacturing &amp; Wholesale</div>
            </div>
            <div style={{ padding: '16px 0 16px 24px', borderLeft: '1px solid #f0e8d0' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: '#C8860A', marginBottom: 6 }}>Received From (Client)</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{receipt.client?.name}</div>
              {receipt.client?.city  && <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{receipt.client.city}</div>}
              {receipt.client?.phone && <div style={{ fontSize: 12, color: '#777' }}>Phone: {receipt.client.phone}</div>}
            </div>
          </div>

          {/* Invoices Tagged / Breakdown Table */}
          <div style={{ padding: '20px 36px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#C8860A', marginBottom: 8 }}>
              Invoices Covered in this Receipt
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #C8860A' }}>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#C8860A' }}>#</th>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#C8860A' }}>Invoice #</th>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#C8860A' }}>Invoice Date</th>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#C8860A', textAlign: 'right' }}>Invoice Total</th>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#059669', textAlign: 'right' }}>Received in Receipt</th>
                  <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#C8860A', textAlign: 'right' }}>Invoice Balance</th>
                </tr>
              </thead>
              <tbody>
                {receipt.allocations?.map((al, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f5f0e8', background: i % 2 === 1 ? '#fdfaf4' : '#fff' }}>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#bbb' }}>{i + 1}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 700, color: 'var(--accent)' }}>{al.invoice_number}</td>
                    <td style={{ padding: '10px 10px', color: '#666' }}>{fmtDate(al.order_date)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600 }}>{m(al.order_total)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: 14 }}>
                      +{m(al.amount_paid_in_receipt)}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: al.balance_remaining > 0 ? '#c0390b' : '#059669' }}>
                      {al.balance_remaining > 0 ? m(al.balance_remaining) : '✓ Paid'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 36px 0', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: 300 }}>
              {receipt.notes && (
                <div style={{ padding: '8px 12px', background: '#fdfaf4', borderLeft: '3px solid #C8860A', borderRadius: '0 5px 5px 0', fontSize: 12, color: '#555' }}>
                  <b style={{ color: '#1a1a1a' }}>Note:</b> {receipt.notes}
                </div>
              )}
            </div>

            <div style={{ minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', fontSize: 17, fontWeight: 900, color: '#059669', borderTop: '2px solid #1a1a1a' }}>
                <span>Total Amount Received</span>
                <span>{m(receipt.total_amount)}</span>
              </div>
              {receipt.client_total_outstanding > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 2px', fontSize: 13, fontWeight: 700, color: '#c0390b', borderTop: '1px dashed #f0e8d0' }}>
                  <span>Total Client Remaining Due</span>
                  <span>{m(receipt.client_total_outstanding)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Other pending invoices */}
          {receipt.other_outstanding && receipt.other_outstanding.length > 0 && (
            <div style={{ margin: '18px 36px 0', padding: '12px 14px', background: '#fff8f8', borderRadius: 8, border: '1px solid #fed7d7' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#c0390b', marginBottom: 6 }}>
                ⚠ Other Invoices With Outstanding Balance for {receipt.client?.name}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
                {receipt.other_outstanding.map(o => (
                  <span key={o.id} style={{ background: '#fff', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                    {o.invoice_number}: Due {m(o.balance)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ margin: '20px 36px 0', padding: '12px 0 24px', borderTop: '1px solid #f0e8d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>Thank you for your prompt payment!</div>
            <div style={{ fontSize: 11, color: '#C8860A', fontWeight: 700, letterSpacing: '.06em' }}>VIVA STUDIO ERP</div>
          </div>

        </div>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Modal (Printable) ─────────────────────────────────────────────────

function InvoiceModal({ order, onClose }) {
  const printRef = useRef();

  const subtotal     = order.items?.reduce((s, it) => s + it.quantity * it.rate_per_pc, 0) || 0;
  const discountAmt  = Number(order.discount || 0);
  const taxable      = Math.max(0, subtotal - discountAmt);
  const gstAmt       = order.include_gst ? taxable * (order.gst_percent / 100) : 0;
  const total        = taxable + gstAmt;
  const otherDue     = (order.other_outstanding || []).reduce((s, o) => s + (Number(o.total) - Number(o.amount_paid)), 0);
  const grandTotal   = total + otherDue;

  const print = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>${order.invoice_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; font-size: 13px; }
        .inv-wrap { max-width: 780px; margin: 0 auto; }

        /* Gold top bar */
        .inv-topbar { height: 8px; background: linear-gradient(90deg, #C8860A, #FFE87A, #C8860A); }

        /* Header */
        .inv-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 32px 40px 24px; border-bottom: 1px solid #f0e8d0; }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand img { height: 56px; width: auto; }
        .brand-text .name { font-size: 24px; font-weight: 800; letter-spacing: .02em; background: linear-gradient(135deg,#C8860A,#8B5500); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .brand-text .tagline { font-size: 11px; color: #aaa; letter-spacing: .08em; text-transform: uppercase; margin-top: 2px; }
        .inv-meta { text-align: right; }
        .inv-meta .word { font-size: 28px; font-weight: 900; letter-spacing: .1em; color: #1a1a1a; text-transform: uppercase; }
        .inv-meta .num { font-size: 13px; color: #C8860A; font-weight: 700; margin-top: 4px; }
        .inv-meta .date { font-size: 12px; color: #777; margin-top: 2px; }

        /* Status pill */
        .pill { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 6px; }
        .pill-paid { background: #d1fae5; color: #065f46; }
        .pill-pending { background: #fff7d6; color: #92400e; border: 1px solid #f6d860; }

        /* Parties */
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 0 40px 0; }
        .party { padding: 20px 0; }
        .party + .party { padding-left: 32px; border-left: 1px solid #f0e8d0; }
        .party-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; color: #C8860A; margin-bottom: 8px; }
        .party-name { font-size: 16px; font-weight: 800; color: #1a1a1a; }
        .party-detail { font-size: 12px; color: #666; margin-top: 3px; line-height: 1.5; }

        /* Divider accent */
        .accent-divider { height: 2px; background: linear-gradient(90deg,#C8860A22,#C8860A55,#C8860A22); margin: 0 40px 0; }

        /* Table */
        .tbl-wrap { padding: 24px 40px 0; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { border-bottom: 2px solid #C8860A; }
        th { padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #C8860A; text-align: left; }
        th.r { text-align: right; }
        tbody tr { border-bottom: 1px solid #f5f0e8; }
        tbody tr:last-child { border-bottom: none; }
        td { padding: 11px 10px; font-size: 13px; color: #1a1a1a; }
        td.muted { color: #999; font-size: 12px; }
        td.r { text-align: right; }
        td.bold { font-weight: 700; }
        tbody tr:nth-child(even) { background: #fdfaf4; }

        /* Totals */
        .totals-wrap { display: flex; justify-content: flex-end; padding: 16px 40px 0; }
        .totals-box { min-width: 260px; }
        .t-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #555; border-bottom: 1px solid #f5f0e8; }
        .t-row.grand { border-bottom: none; padding-top: 12px; font-size: 17px; font-weight: 900; color: #1a1a1a; }
        .t-row.grand span:last-child { color: #C8860A; }

        /* Notes */
        .notes { margin: 16px 40px 0; padding: 12px 16px; background: #fdfaf4; border-left: 3px solid #C8860A; border-radius: 0 6px 6px 0; font-size: 12px; color: #555; }
        .notes b { color: #1a1a1a; }

        /* Footer */
        .inv-footer { margin: 28px 40px 0; padding: 16px 0 32px; border-top: 1px solid #f0e8d0; display: flex; justify-content: space-between; align-items: center; }
        .footer-msg { font-size: 12px; color: #aaa; font-style: italic; }
        .footer-brand { font-size: 11px; color: #C8860A; font-weight: 700; letter-spacing: .06em; }

        /* Gold bottom bar */
        .inv-bottombar { height: 4px; background: linear-gradient(90deg, #C8860A, #FFE87A, #C8860A); }

        @media print { @page { margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 680, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Invoice Preview</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={print}>🖨 Print / Save PDF</button>
          </div>
        </div>

        {/* Invoice content */}
        <div ref={printRef} style={{ background: '#fff', border: '1px solid #f0e8d0', borderRadius: 10, overflow: 'hidden' }}>

          {/* Gold top bar */}
          <div style={{ height: 8, background: 'linear-gradient(90deg,#C8860A,#FFE87A,#C8860A)' }} />

          {/* Header: brand left, invoice meta right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '28px 36px 22px', borderBottom: '1px solid #f0e8d0' }}>
            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src="/logo.png" alt="Viva Studio" style={{ height: 56, width: 'auto' }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '.02em', background: 'linear-gradient(135deg,#C8860A,#8B5500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Viva Studio</div>
                <div style={{ fontSize: 10, color: '#bbb', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2 }}>Garment Studio</div>
              </div>
            </div>
            {/* Invoice meta */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '.12em', color: '#1a1a1a' }}>INVOICE</div>
              <div style={{ fontSize: 13, color: '#C8860A', fontWeight: 700, marginTop: 4 }}>{order.invoice_number}</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>Date: {fmtD(order.order_date)}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{
                  display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: order.status === 'paid' ? '#d1fae5' : '#fff7d6',
                  color: order.status === 'paid' ? '#065f46' : '#92400e',
                  border: order.status === 'paid' ? 'none' : '1px solid #f6d860',
                }}>
                  {order.status === 'paid' ? '✓ Paid' : '⏳ Payment Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Bill From / Bill To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', margin: '0 36px', borderBottom: '1px solid #f0e8d0' }}>
            <div style={{ padding: '20px 0' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: '#C8860A', marginBottom: 8 }}>From</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>Viva Studio</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 3, lineHeight: 1.6 }}>Garment Manufacturing</div>
            </div>
            <div style={{ padding: '20px 0 20px 28px', borderLeft: '1px solid #f0e8d0' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: '#C8860A', marginBottom: 8 }}>Bill To</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>{order.client_name}</div>
              {order.client_city    && <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>{order.client_city}</div>}
              {order.client_phone   && <div style={{ fontSize: 12, color: '#777' }}>{order.client_phone}</div>}
              {order.client_address && <div style={{ fontSize: 12, color: '#777' }}>{order.client_address}</div>}
            </div>
          </div>

          {/* Items table */}
          <div style={{ padding: '24px 36px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #C8860A' }}>
                  <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#C8860A', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#C8860A', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#C8860A', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#C8860A', textAlign: 'right' }}>Rate / pc</th>
                  <th style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#C8860A', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((it, i) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f5f0e8', background: i % 2 === 1 ? '#fdfaf4' : '#fff' }}>
                    <td style={{ padding: '11px 10px', fontSize: 12, color: '#bbb' }}>{i + 1}</td>
                    <td style={{ padding: '11px 10px', fontWeight: 600, fontSize: 13 }}>{getProductLabel(it.category)}{it.size ? ` (${formatSize(it.size)})` : ''}</td>
                    <td style={{ padding: '11px 10px', textAlign: 'right', fontSize: 13 }}>{it.quantity} pcs</td>
                    <td style={{ padding: '11px 10px', textAlign: 'right', fontSize: 13 }}>{fmt(it.rate_per_pc)}</td>
                    <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{fmt(it.quantity * it.rate_per_pc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 36px 0' }}>
            <div style={{ minWidth: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: '#666', borderBottom: '1px solid #f5f0e8' }}>
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: '#059669', borderBottom: '1px solid #f5f0e8' }}>
                  <span>Discount</span><span>−{fmt(discountAmt)}</span>
                </div>
              )}
              {!!order.include_gst && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: '#666', borderBottom: '1px solid #f5f0e8' }}>
                  <span>GST ({order.gst_percent}%)</span><span>{fmt(gstAmt)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontSize: 18, fontWeight: 900, color: '#1a1a1a' }}>
                <span>Total</span>
                <span style={{ color: '#C8860A' }}>{fmt(total)}</span>
              </div>
              {otherDue > 0 && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: '#c0390b', borderTop: '1px dashed #f0e8d0', marginTop: 8 }}>
                  <span>Previous Outstanding Balance</span><span>{fmt(otherDue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 16, fontWeight: 900, color: '#c0390b', borderTop: '2px solid #c0390b', marginTop: 2 }}>
                  <span>Total Amount Due</span><span>{fmt(grandTotal)}</span>
                </div>
              </>}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div style={{ margin: '20px 36px 0', padding: '10px 14px', background: '#fdfaf4', borderLeft: '3px solid #C8860A', borderRadius: '0 6px 6px 0', fontSize: 12, color: '#555' }}>
              <b style={{ color: '#1a1a1a' }}>Notes:</b> {order.notes}
            </div>
          )}

          {/* Footer */}
          <div style={{ margin: '24px 36px 0', padding: '14px 0 28px', borderTop: '1px solid #f0e8d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>Thank you for your business!</div>
            <div style={{ fontSize: 11, color: '#C8860A', fontWeight: 700, letterSpacing: '.06em' }}>VIVA STUDIO</div>
          </div>

          {/* Gold bottom bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg,#C8860A,#FFE87A,#C8860A)' }} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Receipts Tab ─────────────────────────────────────────────────────────────

function ReceiptsTab({ onReload }) {
  const [payments, setPayments]       = useState([]);
  const [summary, setSummary]         = useState({ total_collected: 0, cash_collected: 0, upi_collected: 0, bank_collected: 0, cheque_collected: 0, total_count: 0 });
  const [clients, setClients]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [total, setTotal]             = useState(0);

  // Filters
  const [clientFilter, setClientFilter]   = useState('all');
  const [modeFilter, setModeFilter]       = useState('all');
  const [datePreset, setDatePreset]       = useState('all'); // 'all', 'today', 'this_week', 'this_month', 'custom'
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [search, setSearch]               = useState('');

  // Modals
  const [receiptKey, setReceiptKey]               = useState(null);
  const [viewInvoice, setViewInvoice]             = useState(null);
  const [showRecordReceipt, setShowRecordReceipt] = useState(false);
  const [editReceiptKey, setEditReceiptKey]       = useState(null);

  // Load client dropdown list
  useEffect(() => {
    api.get('/sales/clients').then(r => setClients(r.data || [])).catch(() => {});
  }, []);

  // Compute effective start and end dates from datePreset
  const { effStart, effEnd } = useMemo(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const d = now.toISOString().slice(0, 10);
      return { effStart: d, effEnd: d };
    }
    if (datePreset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(new Date().setDate(diff)).toISOString().slice(0, 10);
      const end = new Date().toISOString().slice(0, 10);
      return { effStart: start, effEnd: end };
    }
    if (datePreset === 'this_month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const start = `${y}-${m}-01`;
      const end = new Date().toISOString().slice(0, 10);
      return { effStart: start, effEnd: end };
    }
    if (datePreset === 'custom') {
      return { effStart: startDate, effEnd: endDate };
    }
    return { effStart: '', effEnd: '' };
  }, [datePreset, startDate, endDate]);

  const load = () => {
    setLoading(true);
    const params = {
      page,
      limit: 50,
      ...(clientFilter !== 'all' ? { client_id: clientFilter } : {}),
      ...(modeFilter !== 'all' ? { payment_mode: modeFilter } : {}),
      ...(effStart ? { from: effStart } : {}),
      ...(effEnd ? { to: effEnd } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    };
    api.get('/sales/payments', { params })
      .then(r => {
        setPayments(r.data.data || []);
        setSummary(r.data.summary || { total_collected: 0, cash_collected: 0, upi_collected: 0, bank_collected: 0, cheque_collected: 0, total_count: 0 });
        setPages(r.data.pages || 1);
        setTotal(r.data.total || 0);
      })
      .catch(e => console.error('Failed to load receipts', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); }, [clientFilter, modeFilter, datePreset, effStart, effEnd, search]);
  useEffect(() => { load(); }, [clientFilter, modeFilter, datePreset, effStart, effEnd, search, page]);

  const openInvoiceForOrder = async (orderId) => {
    try {
      const r = await api.get(`/sales/${orderId}`);
      setViewInvoice(r.data);
    } catch (e) {
      alert('Failed to load invoice');
    }
  };

  const deleteReceipt = async (targetId) => {
    if (!confirm('Are you sure you want to delete this payment receipt? All linked invoice balances and statuses will be recalculated automatically.')) return;
    try {
      await api.delete(`/sales/receipts/${targetId}`);
      load();
      onReload();
    } catch (e) {
      alert('Failed to delete receipt');
    }
  };

  const modeBadge = (mode) => {
    const m = (mode || 'cash').toLowerCase();
    if (m === 'upi') return <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: 11 }}>📱 UPI</span>;
    if (m === 'bank_transfer') return <span className="badge" style={{ background: '#f3e8ff', color: '#7e22ce', fontWeight: 700, fontSize: 11 }}>🏛️ Bank</span>;
    if (m === 'cheque') return <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 11 }}>📜 Cheque</span>;
    return <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: 11 }}>💵 Cash</span>;
  };

  return (
    <>
      {/* Receipts Summary Metrics */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <SummaryChip label="Total Collections" value={fmt(summary.total_collected)} color="var(--green)" />
        <SummaryChip label="UPI / Online"      value={fmt(summary.upi_collected)}   color="#0284c7" />
        <SummaryChip label="Cash"              value={fmt(summary.cash_collected)}  color="var(--accent)" />
        {summary.bank_collected > 0 && (
          <SummaryChip label="Bank Transfer"   value={fmt(summary.bank_collected)}  color="#7e22ce" />
        )}
        <SummaryChip label="Total Receipts"    value={summary.total_count}          color="var(--text)" small />
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Client Filter */}
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }}
        >
          <option value="all">👥 All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.city ? `(${c.city})` : ''}</option>
          ))}
        </select>

        {/* Payment Mode Filter */}
        <select
          value={modeFilter}
          onChange={e => setModeFilter(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }}
        >
          <option value="all">💳 All Modes</option>
          <option value="upi">📱 UPI</option>
          <option value="cash">💵 Cash</option>
          <option value="bank_transfer">🏛️ Bank Transfer</option>
          <option value="cheque">📜 Cheque</option>
        </select>

        {/* Date Preset Selector */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3 }}>
          {[
            ['all', 'All Time'],
            ['today', 'Today'],
            ['this_week', 'This Week'],
            ['this_month', 'This Month'],
            ['custom', 'Custom'],
          ].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDatePreset(k)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                borderRadius: 6,
                background: datePreset === k ? 'var(--white)' : 'transparent',
                color: datePreset === k ? 'var(--text)' : 'var(--muted)',
                boxShadow: datePreset === k ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
            />
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search receipt, invoice, client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, width: 220 }}
        />

        {/* Record Direct Receipt Button */}
        <button
          className="btn btn-primary btn-sm"
          style={{
            marginLeft: 'auto',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            fontWeight: 700,
            border: 'none',
            boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
            cursor: 'pointer'
          }}
          onClick={() => setShowRecordReceipt(true)}
        >
          + Record Receipt
        </button>
      </div>

      {/* Receipts Table */}
      {loading ? (
        <div className="spinner">Loading receipts…</div>
      ) : payments.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>No payment receipts found</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Click <b>+ Record Receipt</b> to log payments against one or multiple pending deliveries.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ minWidth: 720, margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Date</th>
                    <th>Receipt #</th>
                    <th>Client</th>
                    <th>Linked Invoices</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right', color: 'var(--green)' }}>Amount Received</th>
                    <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => {
                    const totalAmt = p.total_amount !== undefined ? Number(p.total_amount) : Number(p.amount || 0);
                    const receiptNum = p.receipt_no || p.receipt_key || `RCP-${p.id}`;
                    return (
                      <tr key={p.receipt_key || p.id || idx}>
                        <td style={{ color: 'var(--muted)', fontSize: 11 }}>{idx + 1 + (page - 1) * 50}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }}>{fmtD(p.payment_date?.slice(0, 10))}</td>
                        <td>
                          <span style={{ fontWeight: 800, fontSize: 12, color: '#b45309' }}>
                            {receiptNum}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.client_name}</div>
                          {p.client_city && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.client_city}</div>}
                        </td>
                        <td>
                          {p.invoices && p.invoices.length > 0 ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {p.invoices.map((inv, iIdx) => (
                                <button
                                  key={inv.order_id || iIdx}
                                  type="button"
                                  onClick={() => openInvoiceForOrder(inv.order_id)}
                                  style={{
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '2px 7px',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--accent)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title={`Invoice ${inv.invoice_number}: ${fmt(inv.amount)} allocated (Total ${fmt(inv.order_total)})`}
                                >
                                  📄 {inv.invoice_number} <span style={{ color: '#059669', fontWeight: 800 }}>({fmt(inv.amount)})</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openInvoiceForOrder(p.order_id)}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '2px 7px',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--accent)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              📄 {p.invoice_number || 'View Invoice'}
                            </button>
                          )}
                        </td>
                        <td>{modeBadge(p.payment_mode)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)', fontSize: 14 }}>
                          {fmt(totalAmt)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '3px 8px', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}
                              onClick={() => setEditReceiptKey(p.receipt_key || p.receipt_no || p.id)}
                              title="Edit payment receipt"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '3px 8px', fontSize: 11, color: '#C8860A', fontWeight: 700 }}
                              onClick={() => setReceiptKey(p.receipt_key || p.receipt_no || p.id)}
                              title="Print / PDF Receipt"
                            >
                              🖨️ Receipt
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '3px 6px', fontSize: 11, color: 'var(--red)' }}
                              onClick={() => deleteReceipt(p.receipt_key || p.receipt_no || p.id)}
                              title="Delete receipt"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                    <td colSpan={6} style={{ fontSize: 13, color: 'var(--muted)' }}>Page Totals ({payments.length} receipts)</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)', fontSize: 14 }}>
                      {fmt(payments.reduce((s, x) => s + Number(x.total_amount !== undefined ? x.total_amount : x.amount || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 }}>
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

      {/* Modals */}
      {receiptKey && (
        <PaymentReceiptModal receiptKey={receiptKey} onClose={() => setReceiptKey(null)} />
      )}
      {viewInvoice && (
        <InvoiceModal order={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}
      {showRecordReceipt && (
        <RecordDirectReceiptModal
          clients={clients}
          onClose={() => setShowRecordReceipt(false)}
          onSaved={(generatedReceiptNo) => {
            setShowRecordReceipt(false);
            if (generatedReceiptNo) setReceiptKey(generatedReceiptNo);
            load();
            onReload();
          }}
        />
      )}
      {editReceiptKey && (
        <EditPaymentReceiptModal
          receiptKey={editReceiptKey}
          onClose={() => setEditReceiptKey(null)}
          onSaved={() => {
            setEditReceiptKey(null);
            load();
            onReload();
          }}
        />
      )}
    </>
  );
}

// ── Record Direct Receipt Modal (Multi-Invoice Tagging) ──────────────────────

function RecordDirectReceiptModal({ clients, onClose, onSaved }) {
  const [clientId, setClientId]           = useState('');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [totalAmount, setTotalAmount]     = useState('');
  const [paymentDate, setPaymentDate]     = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode]     = useState('upi');
  const [notes, setNotes]                 = useState('');
  const [allocations, setAllocations]     = useState({}); // { [orderId]: { selected: boolean, amount: string } }
  const [saving, setSaving]               = useState(false);

  // Fetch pending invoices when client changes
  useEffect(() => {
    if (!clientId) {
      setPendingOrders([]);
      setAllocations({});
      setTotalAmount('');
      return;
    }
    setLoadingOrders(true);
    api.get('/sales', { params: { client_id: clientId, status: 'pending', limit: 100 } })
      .then(r => {
        const rawList = r.data?.data || [];
        // Map and compute exact balance due
        const mapped = rawList.map(o => {
          const subtotal   = Number(o.subtotal || 0);
          const discountAmt = Number(o.discount || 0);
          const taxable    = Math.max(0, subtotal - discountAmt);
          const gst        = o.include_gst ? taxable * (Number(o.gst_percent || 0) / 100) : 0;
          const orderTotal = o.total !== undefined ? Number(o.total) : (taxable + gst);
          const amtPaid    = Number(o.amount_paid || 0);
          const due        = Math.max(0, orderTotal - amtPaid);
          return {
            id: o.id,
            invoice_number: o.invoice_number,
            order_date: o.order_date,
            total: orderTotal,
            amount_paid: amtPaid,
            due: due,
          };
        }).filter(o => o.due > 0.01);

        // Sort oldest first
        mapped.sort((a, b) => (a.order_date || '').localeCompare(b.order_date || '') || a.id - b.id);
        setPendingOrders(mapped);

        // Initialize empty allocations
        const initialAllocs = {};
        mapped.forEach(o => {
          initialAllocs[o.id] = { selected: false, amount: '' };
        });
        setAllocations(initialAllocs);

        // If only 1 order, pre-select it
        if (mapped.length === 1) {
          const single = mapped[0];
          setTotalAmount(String(single.due));
          setAllocations({
            [single.id]: { selected: true, amount: String(single.due) }
          });
        }
      })
      .catch(e => console.error('Failed to load pending client orders', e))
      .finally(() => setLoadingOrders(false));
  }, [clientId]);

  // Total client outstanding across all pending invoices
  const totalClientDue = useMemo(() => {
    return pendingOrders.reduce((s, o) => s + o.due, 0);
  }, [pendingOrders]);

  // Calculate sum of currently allocated amounts
  const allocatedSum = useMemo(() => {
    return Object.entries(allocations).reduce((sum, [_, val]) => {
      if (val?.selected && Number(val.amount) > 0) {
        return sum + Number(val.amount);
      }
      return sum;
    }, 0);
  }, [allocations]);

  const numTotalAmount = Number(totalAmount || 0);
  const unallocatedAmount = Math.max(0, numTotalAmount - allocatedSum);
  const isOverAllocated = allocatedSum > numTotalAmount && numTotalAmount > 0;

  // Auto-allocate entered totalAmount across invoices (oldest first)
  const autoAllocate = (enteredTotal = totalAmount) => {
    let rem = Number(enteredTotal || 0);
    const nextAllocs = {};
    for (const ord of pendingOrders) {
      if (rem > 0) {
        const alloc = Math.min(rem, ord.due);
        nextAllocs[ord.id] = {
          selected: alloc > 0,
          amount: alloc > 0 ? (Math.round(alloc * 100) / 100).toFixed(2).replace(/\.00$/, '') : '',
        };
        rem -= alloc;
      } else {
        nextAllocs[ord.id] = { selected: false, amount: '' };
      }
    }
    setAllocations(nextAllocs);
  };

  // Toggle single invoice checkbox
  const handleToggleInvoice = (ordId) => {
    const ord = pendingOrders.find(o => o.id === ordId);
    if (!ord) return;

    const curr = allocations[ordId] || { selected: false, amount: '' };
    const nextSelected = !curr.selected;

    if (nextSelected) {
      // Allocate either remaining unallocated or the full invoice due
      const fillAmt = unallocatedAmount > 0 ? Math.min(unallocatedAmount, ord.due) : ord.due;
      const formatted = (Math.round(fillAmt * 100) / 100).toFixed(2).replace(/\.00$/, '');
      const newAllocs = {
        ...allocations,
        [ordId]: { selected: true, amount: formatted }
      };
      setAllocations(newAllocs);
      // If totalAmount is 0 or less, auto-bump totalAmount
      if (numTotalAmount === 0) {
        setTotalAmount(formatted);
      }
    } else {
      setAllocations({
        ...allocations,
        [ordId]: { selected: false, amount: '' }
      });
    }
  };

  // Update allocation amount directly for an invoice
  const handleAmountChange = (ordId, val) => {
    const numVal = Number(val || 0);
    setAllocations(prev => ({
      ...prev,
      [ordId]: {
        selected: numVal > 0,
        amount: val
      }
    }));
  };

  // Pay full button shortcut for a specific invoice
  const handlePayFullInvoice = (ord) => {
    const formatted = (Math.round(ord.due * 100) / 100).toFixed(2).replace(/\.00$/, '');
    setAllocations(prev => ({
      ...prev,
      [ord.id]: { selected: true, amount: formatted }
    }));
    // If totalAmount was empty or lower than new sum, adjust totalAmount
    const otherSum = Object.entries(allocations).reduce((sum, [id, v]) => {
      if (Number(id) !== ord.id && v?.selected && Number(v.amount) > 0) return sum + Number(v.amount);
      return sum;
    }, 0);
    const newTotal = otherSum + ord.due;
    if (numTotalAmount < newTotal) {
      setTotalAmount((Math.round(newTotal * 100) / 100).toFixed(2).replace(/\.00$/, ''));
    }
  };

  // Submit payment
  const handleSave = async () => {
    if (!clientId) {
      alert('Please select a client.');
      return;
    }
    const validAllocations = Object.entries(allocations)
      .filter(([_, a]) => a?.selected && Number(a.amount) > 0)
      .map(([orderId, a]) => ({
        order_id: Number(orderId),
        amount: Number(a.amount)
      }));

    if (validAllocations.length === 0) {
      alert('Please select at least one invoice and specify the payment amount to allocate.');
      return;
    }

    if (numTotalAmount > 0 && isOverAllocated) {
      alert(`Allocated total (₹${allocatedSum}) exceeds the entered total received (₹${numTotalAmount}). Please adjust.`);
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/sales/multi-payment', {
        client_id: Number(clientId),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        notes: notes.trim() || undefined,
        allocations: validAllocations,
      });

      onSaved(res.data?.receipt_no);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to record receipt');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 780, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', borderRadius: 12 }} onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🧾 Record Client Payment Receipt</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Receive single payment and tag/allocate across one or multiple invoices.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>

        <div className="form-grid">
          {/* Client Selection */}
          <div className="field form-full">
            <label style={{ fontWeight: 700, fontSize: 12 }}>Select Client *</label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              style={{ fontWeight: 700, fontSize: 14 }}
              autoFocus
            >
              <option value="">-- Choose Client to Receive Payment --</option>
              {clients.filter(c => c.is_active).map(c => (
                <option key={c.id} value={String(c.id)}>{c.name} {c.city ? `(${c.city})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Amount & Date & Mode */}
          <div className="field">
            <label style={{ fontWeight: 700, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Amount Received (₹) *</span>
              {totalClientDue > 0 && (
                <span
                  style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}
                  onClick={() => {
                    const fullStr = (Math.round(totalClientDue * 100) / 100).toFixed(2).replace(/\.00$/, '');
                    setTotalAmount(fullStr);
                    autoAllocate(fullStr);
                  }}
                >
                  Pay Total Due ({fmt(totalClientDue)})
                </span>
              )}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 2000.00"
              value={totalAmount}
              onChange={e => {
                const val = e.target.value;
                setTotalAmount(val);
                if (Number(val) > 0 && pendingOrders.length > 0) {
                  autoAllocate(val);
                }
              }}
              style={{ fontWeight: 800, color: 'var(--green)', fontSize: 16 }}
            />
          </div>

          <div className="field">
            <label style={{ fontWeight: 700, fontSize: 12 }}>Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Payment Mode */}
          <div className="field form-full">
            <label style={{ fontWeight: 700, fontSize: 12 }}>Payment Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              {[
                ['upi', '📱 UPI / Online'],
                ['cash', '💵 Cash'],
                ['bank_transfer', '🏛️ Bank Transfer'],
                ['cheque', '📜 Cheque'],
              ].map(([m, lbl]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMode(m)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 6,
                    border: paymentMode === m ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: paymentMode === m ? '#eff6ff' : '#fff',
                    color: paymentMode === m ? 'var(--accent)' : 'var(--text)',
                    fontWeight: paymentMode === m ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Notes / Remarks */}
          <div className="field form-full">
            <label style={{ fontWeight: 700, fontSize: 12 }}>Notes / Reference (Optional)</label>
            <input
              type="text"
              placeholder="e.g. UPI Ref #123456 / Cheque #987654"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* ── Multi-Invoice Tagging Section ── */}
        {clientId && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: '#1a1a1a' }}>
                  Tag Invoices to this Receipt
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
                  ({pendingOrders.length} unpaid / partial invoice{pendingOrders.length !== 1 ? 's' : ''})
                </span>
              </div>
              {pendingOrders.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: '#eff6ff' }}
                    onClick={() => autoAllocate(totalAmount)}
                    title="Automatically allocate the entered total to the oldest unpaid invoices first"
                  >
                    ⚡ Auto-Allocate (Oldest First)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      const cleared = {};
                      pendingOrders.forEach(o => { cleared[o.id] = { selected: false, amount: '' }; });
                      setAllocations(cleared);
                    }}
                  >
                    Clear Allocations
                  </button>
                </div>
              )}
            </div>

            {loadingOrders ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                <div className="spinner">Fetching client unpaid invoices…</div>
              </div>
            ) : pendingOrders.length === 0 ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '16px', fontSize: 13, color: '#166534', textAlign: 'center' }}>
                🎉 <b>No pending invoices for this client!</b> All invoices have been settled in full.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', margin: 0, borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ width: 36, padding: '8px 10px', textAlign: 'center' }}>Tag</th>
                      <th style={{ padding: '8px 10px' }}>Invoice #</th>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Invoice Total</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Already Paid</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--orange)' }}>Balance Due</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 170 }}>Allocate Now (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map(ord => {
                      const allocInfo = allocations[ord.id] || { selected: false, amount: '' };
                      const isSelected = allocInfo.selected;
                      const allocAmt = Number(allocInfo.amount || 0);
                      const isOver = allocAmt > ord.due;

                      return (
                        <tr
                          key={ord.id}
                          style={{
                            background: isSelected ? '#f0fdf4' : '#fff',
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background .15s'
                          }}
                        >
                          <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleInvoice(ord.id)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--accent)' }}>
                            {ord.invoice_number}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
                            {fmtD(ord.order_date?.slice(0, 10))}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                            {fmt(ord.total)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--muted)' }}>
                            {fmt(ord.amount_paid)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#c0390b' }}>
                            {fmt(ord.due)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <input
                                type="number"
                                min="0"
                                max={ord.due}
                                step="0.01"
                                placeholder="0.00"
                                value={allocInfo.amount}
                                onChange={e => handleAmountChange(ord.id, e.target.value)}
                                style={{
                                  width: 90,
                                  padding: '4px 6px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textAlign: 'right',
                                  borderColor: isOver ? 'var(--red)' : isSelected ? '#10b981' : 'var(--border)',
                                  color: isOver ? 'var(--red)' : '#059669'
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}
                                onClick={() => handlePayFullInvoice(ord)}
                                title="Allocate full balance due"
                              >
                                Full
                              </button>
                            </div>
                            {isOver && (
                              <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>
                                Exceeds due ({fmt(ord.due)})
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Live Allocation Summary Box */}
            {pendingOrders.length > 0 && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ color: 'var(--muted)' }}>Total Received: </span>
                    <b style={{ color: 'var(--text)' }}>{fmt(numTotalAmount)}</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)' }}>Allocated: </span>
                    <b style={{ color: isOverAllocated ? 'var(--red)' : '#059669' }}>{fmt(allocatedSum)}</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)' }}>Unallocated: </span>
                    <b style={{ color: unallocatedAmount > 0 ? '#d97706' : 'var(--muted)' }}>{fmt(unallocatedAmount)}</b>
                  </div>
                </div>

                {isOverAllocated && (
                  <div style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>
                    ⚠️ Allocation exceeds total received by {fmt(allocatedSum - numTotalAmount)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSave}
            disabled={!clientId || allocatedSum <= 0 || isOverAllocated || saving}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
            }}
          >
            {saving ? 'Saving Receipt…' : `Record & Generate Receipt (${fmt(allocatedSum)}) 🖨️`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Payment Receipt Modal ───────────────────────────────────────────────

function EditPaymentReceiptModal({ receiptKey, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [receiptNo, setReceiptNo] = useState('');
  const [client, setClient] = useState(null);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');

  const [allocations, setAllocations] = useState([]);
  const [otherInvoices, setOtherInvoices] = useState([]);
  const [selectedAddInvoiceId, setSelectedAddInvoiceId] = useState('');

  useEffect(() => {
    if (!receiptKey) return;
    setLoading(true);
    setError(null);
    api.get(`/sales/receipts/${receiptKey}`)
      .then(r => {
        const d = r.data;
        setReceiptNo(d.receipt_no || receiptKey);
        setClient(d.client || null);
        setPaymentDate(d.payment_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
        setPaymentMode(d.payment_mode || 'cash');
        setNotes(d.notes || '');

        // Map current receipt allocations
        const mappedAllocs = (d.allocations || []).map(a => {
          const ordTotal = Number(a.order_total || 0);
          const amtInReceipt = Number(a.amount_paid_in_receipt || 0);
          const amtPaidTotal = Number(a.order_amount_paid || 0);
          const otherPaid = Math.max(0, amtPaidTotal - amtInReceipt);
          const maxEligible = Math.max(0, ordTotal - otherPaid);
          return {
            order_id: a.order_id,
            invoice_number: a.invoice_number,
            order_date: a.order_date,
            order_total: ordTotal,
            other_paid: otherPaid,
            max_eligible: maxEligible,
            amount: amtInReceipt > 0 ? String(amtInReceipt) : '',
          };
        });
        setAllocations(mappedAllocs);

        // Map other outstanding invoices for this client
        const mappedOther = (d.other_outstanding || []).map(o => ({
          order_id: o.id,
          invoice_number: o.invoice_number,
          order_date: o.order_date,
          order_total: Number(o.total || 0),
          other_paid: Number(o.amount_paid || 0),
          max_eligible: Math.max(0, Number(o.total || 0) - Number(o.amount_paid || 0)),
          amount: '',
        }));
        setOtherInvoices(mappedOther);
      })
      .catch(err => {
        console.error('Failed to load receipt for edit', err);
        setError(err.response?.data?.message || 'Failed to load payment receipt details');
      })
      .finally(() => setLoading(false));
  }, [receiptKey]);

  const handleAmountChange = (orderId, val) => {
    setAllocations(prev => prev.map(a => {
      if (a.order_id === orderId) {
        return { ...a, amount: val };
      }
      return a;
    }));
  };

  const handleSetMax = (orderId) => {
    setAllocations(prev => prev.map(a => {
      if (a.order_id === orderId) {
        return { ...a, amount: (Math.round(a.max_eligible * 100) / 100).toFixed(2).replace(/\.00$/, '') };
      }
      return a;
    }));
  };

  const handleRemoveInvoice = (orderId) => {
    const itemToRemove = allocations.find(a => a.order_id === orderId);
    if (!itemToRemove) return;
    setAllocations(prev => prev.filter(a => a.order_id !== orderId));
    setOtherInvoices(prev => [...prev, { ...itemToRemove, amount: '' }]);
  };

  const handleAddInvoice = () => {
    if (!selectedAddInvoiceId) return;
    const itemToAdd = otherInvoices.find(o => o.order_id === Number(selectedAddInvoiceId));
    if (!itemToAdd) return;
    setOtherInvoices(prev => prev.filter(o => o.order_id !== Number(selectedAddInvoiceId)));
    setAllocations(prev => [...prev, { ...itemToAdd, amount: (Math.round(itemToAdd.max_eligible * 100) / 100).toFixed(2).replace(/\.00$/, '') }]);
    setSelectedAddInvoiceId('');
  };

  const totalAllocated = useMemo(() => {
    return allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
  }, [allocations]);

  const hasExcessAllocation = useMemo(() => {
    return allocations.some(a => Number(a.amount || 0) > a.max_eligible);
  }, [allocations]);

  const handleSave = async () => {
    const validAllocations = allocations
      .filter(a => Number(a.amount || 0) > 0)
      .map(a => ({
        order_id: a.order_id,
        amount: Number(a.amount)
      }));

    if (validAllocations.length === 0) {
      alert('Please specify at least one invoice with an allocated amount greater than ₹0.');
      return;
    }
    if (hasExcessAllocation) {
      alert('One or more allocations exceed the invoice maximum balance due. Please adjust.');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/sales/receipts/${receiptKey}`, {
        payment_date: paymentDate,
        payment_mode: paymentMode,
        notes: notes.trim(),
        allocations: validAllocations,
      });
      onSaved();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update payment receipt');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 780, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', borderRadius: 12 }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>✏️ Edit Payment Receipt</h2>
              {receiptNo && (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: 12 }}>
                  {receiptNo}
                </span>
              )}
            </div>
            {client && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Client: <strong style={{ color: 'var(--text)' }}>{client.name}</strong> {client.city ? `(${client.city})` : ''}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '40px 0' }}>Loading receipt details…</div>
        ) : error ? (
          <div className="alert alert-yellow">
            <div className="a-icon">⚠️</div>
            <div className="a-body">{error}</div>
          </div>
        ) : (
          <>
            {/* Top Form Fields: Date, Mode, Notes */}
            <div className="form-grid">
              <div className="field">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Payment Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="field">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Payment Mode *</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  style={{ fontWeight: 600 }}
                >
                  <option value="upi">📱 UPI / Online</option>
                  <option value="cash">💵 Cash</option>
                  <option value="bank_transfer">🏛️ Bank Transfer / NEFT</option>
                  <option value="cheque">📜 Cheque</option>
                </select>
              </div>

              <div className="field form-full">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Payment Notes / Reference No</label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref / Cheque No / Bank Name / Remarks"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Invoices & Allocations */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text)' }}>
                  Linked Invoices & Payment Allocation
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Adjust amounts applied to invoices
                </span>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ margin: 0, fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 10px' }}>Invoice</th>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Other Paid</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#c0390b' }}>Max Due</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 170 }}>Receipt Allocation (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>
                          No invoices allocated. Add an invoice below.
                        </td>
                      </tr>
                    ) : (
                      allocations.map(a => {
                        const amtNum = Number(a.amount || 0);
                        const isOver = amtNum > a.max_eligible;
                        return (
                          <tr key={a.order_id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--accent)' }}>
                              {a.invoice_number}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
                              {fmtD(a.order_date?.slice(0, 10))}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {fmt(a.order_total)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--muted)' }}>
                              {fmt(a.other_paid)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#c0390b' }}>
                              {fmt(a.max_eligible)}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={a.max_eligible}
                                  step="0.01"
                                  placeholder="0.00"
                                  value={a.amount}
                                  onChange={e => handleAmountChange(a.order_id, e.target.value)}
                                  style={{
                                    width: 95,
                                    padding: '4px 6px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textAlign: 'right',
                                    borderColor: isOver ? 'var(--red)' : '#10b981',
                                    color: isOver ? 'var(--red)' : '#059669',
                                    borderRadius: 6,
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}
                                  onClick={() => handleSetMax(a.order_id)}
                                  title="Set to max due"
                                >
                                  Max
                                </button>
                              </div>
                              {isOver && (
                                <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>
                                  Exceeds due ({fmt(a.max_eligible)})
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--red)', padding: '2px 6px', fontSize: 11 }}
                                onClick={() => handleRemoveInvoice(a.order_id)}
                                title="Remove this invoice from receipt"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add other outstanding invoice if available */}
              {otherInvoices.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={selectedAddInvoiceId}
                    onChange={e => setSelectedAddInvoiceId(e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    <option value="">-- Add another outstanding invoice to this receipt --</option>
                    {otherInvoices.map(o => (
                      <option key={o.order_id} value={o.order_id}>
                        {o.invoice_number} ({fmtD(o.order_date?.slice(0, 10))}) — Balance Due: {fmt(o.max_eligible)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!selectedAddInvoiceId}
                    onClick={handleAddInvoice}
                    style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}
                  >
                    + Add Invoice
                  </button>
                </div>
              )}

              {/* Total Summary Footer */}
              <div style={{ marginTop: 14, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Total Receipt Amount:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: totalAllocated > 0 ? 'var(--green)' : 'var(--text)' }}>
                  {fmt(totalAllocated)}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-ghost" type="button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleSave}
                disabled={saving || totalAllocated <= 0 || hasExcessAllocation}
                style={{
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                }}
              >
                {saving ? 'Saving…' : `Save Changes (${fmt(totalAllocated)})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Clients Tab ───────────────────────────────────────────────────────────────

function ClientsTab() {
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ name: '', phone: '', city: '', address: '' });
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/sales/clients', { params: { all: '1' } })
      .then(r => setClients(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm({ name: '', phone: '', city: '', address: '' }); setEditing(null); setShowAdd(true); };
  const openEdit = c => { setForm({ name: c.name, phone: c.phone || '', city: c.city || '', address: c.address || '' }); setEditing(c); setShowAdd(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.put(`/sales/clients/${editing.id}`, form);
      else         await api.post('/sales/clients', form);
      setShowAdd(false);
      load();
    } finally { setSaving(false); }
  };

  const deactivate = async id => {
    if (!confirm('Deactivate this client? They won\'t appear in new delivery forms.')) return;
    await api.put(`/sales/clients/${id}/deactivate`);
    load();
  };

  const reactivate = async id => {
    await api.put(`/sales/clients/${id}/reactivate`);
    load();
  };

  const active   = clients.filter(c => c.is_active);
  const inactive = clients.filter(c => !c.is_active);

  const ClientRow = ({ c }) => (
    <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.55 }}>
      <td style={{ fontWeight: 600 }}>
        {c.name}
        {!c.is_active && <span className="badge" style={{ fontSize: 10, marginLeft: 6 }}>Inactive</span>}
      </td>
      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{c.city || '—'}</td>
      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{c.phone || '—'}</td>
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          {c.is_active ? (
            <>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(c)}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--orange)' }} onClick={() => deactivate(c.id)}>Deactivate</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--green)' }} onClick={() => reactivate(c.id)}>Reactivate</button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        {inactive.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowInactive(v => !v)}>
            {showInactive ? 'Hide Inactive' : `Show Inactive (${inactive.length})`}
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Client</button>
      </div>

      {loading ? <div className="spinner">Loading…</div> : active.length === 0 && !showInactive ? (
        <div className="card"><div className="empty-state">No active clients. Add your first client.</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ minWidth: 480, margin: 0 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {active.map(c => <ClientRow key={c.id} c={c} />)}
                {showInactive && inactive.map(c => <ClientRow key={c.id} c={c} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Client' : 'Add Client'}</h2>
            <div className="form-grid">
              <div className="field form-full">
                <label>Name *</label>
                <input autoFocus value={form.name} placeholder="e.g. Kalakendra"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && save()} />
              </div>
              <div className="field">
                <label>City</label>
                <input value={form.city} placeholder="e.g. Mangalore"
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} type="tel" placeholder="Mobile / Landline"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="field form-full">
                <label>Address (optional)</label>
                <input value={form.address} placeholder="Street, area…"
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name.trim() || saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
