import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function PurchasesPage() {
  const { user } = useAuth();
  const currency = user?.currency || '₹';
  const fmt      = n => `${currency} ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtRound = n => `${currency} ${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
  const DEFAULT_CAT_LABEL = { shawl_nighty: 'Shawl Nighty', ordinary_nighty: 'Ordinary Nighty', mixed: 'Mixed Goods / Advance' };
  const getProductLabel = cat => DEFAULT_CAT_LABEL[cat] || (cat ? cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Item');
  const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const PAGE_SIZE = 20;

  const [rows, setRows]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [vendors, setVendors]         = useState([]);
  const [products, setProducts]       = useState([]);
  const [detail, setDetail]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState(null);

  // View state: 'list' | 'new' | 'edit'
  const [viewMode, setViewMode]       = useState('list');
  const [editTarget, setEditTarget]   = useState(null);

  // Quick Vendor Add
  const [newVendor, setNewVendor]     = useState('');
  const [showVendorInput, setShowVendorInput] = useState(false);

  const emptyForm = () => ({
    vendor_id: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    tax_percent: user?.country === 'SA' ? 15 : 0,
    tax_inclusive: false,
    discount: '',
    notes: '',
    items: [{ category: 'mixed', quantity: '', price_per_piece: '' }],
    freight: '',
    coolie: '',
    has_dispute: false,
    dispute_amount: '',
    dispute_description: '',
    advance_paid: '',
  });

  const [form, setForm] = useState(emptyForm());

  const loadPurchases = useCallback((pg = 1, q = search) => {
    setLoading(true);
    api.get('/purchases', { params: { page: pg, limit: PAGE_SIZE, search: q } })
      .then(r => {
        setRows(r.data.data || []);
        setTotal(r.data.total || 0);
        setPage(r.data.page || 1);
        setPages(r.data.pages || 1);
      })
      .finally(() => setLoading(false));
  }, [search]);

  const loadVendors = () => api.get('/purchases/vendors').then(r => setVendors(r.data || []));
  const loadProducts = () => {
    Promise.all([
      api.get('/items?all=1').catch(() => ({ data: [] })),
      api.get('/production/configs').catch(() => ({ data: [] }))
    ]).then(([itemsRes, configsRes]) => {
      const combined = [...(itemsRes.data || []), ...(configsRes.data || [])];
      const seen = new Set();
      const unique = [];
      for (const p of combined) {
        const cat = p.category || p.id;
        if (!seen.has(cat)) {
          seen.add(cat);
          unique.push({ category: p.category, name: p.name || p.display_name });
        }
      }
      setProducts(unique);
    });
  };

  useEffect(() => {
    loadPurchases(1, '');
    loadVendors();
    loadProducts();
  }, []);

  const doSearch = () => { setSearch(searchInput); loadPurchases(1, searchInput); };
  const clearSearch = () => { setSearchInput(''); setSearch(''); loadPurchases(1, ''); };

  const openNewPurchase = () => {
    setForm(emptyForm());
    setViewMode('new');
    setEditTarget(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openDetail = async id => {
    try {
      const r = await api.get(`/purchases/${id}`);
      setDetail(r.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openEditPurchase = async p => {
    let items = [];
    try {
      const r = await api.get(`/purchases/${p.id}`);
      items = r.data.items || [];
    } catch (err) {
      console.error('Failed to load purchase items', err);
    }

    setForm({
      vendor_id: String(p.vendor_id),
      purchase_date: (p.invoice_date || '').slice(0, 10),
      tax_percent: p.tax_rate || 0,
      tax_inclusive: !!p.tax_inclusive,
      discount: p.discount ? String(Number(p.discount)) : '',
      notes: p.note || '',
      freight: p.freight ? String(p.freight) : '',
      coolie: p.coolie ? String(p.coolie) : '',
      advance_paid: p.advance_paid ? String(p.advance_paid) : '',
      has_dispute: false,
      dispute_amount: '',
      dispute_description: '',
      items: items.length > 0
        ? items.map(it => ({ category: it.category, quantity: String(it.quantity || ''), price_per_piece: String(it.rate_per_pc || '') }))
        : [{ category: 'mixed', quantity: '', price_per_piece: '' }],
    });
    setEditTarget(p);
    setViewMode('edit');
    if (detail) setDetail(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { category: 'mixed', quantity: '', price_per_piece: '' }] }));
  const removeItem = i  => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const setItem    = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));

  // Form calculations
  const advancePaidNum = parseFloat(form.advance_paid) || 0;
  const isAdvanceEntry = advancePaidNum > 0;

  const rawSubtotal = form.items.reduce((sum, it) => {
    const q = parseFloat(it.quantity) || 0;
    const r = parseFloat(it.price_per_piece) || 0;
    return sum + (q * r);
  }, 0);

  const discountNum = parseFloat(form.discount) || 0;
  const taxRateNum = parseFloat(form.tax_percent) || 0;
  const freightNum = parseFloat(form.freight) || 0;
  const coolieNum = parseFloat(form.coolie) || 0;

  const effectiveSubtotal = form.tax_inclusive && taxRateNum > 0
    ? parseFloat((rawSubtotal / (1 + taxRateNum / 100)).toFixed(2))
    : rawSubtotal;

  const taxAmountNum = taxRateNum > 0
    ? parseFloat(((Math.max(0, effectiveSubtotal - discountNum) * taxRateNum) / 100).toFixed(2))
    : 0;

  const calculatedGrandTotal = parseFloat((effectiveSubtotal - discountNum + taxAmountNum + freightNum + coolieNum).toFixed(2));
  const grandTotal = calculatedGrandTotal > 0 ? calculatedGrandTotal : (advancePaidNum > 0 ? advancePaidNum : 0);
  const balanceDue = Math.max(0, grandTotal - advancePaidNum);

  const handleSavePurchase = async (e) => {
    if (e) e.preventDefault();
    if (!form.vendor_id) {
      alert('Please select a vendor.');
      return;
    }

    const hasValidItems = form.items.some(it => parseFloat(it.quantity) > 0 && parseFloat(it.price_per_piece) > 0);

    // If no advance paid and no items entered, require at least 1 item
    if (!isAdvanceEntry && !hasValidItems) {
      alert('Please enter at least one item with Quantity and Rate, or enter an Advance Paid amount.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vendor_id:    +form.vendor_id,
        invoice_date: form.purchase_date,
        tax_rate:     +form.tax_percent,
        tax_inclusive: form.tax_inclusive,
        discount:     discountNum,
        status:       advancePaidNum >= grandTotal ? 'paid' : (advancePaidNum > 0 ? 'partial' : 'paid'),
        note:         form.notes || null,
        advance_paid: advancePaidNum,
        items: form.items
          .filter(it => (parseFloat(it.quantity) > 0 && parseFloat(it.price_per_piece) > 0) || it.category)
          .map(it => ({
            category: it.category,
            quantity: parseFloat(it.quantity) || 0,
            rate_per_pc: parseFloat(it.price_per_piece) || 0,
            amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.price_per_piece) || 0)
          })),
        transport: (form.freight || form.coolie)
          ? { freight: freightNum, coolie: coolieNum }
          : undefined,
        dispute: form.has_dispute && form.dispute_amount
          ? { amount: +form.dispute_amount, description: form.dispute_description || null }
          : undefined,
      };

      if (viewMode === 'edit' && editTarget) {
        await api.put(`/purchases/${editTarget.id}`, payload);
        setMsg({ type: 'success', text: 'Purchase invoice updated successfully.' });
      } else {
        await api.post('/purchases', payload);
        setMsg({ type: 'success', text: isAdvanceEntry ? 'Advance payment & purchase entry recorded.' : 'Purchase entry created successfully.' });
      }

      setViewMode('list');
      setForm(emptyForm());
      loadPurchases(1, search);
      setTimeout(() => setMsg(null), 3500);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to save purchase.');
    } finally {
      setSaving(false);
    }
  };

  const addVendor = async () => {
    if (!newVendor.trim()) return;
    try {
      const r = await api.post('/purchases/vendors', { name: newVendor.trim() });
      await loadVendors();
      setForm(f => ({ ...f, vendor_id: String(r.data.id) }));
      setNewVendor('');
      setShowVendorInput(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add vendor.');
    }
  };

  const deletePurchase = async id => {
    if (!confirm('Delete this purchase? This cannot be undone.')) return;
    try {
      await api.delete(`/purchases/${id}`);
      loadPurchases(page);
      if (detail?.purchase?.id === id) setDetail(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete purchase.');
    }
  };

  const resolveDispute = async (id, status) => {
    await api.put(`/purchases/disputes/${id}`, { status });
    const r = await api.get(`/purchases/${detail.purchase.id}`);
    setDetail(r.data);
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
    letterSpacing: '0.2px',
    marginBottom: '6px',
  };

  // ═══════════════════════════════════════════════════════════════
  // VIEW 1: FULL-PAGE NEW / EDIT PURCHASE ENTRY
  // ═══════════════════════════════════════════════════════════════
  if (viewMode === 'new' || viewMode === 'edit') {
    return (
      <div style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 50 }}>
        {/* Top Header Command Bar */}
        <div style={{
          background: 'var(--white)',
          padding: '16px 22px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span>←</span> Purchases
            </button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {viewMode === 'edit' ? `Edit Purchase Invoice #${editTarget?.id}` : 'New Purchase / Advance Entry'}
              </h1>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Record vendor supplier invoices, inventory arrivals, or advance payments
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--muted)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSavePurchase}
              disabled={saving}
              style={{
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 22px',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
              }}
            >
              {saving ? 'Saving Entry...' : (viewMode === 'edit' ? '✓ Save Changes' : '✓ Save Purchase')}
            </button>
          </div>
        </div>

        {/* Full-Page Form Grid */}
        <form onSubmit={handleSavePurchase}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.9fr) minmax(0, 1.1fr)', gap: 20, alignItems: 'start' }}>
            {/* LEFT COLUMN: VENDOR & ITEMS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              {/* Card 1: Vendor & Date Details */}
              <div style={{
                background: 'var(--white)',
                padding: 22,
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                  1. Vendor &amp; Invoice Metadata
                </div>

                <div className="g2 mb14">
                  {/* Vendor Selector with Quick Add */}
                  <div className="field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ ...labelStyle, margin: 0 }}>
                        Vendor / Supplier <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowVendorInput(!showVendorInput)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {showVendorInput ? 'Select Existing' : '+ New Vendor'}
                      </button>
                    </div>

                    {showVendorInput ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Vendor Name"
                          value={newVendor}
                          onChange={e => setNewVendor(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', borderRadius: 6 }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={addVendor}
                          style={{
                            background: 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0 12px',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer'
                          }}
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <select
                        value={form.vendor_id}
                        onChange={e => setForm({ ...form, vendor_id: e.target.value })}
                        required
                        style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                      >
                        <option value="">— Select Vendor —</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Purchase Date */}
                  <div className="field">
                    <label style={labelStyle}>Invoice / Payment Date</label>
                    <input
                      type="date"
                      value={form.purchase_date}
                      onChange={e => setForm({ ...form, purchase_date: e.target.value })}
                      required
                      style={{ padding: '8px 10px', borderRadius: 8 }}
                    />
                  </div>
                </div>

                <div className="g2">
                  <div className="field">
                    <label style={labelStyle}>Invoice Notes / Memo</label>
                    <input
                      type="text"
                      placeholder="e.g. Bill #1042, Fabric deposit, Advance payment"
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      style={{ padding: '8px 10px', borderRadius: 8 }}
                    />
                  </div>

                  <div className="field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, marginTop: 14 }}>
                      <input
                        type="checkbox"
                        checked={form.tax_inclusive}
                        onChange={e => setForm({ ...form, tax_inclusive: e.target.checked })}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                        Tax Inclusive Pricing (Prices include VAT/GST)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Card 2: Purchase Line Items */}
              <div style={{
                background: 'var(--white)',
                padding: 22,
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    2. Line Items &amp; Materials
                  </div>
                  {isAdvanceEntry && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'var(--green-l)',
                      color: 'var(--green)',
                      padding: '3px 8px',
                      borderRadius: 6
                    }}>
                      💡 Advance payment entered: Qty &amp; Rate are optional
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                  {isAdvanceEntry
                    ? 'You can add items now or leave them blank if this is a standalone advance deposit.'
                    : 'Specify the material category, quantity, and unit rate.'}
                </div>

                {/* Line Items Table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                  <table style={{ margin: 0, width: '100%' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        <th style={{ padding: '8px 12px', fontSize: 11, color: '#475569', textAlign: 'left' }}>CATEGORY / ITEM</th>
                        <th style={{ padding: '8px 10px', fontSize: 11, color: '#475569', textAlign: 'right', width: 110 }}>
                          QTY {isAdvanceEntry ? '(Opt)' : '*'}
                        </th>
                        <th style={{ padding: '8px 10px', fontSize: 11, color: '#475569', textAlign: 'right', width: 130 }}>
                          RATE/PC ({currency}) {isAdvanceEntry ? '(Opt)' : '*'}
                        </th>
                        <th style={{ padding: '8px 12px', fontSize: 11, color: '#475569', textAlign: 'right', width: 120 }}>AMOUNT</th>
                        <th style={{ padding: '8px 8px', width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => {
                        const lineQty = parseFloat(it.quantity) || 0;
                        const lineRate = parseFloat(it.price_per_piece) || 0;
                        const lineAmount = lineQty * lineRate;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <select
                                value={it.category}
                                onChange={e => setItem(idx, 'category', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12 }}
                              >
                                <option value="mixed">Mixed / Fabric Goods</option>
                                {products.map(p => (
                                  <option key={p.category} value={p.category}>
                                    {p.name || getProductLabel(p.category)}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                placeholder={isAdvanceEntry ? 'Optional' : '0'}
                                value={it.quantity}
                                onChange={e => setItem(idx, 'quantity', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', textAlign: 'right', borderRadius: 6, fontSize: 12 }}
                              />
                            </td>

                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={isAdvanceEntry ? 'Optional' : '0.00'}
                                value={it.price_per_piece}
                                onChange={e => setItem(idx, 'price_per_piece', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', textAlign: 'right', borderRadius: 6, fontSize: 12 }}
                              />
                            </td>

                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>
                              {fmt(lineAmount)}
                            </td>

                            <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                disabled={form.items.length === 1}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: form.items.length === 1 ? '#cbd5e1' : 'var(--red)',
                                  cursor: form.items.length === 1 ? 'not-allowed' : 'pointer',
                                  fontSize: 12
                                }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span style={{ fontWeight: 800 }}>+</span> Add Line Item
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: ADVANCE, COMMERCIALS & SUMMARY */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              {/* Advance Paid & Transport Card */}
              <div style={{
                background: 'var(--white)',
                padding: 20,
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                  3. Advance Payment &amp; Taxes
                </div>

                {/* Advance Paid Prominent Input */}
                <div className="field mb14" style={{
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05), rgba(79, 70, 229, 0.01))',
                  padding: 12,
                  borderRadius: 8,
                  border: '1.5px solid var(--accent)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ ...labelStyle, color: 'var(--accent)', margin: 0, fontWeight: 800 }}>
                      Advance Paid ({currency})
                    </label>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Makes Qty optional</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.advance_paid}
                    onChange={e => setForm({ ...form, advance_paid: e.target.value })}
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: 'var(--accent)',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: '#fff'
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                    Amount deposited in advance to this vendor.
                  </div>
                </div>

                {/* Commercials: Discount & Tax */}
                <div className="g2 mb12">
                  <div className="field">
                    <label style={labelStyle}>Discount ({currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.discount}
                      onChange={e => setForm({ ...form, discount: e.target.value })}
                      style={{ padding: '7px 10px', borderRadius: 6 }}
                    />
                  </div>
                  <div className="field">
                    <label style={labelStyle}>Tax / VAT %</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={form.tax_percent}
                      onChange={e => setForm({ ...form, tax_percent: e.target.value })}
                      style={{ padding: '7px 10px', borderRadius: 6 }}
                    />
                  </div>
                </div>

                {/* Freight & Coolie */}
                <div className="g2 mb10">
                  <div className="field">
                    <label style={labelStyle}>Freight ({currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.freight}
                      onChange={e => setForm({ ...form, freight: e.target.value })}
                      style={{ padding: '7px 10px', borderRadius: 6 }}
                    />
                  </div>
                  <div className="field">
                    <label style={labelStyle}>Coolie / Labour ({currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.coolie}
                      onChange={e => setForm({ ...form, coolie: e.target.value })}
                      style={{ padding: '7px 10px', borderRadius: 6 }}
                    />
                  </div>
                </div>
              </div>

              {/* Live Invoice Summary Card */}
              <div style={{
                background: 'var(--white)',
                padding: 20,
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
                  4. Purchase Economics Summary
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>{fmt(effectiveSubtotal)}</span>
                  </div>

                  {discountNum > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}>
                      <span>Discount:</span>
                      <span>−{fmt(discountNum)}</span>
                    </div>
                  )}

                  {taxAmountNum > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Tax ({taxRateNum}%):</span>
                      <span>+{fmt(taxAmountNum)}</span>
                    </div>
                  )}

                  {(freightNum > 0 || coolieNum > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Transport &amp; Coolie:</span>
                      <span>+{fmt(freightNum + coolieNum)}</span>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Grand Total:</span>
                    <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>{fmt(grandTotal)}</span>
                  </div>

                  {advancePaidNum > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--blue, #2563eb)' }}>
                        <span style={{ fontWeight: 600 }}>Advance Paid:</span>
                        <span style={{ fontWeight: 700 }}>−{fmt(advancePaidNum)}</span>
                      </div>

                      <div style={{
                        background: balanceDue > 0 ? 'var(--red-l)' : 'var(--green-l)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 4
                      }}>
                        <span style={{ fontWeight: 700, color: balanceDue > 0 ? 'var(--red)' : 'var(--green)' }}>
                          {balanceDue > 0 ? 'Balance Due:' : 'Fully Settled:'}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: 14, color: balanceDue > 0 ? 'var(--red)' : 'var(--green)' }}>
                          {fmt(balanceDue)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    width: '100%',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: 16,
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
                  }}
                >
                  {saving ? 'Saving...' : (viewMode === 'edit' ? '✓ Update Purchase Entry' : '✓ Save Purchase Entry')}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEW 2: PURCHASES LIST VIEW
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      {/* Header */}
      <div className="sec-hd mb16" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="sec-title" style={{ fontSize: 18, fontWeight: 800 }}>Vendor Purchases</div>
          <div className="sec-sub">{total} invoice{total !== 1 ? 's' : ''} total recorded</div>
        </div>
        <button className="btn btn-primary" onClick={openNewPurchase} style={{ padding: '8px 16px', fontWeight: 700 }}>
          ➕ New Purchase
        </button>
      </div>

      {msg && (
        <div className={`alert ${msg.type === 'error' ? 'alert-red' : 'alert-green'} mb16`}>
          <div className="a-icon">{msg.type === 'error' ? '⚠️' : '✓'}</div>
          <div><div className="a-title">{msg.text}</div></div>
        </div>
      )}

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
          <div className="spinner">Loading purchases…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">{search ? `No purchases matching "${search}".` : 'No purchases yet. Click "+ New Purchase" to record one.'}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Pieces</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
                <th style={{ textAlign: 'right' }}>Advance / Paid</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Tax</th>
                <th>Dispute</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id}>
                  <td>
                    <span
                      style={{ fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
                      onClick={() => openDetail(p.id)}
                    >
                      {p.vendor_name}
                    </span>
                    {p.note && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.note}</div>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(p.invoice_date)}</td>
                  <td style={{ textAlign: 'right' }}>{Number(p.total_pieces) > 0 ? `${p.total_pieces} pcs` : '—'}</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>{fmt(p.subtotal)}</td>
                  <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--blue, #2563eb)' }}>
                    {Number(p.advance_paid) > 0 ? fmt(p.advance_paid) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{fmt(p.total)}</td>
                  <td>
                    <span className="badge" style={{ fontSize: 10 }}>
                      {Number(p.tax_rate) > 0 ? `${p.tax_rate}%` : '0%'}
                    </span>
                  </td>
                  <td>
                    {p.has_dispute ? (
                      <span className="badge badge-warn" style={{ fontSize: 10 }}>Dispute {fmt(p.dispute_amount)}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openDetail(p.id)}>View</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditPurchase(p)}>✏️ Edit</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)', borderColor: '#fca5a5' }}
                        onClick={() => deletePurchase(p.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="pagination" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Page {page} of {pages}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => loadPurchases(page - 1)}
              >
                ← Prev
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= pages}
                onClick={() => loadPurchases(page + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal (For Quick Viewing) ── */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ width: 620 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Purchase #{detail.purchase?.id} — {detail.purchase?.vendor_name}</h2>
              <span className={`badge ${detail.purchase?.status === 'paid' ? 'b-green' : 'badge-warn'}`}>
                {detail.purchase?.status?.toUpperCase()}
              </span>
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
                  <span className="cl" style={{ color: 'var(--green)' }}>Discount</span>
                  <span className="cv" style={{ color: 'var(--green)' }}>−{fmt(detail.purchase.discount)}</span>
                </div>
              )}
              {Number(detail.purchase?.tax_amount) > 0 && (
                <div className="calc-row">
                  <span className="cl">GST / VAT ({detail.purchase?.tax_rate}%){detail.purchase?.tax_inclusive ? ' (inclusive)' : ''}</span>
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
                <span className="cv" style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{fmt(detail.purchase?.total)}</span>
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
                      {fmt(Math.max(0, Number(detail.purchase.total) - Number(detail.purchase.advance_paid)))}
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
                {(!detail.items || detail.items.length === 0) && (
                  <tr><td colSpan={4} style={{ color: 'var(--muted)', textAlign: 'center' }}>No line items (Advance Payment Record).</td></tr>
                )}
                {detail.items?.map((it, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{getProductLabel(it.category)}</td>
                    <td style={{ textAlign: 'right' }}>{it.quantity > 0 ? `${it.quantity} pcs` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{it.rate_per_pc > 0 ? fmt(it.rate_per_pc) : '—'}</td>
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
              <button className="btn btn-ghost" onClick={() => openEditPurchase(detail.purchase)}>✏️ Edit</button>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
