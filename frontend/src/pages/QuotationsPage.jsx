import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { exportToCSV } from '../utils/csvExport';
import { useDebounce } from '../hooks/useDebounce';
import Pagination from '../components/Pagination';

export default function QuotationsPage() {
  const { user } = useAuth();
  const currency = user?.currency || 'SAR';

  // State
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // View modes: 'list' | 'new' | 'edit'
  const [viewMode, setViewMode] = useState('list');
  const [editingQuote, setEditingQuote] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 300);

  // Preview & Print Modal
  const [previewQuote, setPreviewQuote] = useState(null);
  const [previewItems, setPreviewItems] = useState([]);
  const printRef = useRef(null);

  // Form State
  const emptyForm = {
    client_id: '',
    quote_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // +15 days
    status: 'draft',
    gst_percent: 0,
    discount_percent: 0,
    discount: 0,
    notes: '',
    terms_conditions: '1. Quotation validity is 15 days from issue date.\n2. 50% advance upon order confirmation, balance before dispatch.\n3. Goods once sold will not be returned without prior approval.',
    items: [{ category: '', description: '', uom: 'pcs', quantity: 1, rate_per_pc: 0, amount: 0 }],
  };
  const [form, setForm] = useState(emptyForm);

  // Load Auxiliary Master Data
  useEffect(() => {
    Promise.all([
      api.get('/sales/clients'),
      api.get('/items'),
    ]).then(([cRes, iRes]) => {
      setClients(cRes.data || []);
      setCatalogItems(iRes.data || []);
    }).catch(err => console.error('Failed to load masters:', err));
  }, []);

  // Load Paginated Quotations Data
  const loadQuotations = async (targetPage = page, targetLimit = limit) => {
    setLoading(true);
    try {
      const qRes = await api.get('/quotations', {
        params: {
          page: targetPage,
          limit: targetLimit,
          search: debouncedSearch,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }
      });
      setQuotations(qRes.data?.data || []);
      setTotal(qRes.data?.total || 0);
      setPages(qRes.data?.pages || 1);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // Load when page, limit, or filters change
  useEffect(() => {
    loadQuotations(page, limit);
  }, [page, limit, debouncedSearch, statusFilter]);

  // Form Handlers
  const openNew = () => {
    setEditingQuote(null);
    setForm({
      ...emptyForm,
      quote_date: new Date().toISOString().slice(0, 10),
      expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      client_id: clients[0]?.id || '',
    });
    setViewMode('new');
  };

  const openEdit = async (quote) => {
    try {
      const res = await api.get(`/quotations/${quote.id}`);
      const q = res.data.quotation;
      const items = res.data.items || [];
      setEditingQuote(q);
      setForm({
        client_id: q.client_id,
        quote_date: q.quote_date?.slice(0, 10) || '',
        expiry_date: q.expiry_date?.slice(0, 10) || '',
        status: q.status || 'draft',
        gst_percent: q.gst_percent || 0,
        discount_percent: q.discount_percent || 0,
        discount: q.discount || 0,
        notes: q.notes || '',
        terms_conditions: q.terms_conditions || '',
        items: items.length > 0 ? items.map(it => ({
          category: it.category,
          description: it.description || '',
          uom: it.uom || 'pcs',
          quantity: it.quantity,
          rate_per_pc: it.rate_per_pc,
          amount: it.amount
        })) : [{ category: '', description: '', uom: 'pcs', quantity: 1, rate_per_pc: 0, amount: 0 }],
      });
      setViewMode('edit');
    } catch (err) {
      alert('Failed to load quotation for editing');
    }
  };

  const openPreview = async (quote) => {
    try {
      const res = await api.get(`/quotations/${quote.id}`);
      setPreviewQuote(res.data.quotation);
      setPreviewItems(res.data.items || []);
    } catch (err) {
      alert('Failed to load quotation preview');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Line Item Calculations
  const updateItem = (index, field, value) => {
    const updated = [...form.items];
    updated[index][field] = value;

    // Auto fill price/uom if category chosen from catalog
    if (field === 'category') {
      const matched = catalogItems.find(i => (i.category === value || i.name === value));
      if (matched) {
        if (matched.selling_rate) updated[index].rate_per_pc = parseFloat(matched.selling_rate);
        if (matched.uom) updated[index].uom = matched.uom;
      }
    }

    const qty = parseFloat(updated[index].quantity) || 0;
    const rate = parseFloat(updated[index].rate_per_pc) || 0;
    updated[index].amount = parseFloat((qty * rate).toFixed(2));
    setForm({ ...form, items: updated });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { category: '', description: '', uom: 'pcs', quantity: 1, rate_per_pc: 0, amount: 0 }]
    });
  };

  const removeItem = (index) => {
    if (form.items.length === 1) return;
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index)
    });
  };

  // Live Economics Calculation
  const subtotal = useMemo(() => {
    return form.items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  }, [form.items]);

  const discAmt = useMemo(() => {
    const pct = parseFloat(form.discount_percent) || 0;
    if (pct > 0) return parseFloat(((subtotal * pct) / 100).toFixed(2));
    return parseFloat(form.discount) || 0;
  }, [subtotal, form.discount_percent, form.discount]);

  const taxableAmount = Math.max(0, subtotal - discAmt);
  const taxAmt = useMemo(() => {
    const taxRate = parseFloat(form.gst_percent) || 0;
    return parseFloat(((taxableAmount * taxRate) / 100).toFixed(2));
  }, [taxableAmount, form.gst_percent]);

  const grandTotal = parseFloat((taxableAmount + taxAmt).toFixed(2));

  // Save Quotation
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!form.client_id) {
      alert('Please select a client.');
      return;
    }
    if (form.items.length === 0 || !form.items.some(i => i.category.trim())) {
      alert('Please enter at least one line item with a category/item name.');
      return;
    }

    setSaving(true);
    try {
      if (viewMode === 'edit' && editingQuote) {
        await api.put(`/quotations/${editingQuote.id}`, form);
        setMsg({ type: 'success', text: `Quotation #${editingQuote.quotation_number} updated successfully.` });
      } else {
        const res = await api.post('/quotations', form);
        setMsg({ type: 'success', text: `Quotation #${res.data?.quotation_number} created successfully.` });
      }
      setViewMode('list');
      loadQuotations(page, limit);
      setTimeout(() => setMsg(null), 3500);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save quotation.');
    } finally {
      setSaving(false);
    }
  };

  // 1-Click Convert to Sales Order
  const handleConvert = async (quote) => {
    if (!window.confirm(`Convert Quotation #${quote.quotation_number} to a confirmed Sales Order / Invoice?`)) return;
    try {
      const res = await api.post(`/quotations/${quote.id}/convert`);
      setMsg({ type: 'success', text: res.data?.message || 'Converted to Sales Order successfully!' });
      loadQuotations(page, limit);
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to convert quotation.');
    }
  };

  // Delete Quote
  const handleDelete = async (quote) => {
    if (!window.confirm(`Are you sure you want to delete Quotation #${quote.quotation_number}?`)) return;
    try {
      await api.delete(`/quotations/${quote.id}`);
      setMsg({ type: 'success', text: `Quotation #${quote.quotation_number} deleted.` });
      loadQuotations(page, limit);
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete quotation.');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!quotations.length) {
      alert('No quotations available to export.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = `Quotations_Export_${todayStr}`;

    const headers = [
      'Quote #',
      'Quotation Date',
      'Valid Until',
      'Client Name',
      'City',
      'Total Items',
      'Total Pieces',
      `Subtotal (${currency})`,
      `Discount (${currency})`,
      `Tax / VAT (${currency})`,
      `Total Amount (${currency})`,
      'Status',
      'Internal Notes'
    ];

    const rows = quotations.map(q => [
      q.quotation_number || '',
      q.quote_date?.slice(0, 10) || '',
      q.expiry_date?.slice(0, 10) || '',
      q.client_name || '',
      q.client_city || '',
      q.items_count || 0,
      q.total_quantity || 0,
      Number(q.subtotal || 0).toFixed(2),
      Number(q.discount || 0).toFixed(2),
      Number(q.gst_amount || 0).toFixed(2),
      Number(q.total || 0).toFixed(2),
      (q.status || '').toUpperCase(),
      q.notes || ''
    ]);

    exportToCSV(filename, headers, rows);
  };

  // Status badge helper
  const getBadge = (status) => {
    switch (status) {
      case 'draft':     return <span className="badge b-gray">Draft</span>;
      case 'sent':      return <span className="badge b-accent">Sent</span>;
      case 'accepted':  return <span className="badge b-green">✓ Accepted</span>;
      case 'converted': return <span className="badge b-green" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 800 }}>⭐ Invoiced</span>;
      case 'rejected':  return <span className="badge b-red">✕ Rejected</span>;
      case 'expired':   return <span className="badge b-orange">Expired</span>;
      default:          return <span className="badge b-gray">{status}</span>;
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: FULL-PAGE QUOTATION EDITOR (NEW / EDIT)
  // ═════════════════════════════════════════════════════════════════════════
  if (viewMode === 'new' || viewMode === 'edit') {
    return (
      <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 60 }}>
        {/* Top Sticky Action Bar */}
        <div style={{
          background: 'var(--white)',
          padding: '16px 24px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="btn btn-ghost"
              style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>←</span> All Quotes
            </button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📄</span>
                {viewMode === 'edit' ? `Edit Quotation: #${editingQuote?.quotation_number}` : 'New Quotation & Estimate'}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, marginTop: 2 }}>
                Draft commercial estimates, customer proposals, and 1-click convert into active sales invoices.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="btn btn-ghost"
              style={{ padding: '8px 18px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{ minWidth: 140, padding: '9px 22px', fontSize: 13, fontWeight: 700 }}
            >
              {saving ? 'Saving…' : (viewMode === 'edit' ? '✓ Update Quotation' : '✓ Save Quotation')}
            </button>
          </div>
        </div>

        {/* ── SECTION 1: QUOTATION & CLIENT DETAILS (FULL WIDTH) ── */}
        <div className="card" style={{ padding: '22px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>1.</span> Quotation &amp; Client Details
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>* Required fields</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            alignItems: 'start'
          }}>
            {/* Client Selector */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Client / Customer <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
              >
                <option value="">— Select Client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.city ? `(${c.city})` : ''} {c.phone ? `• ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Quotation Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13 }}
              >
                <option value="draft">Draft (Internal Review)</option>
                <option value="sent">Sent to Customer</option>
                <option value="accepted">Accepted / Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {/* Quotation Date */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Quotation Date <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                type="date"
                value={form.quote_date}
                onChange={(e) => setForm({ ...form, quote_date: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13 }}
              />
            </div>

            {/* Validity / Expiry Date */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Valid Until / Expiry Date
              </label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        {/* ── SECTION 2: LINE ITEMS & PRICING (FULL WIDTH) ── */}
        <div className="card" style={{ padding: '22px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--accent)' }}>2.</span> Line Items &amp; Commercial Pricing
                <span className="badge b-gray" style={{ fontSize: 11, marginLeft: 4 }}>
                  {form.items.length} {form.items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Add items with unit rates. Total amounts calculate in real-time.
              </div>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="btn btn-ghost btn-sm"
              style={{
                color: 'var(--accent)',
                borderColor: 'var(--accent)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px'
              }}
            >
              <span>+</span> Add Line Item
            </button>
          </div>

          {/* Items Table Container */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Desktop View: Full Table */}
            <div className="desktop-only" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center', width: 36 }}>#</th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'left', minWidth: 220, width: '28%' }}>
                      ITEM / CATEGORY <span style={{ color: 'var(--red)' }}>*</span>
                    </th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'left', minWidth: 180 }}>
                      DESCRIPTION &amp; SPECIFICATIONS
                    </th>
                    <th style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center', width: 90 }}>UOM</th>
                    <th style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'right', width: 95 }}>QTY</th>
                    <th style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'right', width: 125 }}>
                      RATE ({currency})
                    </th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'right', width: 130 }}>
                      AMOUNT ({currency})
                    </th>
                    <th style={{ padding: '10px 8px', width: 38 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < form.items.length - 1 ? '1px solid var(--border)' : 'none', background: '#fff' }}>
                      {/* Row Index */}
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                        {idx + 1}
                      </td>

                      {/* Item Category */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          list={`catalog-list-${idx}`}
                          placeholder="e.g. Abaya, Uniform, Fabric"
                          value={it.category}
                          onChange={(e) => updateItem(idx, 'category', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 7,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            boxSizing: 'border-box'
                          }}
                        />
                        <datalist id={`catalog-list-${idx}`}>
                          {catalogItems.map(ci => (
                            <option key={ci.id} value={ci.name || ci.category} />
                          ))}
                        </datalist>
                      </td>

                      {/* Item Description */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          placeholder="Optional specifications, sizes, notes..."
                          value={it.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 7,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* UOM */}
                      <td style={{ padding: '8px 6px' }}>
                        <select
                          value={it.uom}
                          onChange={(e) => updateItem(idx, 'uom', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 6px',
                            borderRadius: 7,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            textAlign: 'center',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="pcs">pcs</option>
                          <option value="meters">mtrs</option>
                          <option value="rolls">rolls</option>
                          <option value="sets">sets</option>
                          <option value="boxes">box</option>
                          <option value="kg">kg</option>
                        </select>
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 8px',
                            borderRadius: 7,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            textAlign: 'right',
                            fontWeight: 600,
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* Rate / Pc */}
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.rate_per_pc}
                          onChange={(e) => updateItem(idx, 'rate_per_pc', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 8px',
                            borderRadius: 7,
                            border: '1px solid var(--border)',
                            fontSize: 13,
                            textAlign: 'right',
                            fontWeight: 600,
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* Line Amount */}
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                        {(it.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Delete Button */}
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: form.items.length === 1 ? '#cbd5e1' : 'var(--red)',
                            cursor: form.items.length === 1 ? 'not-allowed' : 'pointer',
                            fontSize: 15,
                            padding: 4,
                            lineHeight: 1
                          }}
                          disabled={form.items.length === 1}
                          title={form.items.length === 1 ? 'Cannot delete only row' : 'Remove item'}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Responsive Line Item Cards */}
            <div className="mobile-only" style={{ padding: 10 }}>
              {form.items.map((it, idx) => (
                <div key={idx} className="line-item-card">
                  <div className="line-item-card-header">
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Item #{idx + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: it.amount ? 'var(--text)' : 'var(--muted)' }}>
                        {currency} {(it.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          style={{ background: '#fee2e2', border: 'none', color: '#ef4444', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Item / Category *</label>
                      <input
                        type="text"
                        list={`catalog-list-mob-${idx}`}
                        placeholder="e.g. Abaya, Uniform, Fabric"
                        value={it.category}
                        onChange={(e) => updateItem(idx, 'category', e.target.value)}
                        style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                      />
                      <datalist id={`catalog-list-mob-${idx}`}>
                        {catalogItems.map(ci => (
                          <option key={ci.id} value={ci.name || ci.category} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Description / Specifications</label>
                      <input
                        type="text"
                        placeholder="Optional specifications, sizes, notes..."
                        value={it.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 6 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>UOM</label>
                        <select
                          value={it.uom}
                          onChange={(e) => updateItem(idx, 'uom', e.target.value)}
                          style={{ width: '100%', padding: '7px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, textAlign: 'center' }}
                        >
                          <option value="pcs">pcs</option>
                          <option value="meters">mtrs</option>
                          <option value="rolls">rolls</option>
                          <option value="sets">sets</option>
                          <option value="boxes">box</option>
                          <option value="kg">kg</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Qty *</label>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, textAlign: 'right', fontWeight: 600, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Rate ({currency}) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.rate_per_pc}
                          onChange={(e) => updateItem(idx, 'rate_per_pc', e.target.value)}
                          style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, textAlign: 'right', fontWeight: 600, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Row inside Items card */}
            <div style={{
              background: 'var(--bg)',
              padding: '10px 16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <button
                type="button"
                onClick={addItem}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', borderColor: 'var(--accent)' }}
              >
                + Add Another Row
              </button>

              <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 16 }}>
                <span>Total Items: <b style={{ color: 'var(--text)' }}>{form.items.length}</b></span>
                <span>Total Pieces: <b style={{ color: 'var(--text)' }}>{form.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0)}</b></span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: BOTTOM SPLIT (TERMS ON LEFT, SUMMARY ON RIGHT) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
          alignItems: 'start'
        }}>
          {/* Card 3: Terms & Internal Notes */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>3.</span> Commercial Terms &amp; Notes
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Terms &amp; Conditions (Printed on Quotation PDF)
                </label>
                <textarea
                  rows={4}
                  value={form.terms_conditions}
                  onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })}
                  placeholder="Delivery timeline, payment milestones, validity terms..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.45 }}
                />
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Internal Memo / Client Instructions
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Special discounts agreed upon, client preferences, internal tracking..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.45 }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Estimate Summary & Economics */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>4.</span> Estimate Financial Summary
            </div>

            {/* Discount & Tax controls in 2 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Discount (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.discount_percent}
                  onChange={(e) => setForm({ ...form, discount_percent: e.target.value, discount: 0 })}
                  placeholder="0.0%"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}
                />
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Fixed Discount ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value, discount_percent: 0 })}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}
                />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                VAT / GST Rate (%)
              </label>
              <select
                value={form.gst_percent}
                onChange={(e) => setForm({ ...form, gst_percent: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}
              >
                <option value="0">0% (Tax Exempt / Nil Rate)</option>
                <option value="5">5% VAT</option>
                <option value="15">15% VAT (Standard KSA)</option>
                <option value="18">18% GST (Standard India)</option>
              </select>
            </div>

            {/* Calculations Breakdown Card */}
            <div style={{
              background: 'var(--bg)',
              borderRadius: 10,
              padding: '16px 18px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Subtotal:</span>
                <span style={{ fontWeight: 600 }}>{currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              {discAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--red)' }}>
                  <span>Discount:</span>
                  <span style={{ fontWeight: 600 }}>- {currency} {discAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {taxAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>VAT / GST ({form.gst_percent}%):</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>+{currency} {taxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 17,
                fontWeight: 900,
                color: 'var(--text)',
                borderTop: '1.5px solid var(--border)',
                paddingTop: 12,
                marginTop: 4
              }}>
                <span>Total Quotation:</span>
                <span style={{ color: 'var(--accent)' }}>{currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{
                width: '100%',
                marginTop: 18,
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
              }}
            >
              {saving ? 'Saving…' : (viewMode === 'edit' ? '✓ Save Changes to Quote' : '✓ Issue & Save Quotation')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: CATALOG & QUOTATIONS LIST
  // ═════════════════════════════════════════════════════════════════════════
  const totalQuotesVal = quotations.reduce((s, q) => s + (parseFloat(q.total) || 0), 0);
  const acceptedQuotesVal = quotations.filter(q => q.status === 'accepted' || q.status === 'converted').reduce((s, q) => s + (parseFloat(q.total) || 0), 0);
  const pendingQuotesCount = quotations.filter(q => q.status === 'sent' || q.status === 'draft').length;

  return (
    <div>
      {/* Toast Notification */}
      {msg && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: msg.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          fontWeight: 600,
          fontSize: 13
        }}>
          {msg.text}
        </div>
      )}

      {/* KPI Stat Cards Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 20
      }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>All Quotes Issued</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            {currency} {totalQuotesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{quotations.length} total quotations</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Accepted & Converted</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
            {currency} {acceptedQuotesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {quotations.filter(q => q.status === 'accepted' || q.status === 'converted').length} approved proposals
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--orange)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Pending / In Progress</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--orange)', marginTop: 4 }}>
            {pendingQuotesCount} Quotes
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Awaiting client approval</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <button
            type="button"
            onClick={openNew}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 16px', fontSize: 13, gap: 6 }}
          >
            <span style={{ fontSize: 16 }}>+</span> New Quotation
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{
        background: 'var(--white)',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Search */}
        <div className="search-wrap" style={{ flex: '1 1 240px', maxWidth: 360 }}>
          <span className="sw-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by quote #, client, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="sw-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {/* Status Segment Filter Pills & Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'draft', label: 'Draft' },
              { id: 'sent', label: 'Sent' },
              { id: 'accepted', label: 'Accepted' },
              { id: 'converted', label: 'Invoiced' },
              { id: 'rejected', label: 'Rejected' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setStatusFilter(p.id)}
                style={{
                  background: statusFilter === p.id ? 'var(--accent)' : 'var(--bg)',
                  color: statusFilter === p.id ? '#fff' : 'var(--muted)',
                  border: '1px solid',
                  borderColor: statusFilter === p.id ? 'var(--accent)' : 'var(--border)',
                  borderRadius: 20,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.12s'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
            disabled={quotations.length === 0}
            title="Download CSV spreadsheet of quotations"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="spinner" style={{ padding: 40 }}>Loading quotations…</div>
        ) : quotations.length === 0 ? (
          <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>No quotations found matching your criteria.</p>
            <button
              type="button"
              onClick={openNew}
              className="btn btn-primary"
              style={{ marginTop: 14 }}
            >
              + Create First Quotation
            </button>
          </div>
        ) : (
          <div>
            <div className="tbl-wrap">
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'left', color: '#475569' }}>QUOTE #</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'left', color: '#475569' }}>DATE</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'left', color: '#475569' }}>CLIENT</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'center', color: '#475569' }}>ITEMS / PCS</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'right', color: '#475569' }}>TOTAL AMOUNT</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'center', color: '#475569' }}>STATUS</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'center', color: '#475569' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map(q => (
                    <tr key={q.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent)' }}>
                        <span
                          onClick={() => openPreview(q)}
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          title="Click to view quotation"
                        >
                          {q.quotation_number}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {q.quote_date?.slice(0, 10)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{q.client_name}</div>
                        {q.client_city && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{q.client_city}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12 }}>
                        <span style={{ fontWeight: 600 }}>{q.total_quantity}</span> pcs <span style={{ color: 'var(--muted)' }}>({q.items_count} items)</span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>
                        {currency} {(parseFloat(q.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {getBadge(q.status)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {/* Preview / Print */}
                          <button
                            type="button"
                            onClick={() => openPreview(q)}
                            className="btn btn-ghost btn-sm"
                            title="Print / Preview Quotation"
                          >
                            📄 View
                          </button>

                          {/* Convert to Sales Order */}
                          {q.status !== 'converted' && (
                            <button
                              type="button"
                              onClick={() => handleConvert(q)}
                              className="btn btn-sm"
                              style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                              title="Convert to Confirmed Sales Order"
                            >
                              ⚡ Convert
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => openEdit(q)}
                            className="btn btn-ghost btn-sm"
                            title="Edit Quote"
                          >
                            ✏️
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(q)}
                            className="btn btn-red btn-sm"
                            title="Delete Quote"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              page={page}
              pages={pages}
              total={total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: PRINTABLE QUOTATION PREVIEW DOCUMENT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {previewQuote && (
        <div className="modal-overlay" onClick={() => setPreviewQuote(null)}>
          <div
            className="modal"
            style={{ width: 780, maxWidth: '95vw', padding: 0, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg)'
            }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                Quotation Preview: #{previewQuote.quotation_number}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn btn-primary btn-sm"
                >
                  🖨️ Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewQuote(null)}
                  className="btn btn-ghost btn-sm"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div ref={printRef} style={{ padding: '32px 36px', background: '#fff', color: '#1e293b' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: 20 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', margin: 0 }}>
                    {user?.tenant_name || 'VIVA STUDIO'}
                  </h1>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                    Commercial Quotation & Cost Estimate
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{previewQuote.quotation_number}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Date: <strong>{previewQuote.quote_date?.slice(0, 10)}</strong>
                  </div>
                  {previewQuote.expiry_date && (
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Valid Until: <strong>{previewQuote.expiry_date?.slice(0, 10)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Client Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '20px 0', fontSize: 13 }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Prepared For:</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{previewQuote.client_name}</div>
                  {previewQuote.client_phone && <div style={{ color: '#475569', marginTop: 2 }}>📞 {previewQuote.client_phone}</div>}
                  {previewQuote.client_address && <div style={{ color: '#475569', marginTop: 2 }}>📍 {previewQuote.client_address}</div>}
                  {previewQuote.client_vat && <div style={{ color: '#475569', marginTop: 2 }}>VAT #: {previewQuote.client_vat}</div>}
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Proposal Status:</div>
                  <div style={{ marginTop: 4 }}>{getBadge(previewQuote.status)}</div>
                  {previewQuote.converted_order_id && (
                    <div style={{ fontSize: 12, color: '#15803d', marginTop: 6, fontWeight: 600 }}>
                      ✓ Converted to Order #{previewQuote.converted_order_id}
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left', color: '#475569' }}>#</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left', color: '#475569' }}>ITEM / DESCRIPTION</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'center', color: '#475569' }}>UOM</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', color: '#475569' }}>QTY</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', color: '#475569' }}>RATE ({currency})</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', color: '#475569' }}>AMOUNT ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px', fontSize: 12, color: '#64748b', width: 24 }}>{idx + 1}</td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{it.category}</div>
                        {it.description && <div style={{ fontSize: 11, color: '#64748b' }}>{it.description}</div>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>{it.uom || 'pcs'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{it.quantity}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: 13 }}>
                        {(parseFloat(it.rate_per_pc) || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                        {(parseFloat(it.amount) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, marginTop: 24 }}>
                <div>
                  {previewQuote.terms_conditions && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Terms & Conditions:</div>
                      <div style={{ fontSize: 11, color: '#475569', whiteSpace: 'pre-line', lineHeight: 1.5, background: '#f8fafc', padding: '10px 12px', borderRadius: 6 }}>
                        {previewQuote.terms_conditions}
                      </div>
                    </div>
                  )}
                  {previewQuote.notes && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Notes:</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{previewQuote.notes}</div>
                    </div>
                  )}
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 8, border: '1px solid #e2e8f0', height: 'fit-content' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: '#64748b' }}>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>{currency} {(parseFloat(previewQuote.subtotal) || 0).toFixed(2)}</span>
                  </div>
                  {parseFloat(previewQuote.discount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ef4444', marginBottom: 6 }}>
                      <span>Discount:</span>
                      <span>- {currency} {(parseFloat(previewQuote.discount) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {parseFloat(previewQuote.gst_amount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Tax ({previewQuote.gst_percent}%):</span>
                      <span style={{ fontWeight: 600 }}>+{currency} {(parseFloat(previewQuote.gst_amount) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 16,
                    fontWeight: 900,
                    color: 'var(--accent)',
                    borderTop: '2px solid #cbd5e1',
                    paddingTop: 10,
                    marginTop: 6
                  }}>
                    <span>Total Amount:</span>
                    <span>{currency} {(parseFloat(previewQuote.total) || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
