import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { exportToCSV } from '../utils/csvExport';
import { useDebounce } from '../hooks/useDebounce';
import Pagination from '../components/Pagination';

export default function DeliveryNotesPage() {
  const { user } = useAuth();
  const currency = user?.currency || 'SAR';

  // State
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
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
  const [editingNote, setEditingNote] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 300);

  // Preview / Print Modal
  const [previewNote, setPreviewNote] = useState(null);
  const [previewItems, setPreviewItems] = useState([]);
  const printRef = useRef(null);

  // Form State
  const emptyForm = {
    client_id: '',
    order_id: '',
    delivery_date: new Date().toISOString().slice(0, 10),
    status: 'dispatched',
    shipping_address: '',
    transporter_name: '',
    vehicle_number: '',
    tracking_lr_number: '',
    notes: '',
    items: [{ category: '', description: '', uom: 'pcs', quantity: 1, remarks: '' }],
  };
  const [form, setForm] = useState(emptyForm);

  // Load Masters Data
  useEffect(() => {
    Promise.all([
      api.get('/sales/clients'),
      api.get('/sales?limit=100'),
      api.get('/items'),
    ]).then(([cRes, oRes, iRes]) => {
      setClients(cRes.data || []);
      setSalesOrders(oRes.data?.data || oRes.data || []);
      setCatalogItems(iRes.data || []);
    }).catch(err => console.error('Failed to load masters:', err));
  }, []);

  // Load Paginated Delivery Notes
  const loadDeliveryNotes = async (targetPage = page, targetLimit = limit) => {
    setLoading(true);
    try {
      const dnRes = await api.get('/delivery-notes', {
        params: {
          page: targetPage,
          limit: targetLimit,
          search: debouncedSearch,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }
      });
      setDeliveryNotes(dnRes.data?.data || []);
      setTotal(dnRes.data?.total || 0);
      setPages(dnRes.data?.pages || 1);
    } catch (err) {
      console.error('Failed to load delivery notes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // Reload when page, limit, search, or status changes
  useEffect(() => {
    loadDeliveryNotes(page, limit);
  }, [page, limit, debouncedSearch, statusFilter]);

  // Form Handlers
  const openNew = () => {
    setEditingNote(null);
    setForm({
      ...emptyForm,
      delivery_date: new Date().toISOString().slice(0, 10),
      client_id: clients[0]?.id || '',
    });
    setViewMode('new');
  };

  const openEdit = async (note) => {
    try {
      const res = await api.get(`/delivery-notes/${note.id}`);
      const dn = res.data.delivery_note;
      const items = res.data.items || [];
      setEditingNote(dn);
      setForm({
        client_id: dn.client_id,
        order_id: dn.order_id || '',
        delivery_date: dn.delivery_date?.slice(0, 10) || '',
        status: dn.status || 'dispatched',
        shipping_address: dn.shipping_address || '',
        transporter_name: dn.transporter_name || '',
        vehicle_number: dn.vehicle_number || '',
        tracking_lr_number: dn.tracking_lr_number || '',
        notes: dn.notes || '',
        items: items.length > 0 ? items.map(it => ({
          category: it.category,
          description: it.description || '',
          uom: it.uom || 'pcs',
          quantity: it.quantity,
          remarks: it.remarks || ''
        })) : [{ category: '', description: '', uom: 'pcs', quantity: 1, remarks: '' }],
      });
      setViewMode('edit');
    } catch (err) {
      alert('Failed to load delivery note for editing');
    }
  };

  const openPreview = async (note) => {
    try {
      const res = await api.get(`/delivery-notes/${note.id}`);
      setPreviewNote(res.data.delivery_note);
      setPreviewItems(res.data.items || []);
    } catch (err) {
      alert('Failed to load delivery note preview');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // When a Sales Order is selected in the form, automatically populate client & line items!
  const handleSelectOrder = async (orderId) => {
    setForm(prev => ({ ...prev, order_id: orderId }));
    if (!orderId) return;

    try {
      const res = await api.get(`/sales/${orderId}`);
      const order = res.data;
      if (order) {
        setForm(prev => ({
          ...prev,
          order_id: orderId,
          client_id: order.client_id || prev.client_id,
          shipping_address: order.client_address || prev.shipping_address,
          notes: `Delivery for Invoice #${order.invoice_number}`,
          items: order.items && order.items.length > 0 ? order.items.map(it => ({
            category: it.category,
            description: it.description || '',
            uom: it.uom || 'pcs',
            quantity: it.quantity,
            remarks: `Inv #${order.invoice_number}`
          })) : prev.items
        }));
      }
    } catch {}
  };

  // Line Item Handlers
  const updateItem = (index, field, value) => {
    const updated = [...form.items];
    updated[index][field] = value;
    setForm({ ...form, items: updated });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { category: '', description: '', uom: 'pcs', quantity: 1, remarks: '' }]
    });
  };

  const removeItem = (index) => {
    if (form.items.length === 1) return;
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index)
    });
  };

  // Total Dispatched Pieces
  const totalPieces = useMemo(() => {
    return form.items.reduce((sum, it) => sum + (parseInt(it.quantity) || 0), 0);
  }, [form.items]);

  // Save Delivery Note
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!form.client_id) {
      alert('Please select a client.');
      return;
    }
    if (form.items.length === 0 || !form.items.some(i => i.category.trim())) {
      alert('Please enter at least one dispatched item.');
      return;
    }

    setSaving(true);
    try {
      if (viewMode === 'edit' && editingNote) {
        await api.put(`/delivery-notes/${editingNote.id}`, form);
        setMsg({ type: 'success', text: `Delivery Note #${editingNote.delivery_note_number} updated.` });
      } else {
        const res = await api.post('/delivery-notes', form);
        setMsg({ type: 'success', text: `Delivery Note #${res.data?.delivery_note_number} created successfully.` });
      }
      setViewMode('list');
      loadDeliveryNotes(page, limit);
      setTimeout(() => setMsg(null), 3500);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save delivery note.');
    } finally {
      setSaving(false);
    }
  };

  // Fast Status Update
  const handleQuickStatus = async (note, newStatus) => {
    try {
      await api.put(`/delivery-notes/${note.id}/status`, { status: newStatus });
      setMsg({ type: 'success', text: `Note #${note.delivery_note_number} marked as ${newStatus}.` });
      loadDeliveryNotes(page, limit);
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      alert('Failed to update status');
    }
  };

  // Delete Note
  const handleDelete = async (note) => {
    if (!window.confirm(`Delete Delivery Note #${note.delivery_note_number}?`)) return;
    try {
      await api.delete(`/delivery-notes/${note.id}`);
      setMsg({ type: 'success', text: `Delivery Note #${note.delivery_note_number} deleted.` });
      loadDeliveryNotes(page, limit);
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete delivery note.');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!deliveryNotes.length) {
      alert('No delivery notes available to export.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = `Delivery_Notes_Export_${todayStr}`;

    const headers = [
      'Delivery Note #',
      'Dispatch Date',
      'Client / Consignee',
      'City',
      'Order Invoice Ref',
      'Total Pieces',
      'Transporter / Courier',
      'Vehicle Number',
      'Tracking / LR #',
      'Status',
      'Shipping Address',
      'Driver Notes'
    ];

    const rows = deliveryNotes.map(dn => [
      dn.delivery_note_number || '',
      dn.delivery_date?.slice(0, 10) || '',
      dn.client_name || '',
      dn.client_city || '',
      dn.order_invoice_number || 'Direct',
      dn.total_pieces || dn.total_items_count || 0,
      dn.transporter_name || '',
      dn.vehicle_number || '',
      dn.tracking_lr_number || '',
      (dn.status || '').toUpperCase(),
      dn.shipping_address || '',
      dn.notes || ''
    ]);

    exportToCSV(filename, headers, rows);
  };

  const getBadge = (status) => {
    switch (status) {
      case 'dispatched': return <span className="badge b-orange">🚚 In-Transit / Dispatched</span>;
      case 'delivered':  return <span className="badge b-green">✓ Delivered</span>;
      case 'cancelled':  return <span className="badge b-red">Cancelled</span>;
      default:           return <span className="badge b-gray">{status}</span>;
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: FULL-PAGE DELIVERY NOTE EDITOR
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
              <span>←</span> All Dispatches
            </button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🚚</span>
                {viewMode === 'edit' ? `Edit Delivery Note: #${editingNote?.delivery_note_number}` : 'New Delivery Note & Gate Pass'}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, marginTop: 2 }}>
                Track logistics dispatches, transporter details, vehicle LR numbers, and recipient receipts.
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
              {saving ? 'Saving…' : (viewMode === 'edit' ? '✓ Update Note' : '✓ Save Delivery Note')}
            </button>
          </div>
        </div>

        {/* ── SECTION 1: DELIVERY & RECIPIENT DETAILS (FULL WIDTH) ── */}
        <div className="card" style={{ padding: '22px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>1.</span> Delivery &amp; Consignee Details
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>* Required fields</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            alignItems: 'start'
          }}>
            {/* Link to Sales Order */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Link to Sales Order (Optional)
              </label>
              <select
                value={form.order_id}
                onChange={(e) => handleSelectOrder(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13 }}
              >
                <option value="">-- Standalone Delivery Note --</option>
                {salesOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.invoice_number} - {o.client_name} ({o.total_pieces || 0} pcs)
                  </option>
                ))}
              </select>
            </div>

            {/* Client Selector */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Client / Consignee <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
              >
                <option value="">— Select Client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.city ? `(${c.city})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Date */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Dispatch / Delivery Date <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13 }}
              />
            </div>

            {/* Status */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Dispatch Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13 }}
              >
                <option value="dispatched">🚚 In-Transit / Dispatched</option>
                <option value="delivered">✓ Delivered &amp; Acknowledged</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ margin: 0, marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Destination / Shipping Address
            </label>
            <textarea
              rows={2}
              value={form.shipping_address}
              onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
              placeholder="Destination warehouse, street address, receiver contact, gate number..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.4 }}
            />
          </div>
        </div>

        {/* ── SECTION 2: DISPATCHED PACKAGES & ITEMS (FULL WIDTH) ── */}
        <div className="card" style={{ padding: '22px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--accent)' }}>2.</span> Dispatched Packages &amp; Item Breakdown
                <span className="badge b-gray" style={{ fontSize: 11, marginLeft: 4 }}>
                  {form.items.length} {form.items.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                List all cartons, packages, and quantities included in this dispatch shipment.
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
              <span>+</span> Add Package Row
            </button>
          </div>

          {/* Table Container */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center', width: 36 }}>#</th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'left', minWidth: 220, width: '35%' }}>
                      ITEM / CATEGORY <span style={{ color: 'var(--red)' }}>*</span>
                    </th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'left', minWidth: 220 }}>
                      BOX / PACKING REMARKS
                    </th>
                    <th style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center', width: 100 }}>UOM</th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'right', width: 120 }}>DISPATCH QTY</th>
                    <th style={{ padding: '10px 8px', width: 38 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < form.items.length - 1 ? '1px solid var(--border)' : 'none', background: '#fff' }}>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                        {idx + 1}
                      </td>

                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          list={`dn-catalog-${idx}`}
                          placeholder="e.g. Cotton Uniform"
                          value={it.category}
                          onChange={(e) => updateItem(idx, 'category', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                        />
                        <datalist id={`dn-catalog-${idx}`}>
                          {catalogItems.map(ci => (
                            <option key={ci.id} value={ci.name || ci.category} />
                          ))}
                        </datalist>
                      </td>

                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          placeholder="Box #1, Bundle of 10, Polybag..."
                          value={it.remarks}
                          onChange={(e) => updateItem(idx, 'remarks', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </td>

                      <td style={{ padding: '8px 6px' }}>
                        <select
                          value={it.uom}
                          onChange={(e) => updateItem(idx, 'uom', e.target.value)}
                          style={{ width: '100%', padding: '8px 6px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, textAlign: 'center', boxSizing: 'border-box' }}
                        >
                          <option value="pcs">pcs</option>
                          <option value="meters">mtrs</option>
                          <option value="boxes">box</option>
                          <option value="rolls">rolls</option>
                          <option value="sets">sets</option>
                        </select>
                      </td>

                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, textAlign: 'right', fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </td>

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
                <span>Total Packages: <b style={{ color: 'var(--text)' }}>{form.items.length}</b></span>
                <span>Total Pieces Dispatched: <b style={{ color: 'var(--accent)' }}>{totalPieces} pcs</b></span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: BOTTOM SPLIT (LOGISTICS & DISPATCH SUMMARY) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
          alignItems: 'start'
        }}>
          {/* Card 3: Logistics & Transporter Details */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>3.</span> Transporter &amp; Logistics Info
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Transporter / Logistics Co.
                </label>
                <input
                  type="text"
                  value={form.transporter_name}
                  onChange={(e) => setForm({ ...form, transporter_name: e.target.value })}
                  placeholder="e.g. BlueDart / SMSA / In-House"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}
                />
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Vehicle / Driver No.
                </label>
                <input
                  type="text"
                  value={form.vehicle_number}
                  onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                  placeholder="e.g. KA-01-AB-1234"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}
                />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Tracking / LR / Waybill #
              </label>
              <input
                type="text"
                value={form.tracking_lr_number}
                onChange={(e) => setForm({ ...form, tracking_lr_number: e.target.value })}
                placeholder="e.g. LR-984210"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}
              />
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Driver / Dispatch Notes
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Fragile, gate pass instructions, delivery time window..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.4 }}
              />
            </div>
          </div>

          {/* Card 4: Dispatch Summary Card */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>4.</span> Dispatch Summary &amp; Confirmation
            </div>

            <div style={{
              background: 'var(--bg)',
              borderRadius: 10,
              padding: '20px',
              border: '1px solid var(--border)',
              textAlign: 'center',
              marginBottom: 16
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                Total Dispatched Quantity
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)', marginTop: 6 }}>
                {totalPieces} Pieces
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Across {form.items.length} line {form.items.length === 1 ? 'package' : 'packages'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
              }}
            >
              {saving ? 'Saving…' : (viewMode === 'edit' ? '✓ Update Delivery Note' : '✓ Generate Delivery Note')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW: CATALOG & DISPATCHES LIST
  // ═════════════════════════════════════════════════════════════════════════
  const totalDispatches = deliveryNotes.length;
  const inTransitCount = deliveryNotes.filter(dn => dn.status === 'dispatched').length;
  const deliveredCount = deliveryNotes.filter(dn => dn.status === 'delivered').length;

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
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Dispatches</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            {totalDispatches} Dispatches
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Logged delivery notes</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--orange)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>In Transit / Out for Delivery</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--orange)', marginTop: 4 }}>
            {inTransitCount} Shipments
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Awaiting receiver sign-off</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Completed Deliveries</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
            {deliveredCount} Delivered
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Successfully fulfilled</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <button
            type="button"
            onClick={openNew}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 16px', fontSize: 13, gap: 6 }}
          >
            <span style={{ fontSize: 16 }}>+</span> New Delivery Note
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
        <div className="search-wrap" style={{ flex: '1 1 240px', maxWidth: 360 }}>
          <span className="sw-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by DN #, client, carrier, vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="sw-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'dispatched', label: '🚚 In-Transit' },
              { id: 'delivered', label: '✓ Delivered' },
              { id: 'draft', label: 'Draft' }
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
            disabled={deliveryNotes.length === 0}
            title="Download CSV spreadsheet of delivery notes"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="spinner" style={{ padding: 40 }}>Loading delivery notes…</div>
        ) : deliveryNotes.length === 0 ? (
          <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>No delivery notes found matching your criteria.</p>
            <button
              type="button"
              onClick={openNew}
              className="btn btn-primary"
              style={{ marginTop: 14 }}
            >
              + Create First Delivery Note
            </button>
          </div>
        ) : (
          <div>
            <div className="tbl-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'left', color: '#475569' }}>NOTE #</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'left', color: '#475569' }}>DATE</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'left', color: '#475569' }}>CLIENT & DESTINATION</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'left', color: '#475569' }}>ORDER REF</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'center', color: '#475569' }}>PIECES</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'left', color: '#475569' }}>CARRIER / VEHICLE</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'center', color: '#475569' }}>STATUS</th>
                    <th style={{ padding: '10px 14px', fontSize: 11, textAlign: 'center', color: '#475569' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryNotes.map(dn => (
                    <tr key={dn.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent)' }}>
                        <span
                          onClick={() => openPreview(dn)}
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          title="Click to view gate pass"
                        >
                          {dn.delivery_note_number}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {dn.delivery_date?.slice(0, 10)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{dn.client_name}</div>
                        {dn.client_city && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{dn.client_city}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        {dn.order_invoice_number ? (
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {dn.order_invoice_number}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>Direct</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
                        {dn.total_pieces || dn.total_items_count || 0} pcs
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        {dn.transporter_name && <div style={{ fontWeight: 600 }}>{dn.transporter_name}</div>}
                        {dn.vehicle_number && <div style={{ fontSize: 11, color: 'var(--muted)' }}>🚛 {dn.vehicle_number}</div>}
                        {!dn.transporter_name && !dn.vehicle_number && <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {getBadge(dn.status)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => openPreview(dn)}
                            className="btn btn-ghost btn-sm"
                            title="Print Gate Pass"
                          >
                            📄 Gate Pass
                          </button>

                          {dn.status === 'dispatched' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatus(dn, 'delivered')}
                              className="btn btn-sm"
                              style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                              title="Mark as Delivered"
                            >
                              ✓ Received
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEdit(dn)}
                            className="btn btn-ghost btn-sm"
                            title="Edit Note"
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(dn)}
                            className="btn btn-red btn-sm"
                            title="Delete Note"
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
      {/* MODAL: PRINTABLE DELIVERY CHALLAN / GATE PASS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {previewNote && (
        <div className="modal-overlay" onClick={() => setPreviewNote(null)}>
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
                Delivery Challan Preview: #{previewNote.delivery_note_number}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn btn-primary btn-sm"
                >
                  🖨️ Print Gate Pass
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewNote(null)}
                  className="btn btn-ghost btn-sm"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div ref={printRef} style={{ padding: '32px 36px', background: '#fff', color: '#1e293b' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: 18 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', margin: 0 }}>
                    {user?.tenant_name || 'VIVA STUDIO'}
                  </h1>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                    Delivery Challan & Gate Pass (Dispatch Note)
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{previewNote.delivery_note_number}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Date: <strong>{previewNote.delivery_date?.slice(0, 10)}</strong>
                  </div>
                  {previewNote.order_invoice_number && (
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Invoice Ref: <strong>{previewNote.order_invoice_number}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Consignee & Carrier Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '20px 0', fontSize: 13 }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Consignee / Deliver To:</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{previewNote.client_name}</div>
                  {previewNote.client_phone && <div style={{ color: '#475569', marginTop: 2 }}>📞 {previewNote.client_phone}</div>}
                  <div style={{ color: '#475569', marginTop: 2 }}>
                    📍 {previewNote.shipping_address || previewNote.client_address || 'Same as office address'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Transport & Carrier:</div>
                  <div>Carrier: <strong>{previewNote.transporter_name || 'Self Dispatch'}</strong></div>
                  {previewNote.vehicle_number && <div>Vehicle #: <strong>{previewNote.vehicle_number}</strong></div>}
                  {previewNote.tracking_lr_number && <div>LR/Docket #: <strong>{previewNote.tracking_lr_number}</strong></div>}
                  <div style={{ marginTop: 4 }}>{getBadge(previewNote.status)}</div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left', color: '#475569', width: 24 }}>#</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left', color: '#475569' }}>ITEM DESCRIPTION</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'center', color: '#475569', width: 80 }}>UOM</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', color: '#475569', width: 100 }}>DISPATCH QTY</th>
                    <th style={{ padding: '8px 10px', fontSize: 11, textAlign: 'left', color: '#475569' }}>PACKING / REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px', fontSize: 12, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{it.category}</div>
                        {it.description && <div style={{ fontSize: 11, color: '#64748b' }}>{it.description}</div>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>{it.uom || 'pcs'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, fontSize: 14 }}>{it.quantity}</td>
                      <td style={{ padding: '10px', fontSize: 12, color: '#64748b' }}>{it.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Pieces */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '12px 16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                marginTop: 16
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                  Total Dispatched Quantity: <span style={{ color: 'var(--accent)', fontSize: 16 }}>{previewNote.total_pieces || previewNote.total_items_count || 0} Pieces</span>
                </div>
              </div>

              {/* Signatures & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 48, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: 40 }}></div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    Prepared / Warehouse
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: 40 }}></div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    Driver / Carrier Sign
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: 40 }}></div>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    Receiver Stamp & Signature
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
