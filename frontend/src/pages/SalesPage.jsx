import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api/client';

const DEFAULT_CAT_LABEL = {
  shawl_nighty: 'Shawl Nighty',
  ordinary_nighty: 'Ordinary Nighty',
  shawl_nighty_lace: 'Shawl Nighty + Lace'
};
const getProductLabel = cat => DEFAULT_CAT_LABEL[cat] || cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

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
        {[['orders','🚚 Deliveries'], ['clients','👥 Clients']].map(([t, label]) => (
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
      {tab === 'orders'  && <OrdersTab key={refresh} onReload={reload} />}
      {tab === 'clients' && <ClientsTab key={refresh} />}
    </>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab({ onReload }) {
  const [orders, setOrders]   = useState([]);
  const [summary, setSummary] = useState(null);
  const [nightiesData, setNightiesData] = useState({ shawl_nighty: 0, shawl_nighty_lace: 0, ordinary_nighty: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [invoice, setInvoice] = useState(null);

  const load = () => {
    setLoading(true);
    const params = filter !== 'all' ? { status: filter } : {};
    Promise.all([
      api.get('/sales', { params }),
      api.get('/sales/summary'),
      api.get('/sales/nighties-summary'),
    ]).then(([o, s, n]) => {
      setOrders(o.data);
      setSummary(s.data);
      setNightiesData(n.data);
    })
      .finally(() => setLoading(false));
  };


  useEffect(() => { load(); }, [filter]);

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

  const recordPayment = async (id, amount, date) => {
    await api.post(`/sales/${id}/payment`, { amount, payment_date: date });
    setPayModal(null);
    setReceiptModal(id);
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
      {/* Nighties Sold Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <SummaryChip label="Shawl Nighty" value={nightiesData.shawl_nighty} color="var(--accent)" />
        <SummaryChip label="Shawl Nighty + Lace" value={nightiesData.shawl_nighty_lace} color="var(--cyan)" />
        <SummaryChip label="Ordinary Nighty" value={nightiesData.ordinary_nighty} color="var(--green)" />
        <SummaryChip label="Total Nighties" value={nightiesData.total} color="var(--accent)" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3 }}>
          {[['all','All'],['pending','Outstanding'],['paid','Paid']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                borderRadius: 6, background: filter === v ? 'var(--white)' : 'transparent',
                color: filter === v ? 'var(--text)' : 'var(--muted)',
                boxShadow: filter === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowNew(true)}>
          + New Delivery
        </button>
      </div>

      {/* Table */}
      {loading ? <div className="spinner">Loading…</div> : orders.length === 0 ? (
        <div className="card"><div className="empty-state">No deliveries found.</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
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
                const gst        = o.include_gst ? subtotal * (+o.gst_percent / 100) : 0;
                const total      = subtotal + gst;
                const amtPaid    = +o.amount_paid || 0;
                const balance    = total - amtPaid;
                const isPartial  = o.status === 'partial';
                const isPending  = o.status === 'pending';
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>{o.invoice_number}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtD(o.order_date)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.client_name}</div>
                      {o.client_city && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.client_city}</div>}
                      {Number(o.client_total_outstanding) > 0 && (
                        <div style={{ fontSize: 10, color: '#c0390b', fontWeight: 700, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fff0f0', padding: '2px 6px', borderRadius: 4, border: '1px solid #f5e8e8' }}>
                          <span>⚠ Total Due: {fmt(o.client_total_outstanding)}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>{o.item_count} item{o.item_count !== 1 ? 's' : ''}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{fmt(total)}</div>
                      {isPartial && (
                        <div style={{ fontSize: 11, color: 'var(--orange)' }}>
                          Bal: {fmt(balance)}
                        </div>
                      )}
                    </td>
                    <td>
                      {o.status === 'paid'
                        ? <span className="badge b-green"  style={{ fontSize: 10 }}>✓ Paid</span>
                        : isPartial
                        ? <span className="badge b-accent" style={{ fontSize: 10 }}>◑ Partial</span>
                        : <span className="badge b-yellow" style={{ fontSize: 10 }}>⏳ Pending</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openInvoice(o)}>
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
  const [includeGst, setIncludeGst] = useState(order ? !!order.include_gst : false);
  const [gstPct, setGstPct]     = useState(order ? String(Number(order.gst_percent)) : '5');
  const [items, setItems]       = useState(order && order.items ? order.items : [{ category: 'shawl_nighty', quantity: '', rate_per_pc: '' }]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/sales/clients').then(r => setClients(r.data)),
      api.get('/production/configs').then(r => setProducts(r.data))
    ]).catch(() => {});
  }, []);

  const addItem  = () => {
    const firstProduct = products[0]?.category || 'shawl_nighty';
    setItems(prev => [...prev, { category: firstProduct, quantity: '', rate_per_pc: '' }]);
  };
  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i));
  const setItem  = (i, field, val) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const createClientInline = async () => {
    if (!newClientName.trim()) return;
    const r = await api.post('/sales/clients', { name: newClientName.trim(), city: newClientCity.trim(), phone: newClientPhone.trim() });
    setClients(prev => [...prev, r.data].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(String(r.data.id));
    setShowNewClient(false);
    setNewClientName(''); setNewClientCity(''); setNewClientPhone('');
  };

  const subtotal = items.reduce((s, it) => s + (+it.quantity || 0) * (+it.rate_per_pc || 0), 0);
  const gstAmt   = includeGst ? subtotal * (+gstPct / 100) : 0;
  const total    = subtotal + gstAmt;

  const save = async () => {
    if (!clientId || !date) return;
    const validItems = items.filter(it => it.quantity && it.rate_per_pc);
    if (!validItems.length) return;
    setSaving(true);
    try {
      const payload = {
        client_id: +clientId, order_date: date, notes,
        include_gst: includeGst, gst_percent: includeGst ? +gstPct : 0,
        items: validItems.map(it => ({ category: it.category, quantity: +it.quantity, rate_per_pc: +it.rate_per_pc })),
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

          <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 120px 110px 32px',
              background: 'var(--surface)', padding: '8px 12px', gap: 8,
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted)',
            }}>
              <div>Category</div>
              <div style={{ textAlign: 'right' }}>Qty (pcs)</div>
              <div style={{ textAlign: 'right' }}>Rate / pc (₹)</div>
              <div style={{ textAlign: 'right' }}>Amount</div>
              <div></div>
            </div>

            {items.map((it, i) => {
              const amt = (+it.quantity || 0) * (+it.rate_per_pc || 0);
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 120px 110px 32px',
                  padding: '10px 12px', gap: 8, alignItems: 'center',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  background: '#fff',
                }}>
                  <select value={it.category} onChange={e => setItem(i, 'category', e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13, width: '100%' }}>
                    {products.map(p => <option key={p.category} value={p.category}>{getProductLabel(p.category)}</option>)}
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
        </div>

        {/* GST */}
        <div style={{ marginTop: 16, padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: includeGst ? 10 : 0 }}>
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

        {/* Totals */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Subtotal: <b style={{ color: 'var(--text)' }}>{fmt(subtotal)}</b></div>
          {includeGst && <div style={{ fontSize: 13, color: 'var(--muted)' }}>GST ({gstPct}%): <b style={{ color: 'var(--text)' }}>{fmt(gstAmt)}</b></div>}
          <div style={{ fontSize: 16, fontWeight: 800 }}>Total: {fmt(total)}</div>
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
  const [saving, setSaving] = useState(false);
  const amt     = Number(amount);
  const isOver  = amt > balance;
  const isFull  = amt > 0 && Math.abs(amt - balance) < 0.01;

  const save = async () => {
    if (!amt || amt <= 0 || isOver) return;
    setSaving(true);
    try { await onSave(id, amt, date); } finally { setSaving(false); }
  };

  const r = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
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
          <label>Payment Date</label>
          <input type="date" value={date} onChange={setDate ? e => setDate(e.target.value) : undefined} />
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

function PaymentReceiptModal({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    api.get(`/sales/${orderId}`).then(r => setOrder(r.data));
  }, [orderId]);

  if (!order) return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 320, textAlign: 'center', padding: 40 }}>
        <div className="spinner">Loading…</div>
      </div>
    </div>
  );

  const subtotal   = order.items?.reduce((s, it) => s + it.quantity * it.rate_per_pc, 0) || 0;
  const gstAmt     = order.include_gst ? subtotal * (order.gst_percent / 100) : 0;
  const total      = subtotal + gstAmt;
  const amtPaid    = Number(order.amount_paid || 0);
  const balance    = total - amtPaid;
  const isFull     = order.status === 'paid';
  const otherPending = (order.other_outstanding || []).map(o => ({
    ...o,
    total: Number(o.total),
    amount_paid: Number(o.amount_paid || 0),
    balance: Number(o.total) - Number(o.amount_paid || 0),
  }));
  const m         = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const today     = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const receiptNo = `RCP-${order.invoice_number}`;

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
    .totals-box { min-width:260px; }
    .t-row { display:flex; justify-content:space-between; padding:5px 0; font-size:13px; color:#555; border-bottom:1px solid #f5f0e8; }
    .t-row.inv-total { font-size:13px; font-weight:700; color:#1a1a1a; border-bottom:none; padding-top:8px; }
    .t-row.received  { font-size:16px; font-weight:600; color:#1a1a1a; border-top:2px solid #1a1a1a; border-bottom:none; padding-top:10px; margin-top:4px; }
    .t-row.balance   { font-size:16px; font-weight:600; color:#1a1a1a; border-bottom:none; padding-top:4px; }
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
      <div className="modal" style={{ width: 680, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Payment Receipt</h2>
          <button className="btn btn-primary btn-sm" onClick={print}>🖨 Print / Share</button>
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
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>RECEIPT</div>
              <div style={{ fontSize: 12, color: '#C8860A', fontWeight: 700, marginTop: 4 }}>{receiptNo}</div>
              <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>Date: {today}</div>
            </div>
          </div>

          {/* From / To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', margin: '0 36px', borderBottom: '1px solid #f0e8d0' }}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: '#C8860A', marginBottom: 6 }}>From</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Viva Studio</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>Garment Manufacturing</div>
            </div>
            <div style={{ padding: '16px 0 16px 24px', borderLeft: '1px solid #f0e8d0' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: '#C8860A', marginBottom: 6 }}>Received From</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{order.client_name}</div>
              {order.client_city  && <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{order.client_city}</div>}
              {order.client_phone && <div style={{ fontSize: 12, color: '#777' }}>{order.client_phone}</div>}
            </div>
          </div>

          {/* Items table */}
          <div style={{ padding: '20px 36px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #C8860A' }}>
                  {[['#','auto'],['Description',''],['Qty','right'],['Rate / pc','right'],['Amount','right']].map(([h, align]) => (
                    <th key={h} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#C8860A', textAlign: align === 'right' ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items?.map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f5f0e8', background: i % 2 === 1 ? '#fdfaf4' : '#fff' }}>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#bbb' }}>{i + 1}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 600 }}>{getProductLabel(it.category)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>{it.quantity} pcs</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>{m(it.rate_per_pc)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{m(it.quantity * it.rate_per_pc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 36px 0' }}>
            <div style={{ minWidth: 260 }}>
              {!!order.include_gst && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#666', borderBottom: '1px solid #f5f0e8' }}>
                  <span>Subtotal</span><span>{m(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#666', borderBottom: '1px solid #f5f0e8' }}>
                  <span>GST ({order.gst_percent}%)</span><span>{m(gstAmt)}</span>
                </div>
              </>}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, fontWeight: 700, color: '#1a1a1a', borderBottom: '1px solid #f5f0e8' }}>
                <span>Invoice Total</span><span>{m(total)}</span>
              </div>
              {order.payments && order.payments.length > 0 && (
                <div style={{ borderTop: '1px dashed #f0e8d0', padding: '8px 0 4px', fontSize: 12, color: '#555', marginTop: 6 }}>
                  <div style={{ fontWeight: 700, color: '#C8860A', marginBottom: 4, textTransform: 'uppercase', fontSize: 10, letterSpacing: '.04em' }}>Payment History</div>
                  {order.payments.map((p, idx) => {
                    const isLatest = idx === order.payments.length - 1;
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontWeight: isLatest && balance > 0 ? 700 : 400, color: isLatest && balance > 0 ? '#1a1a1a' : '#666' }}>
                        <span>
                          {fmtD(p.payment_date)} {isLatest && balance > 0 && <span style={{ fontSize: 9, color: '#065f46', background: '#d1fae5', padding: '1px 4px', borderRadius: 3, marginLeft: 4 }}>Latest</span>}
                        </span>
                        <span>{m(p.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {balance > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', fontSize: 15, fontWeight: 600, color: '#1a1a1a', borderTop: '1.5px solid #1a1a1a', marginTop: 4 }}>
                    <span>Total Paid</span>
                    <span>{m(amtPaid)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 0', fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>
                    <span>Balance Due</span>
                    <span style={{ color: '#c0390b' }}>{m(balance)}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 5px', fontSize: 16, fontWeight: 600, color: '#1a1a1a', borderTop: '2px solid #1a1a1a', marginTop: 4 }}>
                  <span>Amount Received</span><span>{m(amtPaid)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status note */}
          <div style={{ margin: '16px 36px 0', padding: '9px 14px', background: '#fdfaf4', borderLeft: '3px solid #C8860A', borderRadius: '0 5px 5px 0', fontSize: 12, color: '#555' }}>
            <b style={{ color: '#1a1a1a' }}>Payment Status:</b> {isFull ? 'Paid in Full' : 'Partial Payment Received — balance outstanding'}
          </div>

          {/* Other pending invoices */}
          {otherPending.length > 0 && (
            <div style={{ margin: '16px 36px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#c0390b', marginBottom: 8 }}>
                ⚠ Other Outstanding Invoices
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #c0390b' }}>
                    {[['Invoice',''],['Date',''],['Invoice Total','right'],['Received','right'],['Balance Due','right']].map(([h, a]) => (
                      <th key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#c0390b', textAlign: a || 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {otherPending.map((o, i) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f5e8e8', background: i % 2 === 1 ? '#fff8f8' : '#fff' }}>
                      <td style={{ padding: '7px 8px', fontWeight: 700, color: '#c0390b' }}>{o.invoice_number}</td>
                      <td style={{ padding: '7px 8px', color: '#777' }}>{fmtD(o.order_date)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>{m(o.total)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: '#555' }}>{m(o.amount_paid)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#c0390b' }}>{m(o.balance)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1.5px solid #c0390b' }}>
                    <td colSpan={4} style={{ padding: '7px 8px', fontWeight: 800, textAlign: 'right', color: '#c0390b' }}>Total Outstanding (Other Invoices)</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 900, color: '#c0390b', fontSize: 13 }}>
                      {m(otherPending.reduce((s, o) => s + o.balance, 0))}
                    </td>
                  </tr>
                  <tr style={{ borderTop: '2.5px double #c0390b', background: '#fff0f0' }}>
                    <td colSpan={4} style={{ padding: '9px 8px', fontWeight: 900, textAlign: 'right', color: '#c0390b', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Balance Due (All Invoices)</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 900, color: '#c0390b', fontSize: 14 }}>
                      {m(balance + otherPending.reduce((s, o) => s + o.balance, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ margin: '18px 36px 0', padding: '12px 0 24px', borderTop: '1px solid #f0e8d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>Thank you for your business!</div>
            <div style={{ fontSize: 11, color: '#C8860A', fontWeight: 700, letterSpacing: '.06em' }}>VIVA STUDIO</div>
          </div>

        </div>

        <div className="modal-actions">
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
  const gstAmt       = order.include_gst ? subtotal * (order.gst_percent / 100) : 0;
  const total        = subtotal + gstAmt;
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
                    <td style={{ padding: '11px 10px', fontWeight: 600, fontSize: 13 }}>{getProductLabel(it.category)}</td>
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
          <table>
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
