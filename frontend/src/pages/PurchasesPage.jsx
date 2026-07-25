import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const fmt      = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtRound = n => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN');
const CATEGORIES = ['shawl_nighty', 'ordinary_nighty', 'mixed'];
const CAT_LABEL  = { shawl_nighty: 'Shawl Nighty', ordinary_nighty: 'Ordinary Nighty', mixed: 'Mixed' };
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const PAGE_SIZE = 20;

export default function PurchasesPage() {
  const [rows, setRows]             = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [pages, setPages]           = useState(1);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [vendors, setVendors]       = useState([]);
  const [detail, setDetail]         = useState(null);
  const [showNew, setShowNew]       = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [newVendor, setNewVendor]   = useState('');
  const [showVendorInput, setShowVendorInput] = useState(false);

  const emptyForm = () => ({
    vendor_id: '', purchase_date: new Date().toISOString().slice(0, 10),
    tax_percent: 0, tax_inclusive: false, discount: '', notes: '',
    items: [{ category: 'shawl_nighty', quantity: '', price_per_piece: '' }],
    freight: '', coolie: '',
    has_dispute: false, dispute_amount: '', dispute_description: '',
    advance_paid: '',
  });
  const [form, setForm] = useState(emptyForm());

  const emptyEdit = p => ({
    vendor_id:    String(p.vendor_id),
    purchase_date: (p.invoice_date || '').slice(0, 10),
    tax_percent:  p.tax_rate || 0,
    tax_inclusive: !!p.tax_inclusive,
    discount:     p.discount_pct || '',
    notes:        p.note || '',
    freight:      p.freight ? String(p.freight) : '',
    coolie:       p.coolie ? String(p.coolie) : '',
    advance_paid: p.advance_paid ? String(p.advance_paid) : '',
  });
  const [editForm, setEditForm] = useState({});

  const loadPurchases = useCallback((pg = 1, q = search) => {
    setLoading(true);
    api.get('/purchases', { params: { page: pg, limit: PAGE_SIZE, search: q } })
      .then(r => {
        setRows(r.data.data);
        setTotal(r.data.total);
        setPage(r.data.page);
        setPages(r.data.pages);
      })
      .finally(() => setLoading(false));
  }, [search]);

  const loadVendors = () => api.get('/purchases/vendors').then(r => setVendors(r.data));

  useEffect(() => { loadPurchases(1, ''); loadVendors(); }, []);

  const doSearch = () => { setSearch(searchInput); loadPurchases(1, searchInput); };
  const clearSearch = () => { setSearchInput(''); setSearch(''); loadPurchases(1, ''); };

  const openDetail = async id => {
    const r = await api.get(`/purchases/${id}`);
    setDetail(r.data);
  };

  const openEdit = p => { setEditForm(emptyEdit(p)); setEditTarget(p); };

  const saveEdit = async () => {
    await api.put(`/purchases/${editTarget.id}`, {
      vendor_id:    +editForm.vendor_id,
      invoice_date: editForm.purchase_date,
      tax_rate:     +editForm.tax_percent,
      tax_inclusive: editForm.tax_inclusive,
      discount:     editForm.discount !== '' ? +editForm.discount : 0,
      note:         editForm.notes || null,
      freight:      editForm.freight !== '' ? +editForm.freight : 0,
      coolie:       editForm.coolie  !== '' ? +editForm.coolie  : 0,
      advance_paid: editForm.advance_paid !== '' ? +editForm.advance_paid : 0,
    });
    setEditTarget(null);
    loadPurchases(page);
    if (detail?.purchase?.id === editTarget.id) {
      const r = await api.get(`/purchases/${editTarget.id}`);
      setDetail(r.data);
    }
  };

  const deletePurchase = async id => {
    if (!confirm('Delete this purchase? This cannot be undone.')) return;
    await api.delete(`/purchases/${id}`);
    loadPurchases(page);
    if (detail?.purchase?.id === id) setDetail(null);
  };

  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { category: 'shawl_nighty', quantity: '', price_per_piece: '' }] }));
  const removeItem = i  => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const setItem    = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));

  const submit = async () => {
    await api.post('/purchases', {
      vendor_id:    +form.vendor_id,
      invoice_date: form.purchase_date,
      tax_rate:     +form.tax_percent,
      tax_inclusive: form.tax_inclusive,
      discount:     form.discount !== '' ? +form.discount : 0,
      status:       'paid',
      note:         form.notes || null,
      items: form.items.map(it => ({ category: it.category, quantity: +it.quantity, rate_per_pc: +it.price_per_piece })),
      transport: (form.freight || form.coolie)
        ? { freight: +form.freight || 0, coolie: +form.coolie || 0 }
        : undefined,
      dispute: form.has_dispute && form.dispute_amount
        ? { amount: +form.dispute_amount, description: form.dispute_description || null }
        : undefined,
      advance_paid: form.advance_paid !== '' ? +form.advance_paid : 0,
    });
    setShowNew(false); setForm(emptyForm()); loadPurchases(1, search);
  };

  const addVendor = async () => {
    if (!newVendor.trim()) return;
    const r = await api.post('/purchases/vendors', { name: newVendor.trim() });
    await loadVendors();
    setForm(f => ({ ...f, vendor_id: String(r.data.id) }));
    setNewVendor(''); setShowVendorInput(false);
  };

  const resolveDispute = async (id, status) => {
    await api.put(`/purchases/disputes/${id}`, { status });
    const r = await api.get(`/purchases/${detail.purchase.id}`);
    setDetail(r.data);
  };

  return (
    <>
      {/* Header */}
      <div className="sec-hd mb16">
        <div>
          <div className="sec-title">Vendor Purchases</div>
          <div className="sec-sub">{total} invoice{total !== 1 ? 's' : ''} total</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Purchase</button>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <div className="search-wrap" style={{ width: 340 }}>
          <span className="sw-icon">⌕</span>
          <input
            placeholder="Search by vendor name…"
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); if (e.target.value === '') clearSearch(); }}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
          />
          {searchInput && (
            <button className="sw-clear" onClick={clearSearch}>✕</button>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={doSearch} style={{ height: 38, padding: '0 18px' }}>Search</button>
        {search && (
          <span className="search-tag">
            {search}
            <button onClick={clearSearch}>✕</button>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="spinner">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">{search ? `No purchases matching "${search}".` : 'No purchases yet. Click + New Purchase to add one.'}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Pieces</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
                <th style={{ textAlign: 'right' }}>Discount</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>GST</th>
                <th>Dispute</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.vendor_name}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDate(p.invoice_date)}</td>
                  <td style={{ textAlign: 'right' }}>{p.total_pieces}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(p.subtotal)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--green)' }}>
                    {Number(p.discount_pct) > 0 ? `${p.discount_pct}%` : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmtRound(p.total)}
                    {Number(p.advance_paid) > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>
                        Adv: {fmt(p.advance_paid)}
                      </div>
                    )}
                  </td>
                  <td>
                    {p.tax_rate > 0
                      ? <span className="badge b-accent" style={{ fontSize: 10 }}>{p.tax_rate}%</span>
                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    {!!p.has_dispute
                      ? <span style={{ color: 'var(--orange, #f97316)', fontWeight: 700, fontSize: 13 }}>⚠ {fmt(p.dispute_amount)}</span>
                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => openDetail(p.id)}>View</button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-red btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => deletePurchase(p.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>
              Page {page} of {pages} · {total} records
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1}
                onClick={() => loadPurchases(1, search)}>«</button>
              <button className="btn btn-ghost btn-sm" disabled={page === 1}
                onClick={() => loadPurchases(page - 1, search)}>‹ Prev</button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, pages - 4));
                return start + i;
              }).map(p => (
                <button key={p} onClick={() => loadPurchases(p, search)} style={{
                  width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: page === p ? 'var(--accent)' : 'var(--light)',
                  color: page === p ? '#fff' : 'var(--muted)',
                }}>{p}</button>
              ))}
              <button className="btn btn-ghost btn-sm" disabled={page === pages}
                onClick={() => loadPurchases(page + 1, search)}>Next ›</button>
              <button className="btn btn-ghost btn-sm" disabled={page === pages}
                onClick={() => loadPurchases(pages, search)}>»</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ width: 640, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>🏪 {detail.purchase?.vendor_name}</h2>
              <span className="badge b-green">✓ Paid</span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              {fmtDate(detail.purchase?.invoice_date)}
              {detail.purchase?.note ? ` · ${detail.purchase.note}` : ''}
            </div>

            <div className="calc-box" style={{ marginBottom: 16 }}>
              <div className="calc-row">
                <span className="cl">Subtotal</span>
                <span className="cv">{fmt(detail.purchase?.subtotal)}</span>
              </div>
              {Number(detail.purchase?.discount) > 0 && (
                <div className="calc-row">
                  <span className="cl" style={{ color: 'var(--green)' }}>Discount ({detail.purchase.discount_pct}%)</span>
                  <span className="cv" style={{ color: 'var(--green)' }}>−{fmt(detail.purchase.discount)}</span>
                </div>
              )}
              {Number(detail.purchase?.tax_amount) > 0 && (
                <div className="calc-row">
                  <span className="cl">GST ({detail.purchase?.tax_rate}%){detail.purchase?.tax_inclusive ? ' (inclusive)' : ''}</span>
                  <span className="cv">{fmt(detail.purchase?.tax_amount)}</span>
                </div>
              )}
              {detail.transport && (Number(detail.transport.freight) > 0 || Number(detail.transport.coolie) > 0) && (
                <>
                  <div className="calc-row">
                    <span className="cl">Freight</span>
                    <span className="cv">{fmt(detail.transport.freight)}</span>
                  </div>
                  <div className="calc-row">
                    <span className="cl">Coolie / Labour</span>
                    <span className="cv">{fmt(detail.transport.coolie)}</span>
                  </div>
                </>
              )}
              <hr className="calc-divider" />
              <div className="calc-row">
                <span className="cl" style={{ fontWeight: 700, fontSize: 14 }}>Grand Total</span>
                <span className="cv" style={{ fontSize: 16, fontWeight: 800, color: 'var(--red)' }}>{fmtRound(detail.purchase?.total)}</span>
              </div>
              {Number(detail.purchase?.advance_paid) > 0 && (
                <>
                  <div className="calc-row" style={{ marginTop: 6 }}>
                    <span className="cl" style={{ color: 'var(--blue, #2563eb)' }}>Advance Paid</span>
                    <span className="cv" style={{ color: 'var(--blue, #2563eb)', fontWeight: 600 }}>{fmt(detail.purchase.advance_paid)}</span>
                  </div>
                  <div className="calc-row" style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                    <span className="cl">Balance Due</span>
                    <span className="cv" style={{ color: 'var(--red, #ef4444)' }}>
                      {fmtRound(Number(detail.purchase.total) - Number(detail.purchase.advance_paid))}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              Line Items
            </div>
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr><th>Category</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate/pc</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
              </thead>
              <tbody>
                {detail.items?.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--muted)', textAlign: 'center' }}>No items found.</td></tr>
                )}
                {detail.items?.map((it, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{CAT_LABEL[it.category] || it.category}</td>
                    <td style={{ textAlign: 'right' }}>{it.quantity} pcs</td>
                    <td style={{ textAlign: 'right' }}>{fmt(it.rate_per_pc)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {detail.disputes?.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Disputes</div>
                {detail.disputes.map(d => (
                  <div key={d.id} className="dispute-note" style={{ marginBottom: 8 }}>
                    <div className="dn-icon">⚠️</div>
                    <div style={{ flex: 1 }}>
                      <div className="dn-text">{fmt(d.amount)} — {d.description || 'No description'}</div>
                      <div className="dn-sub">Status: <b>{d.status.replace(/_/g, ' ')}</b></div>
                    </div>
                    {d.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => resolveDispute(d.id, 'resolved')}>Resolve</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--orange)' }} onClick={() => resolveDispute(d.id, 'adjusted_in_next_bill')}>Adjust Next</button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => openEdit(detail.purchase)}>✏️ Edit</button>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal" style={{ width: 500 }} onClick={e => e.stopPropagation()}>
            <h2>Edit Purchase</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              Line items cannot be changed after saving (they affect stock). Edit header fields below.
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Vendor</label>
                <select value={editForm.vendor_id} onChange={e => setEditForm(f => ({ ...f, vendor_id: e.target.value }))}>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={editForm.purchase_date} onChange={e => setEditForm(f => ({ ...f, purchase_date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Discount (%)</label>
                <input type="number" step="0.01" placeholder="0" min="0" max="100" value={editForm.discount} onChange={e => setEditForm(f => ({ ...f, discount: e.target.value }))} />
              </div>
              <div className="field">
                <label>Tax %</label>
                <input type="number" step="0.01" value={editForm.tax_percent} onChange={e => setEditForm(f => ({ ...f, tax_percent: e.target.value }))} />
              </div>
              <div className="field form-full">
                <label>Note</label>
                <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="field">
                <label>Freight (₹)</label>
                <input type="number" placeholder="Leave blank to keep existing" value={editForm.freight} onChange={e => setEditForm(f => ({ ...f, freight: e.target.value }))} />
              </div>
              <div className="field">
                <label>Coolie (₹)</label>
                <input type="number" placeholder="Leave blank to keep existing" value={editForm.coolie} onChange={e => setEditForm(f => ({ ...f, coolie: e.target.value }))} />
              </div>
              <div className="field">
                <label>Advance Paid (₹)</label>
                <input type="number" placeholder="0" value={editForm.advance_paid} onChange={e => setEditForm(f => ({ ...f, advance_paid: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Purchase modal ── */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 660, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>New Purchase</h2>
            <div className="form-grid">
              <div className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Vendor
                  <a style={{ fontSize: 11, cursor: 'pointer' }} onClick={() => setShowVendorInput(v => !v)}>
                    {showVendorInput ? '← Back to list' : '+ New Vendor'}
                  </a>
                </label>
                {showVendorInput ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input placeholder="Vendor name" value={newVendor} onChange={e => setNewVendor(e.target.value)} autoFocus
                      onKeyDown={e => e.key === 'Enter' && addVendor()} />
                    <button className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={addVendor}>Add</button>
                  </div>
                ) : (
                  <select value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}>
                    <option value="">Select vendor…</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                )}
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
              </div>
              <div className="field form-full">
                <label>Note (optional)</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Batch for June production" />
              </div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>
              Line Items
            </div>
            {form.items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                <div className="field" style={{ margin: 0 }}>
                  {i === 0 && <label>Category</label>}
                  <select value={it.category} onChange={e => setItem(i, 'category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  {i === 0 && <label>Qty (pcs)</label>}
                  <input type="number" placeholder="0" value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  {i === 0 && <label>Rate / pc (₹)</label>}
                  <input type="number" placeholder="0" value={it.price_per_piece} onChange={e => setItem(i, 'price_per_piece', e.target.value)} />
                </div>
                <button className="btn btn-red btn-sm" onClick={() => removeItem(i)} disabled={form.items.length === 1}>✕</button>
              </div>
            ))}

            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={addItem}>+ Add Item</button>

            <div className="form-grid">
              <div className="field">
                <label>Discount (%)</label>
                <input type="number" step="0.01" placeholder="0" min="0" max="100" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
              </div>
              <div className="field">
                <label>Tax %</label>
                <input type="number" step="0.01" placeholder="0" value={form.tax_percent} onChange={e => setForm(f => ({ ...f, tax_percent: e.target.value }))} />
              </div>
              <div className="field">
                <label>Freight (₹)</label>
                <input type="number" placeholder="0" value={form.freight} onChange={e => setForm(f => ({ ...f, freight: e.target.value }))} />
              </div>
              <div className="field">
                <label>Coolie / Labour (₹)</label>
                <input type="number" placeholder="0" value={form.coolie} onChange={e => setForm(f => ({ ...f, coolie: e.target.value }))} />
              </div>
              <div className="field">
                <label>Advance Paid (₹)</label>
                <input type="number" placeholder="0" value={form.advance_paid} onChange={e => setForm(f => ({ ...f, advance_paid: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 0 0' }}>
              <input type="checkbox" id="chk-tax-inclusive" checked={form.tax_inclusive}
                onChange={e => setForm(f => ({ ...f, tax_inclusive: e.target.checked }))}
                style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              <label htmlFor="chk-tax-inclusive" style={{ margin: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'none', letterSpacing: 0, color: 'var(--text)' }}>
                Item rates are tax-inclusive (GST is already included in rates)
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
              <input type="checkbox" id="chk-dispute" checked={form.has_dispute}
                onChange={e => setForm(f => ({ ...f, has_dispute: e.target.checked }))}
                style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              <label htmlFor="chk-dispute" style={{ margin: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'none', letterSpacing: 0, color: 'var(--text)' }}>
                Record a vendor dispute
              </label>
            </div>
            {form.has_dispute && (
              <div className="form-grid">
                <div className="field">
                  <label>Dispute Amount (₹)</label>
                  <input type="number" value={form.dispute_amount} onChange={e => setForm(f => ({ ...f, dispute_amount: e.target.value }))} />
                </div>
                <div className="field form-full">
                  <label>Description</label>
                  <input value={form.dispute_description} onChange={e => setForm(f => ({ ...f, dispute_description: e.target.value }))} />
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowNew(false); setForm(emptyForm()); setShowVendorInput(false); }}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={!form.vendor_id || !form.items[0].quantity}>Save Purchase</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
