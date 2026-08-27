import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function ItemsPage() {
  const { user } = useAuth();
  const currency = user?.currency || '₹';
  const fmt = (n) => `${currency} ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [items, setItems] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [uomFilter, setUomFilter] = useState('all');
  const [msg, setMsg] = useState(null);

  // View mode: 'list' | 'form'
  const [viewMode, setViewMode] = useState('list');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showManufacturing, setShowManufacturing] = useState(false);

  // Form state
  const initialForm = {
    id: null,
    name: '',
    category: '',
    item_code: '',
    item_type: 'product',
    uom: 'pcs',
    selling_rate: '',
    purchase_cost: '',
    tax_rate: user?.country === 'SA' ? '15' : '0',
    hsn_code: '',
    description: '',
    is_active: true,
    fabric_cost: '0',
    cut_rate: '0',
    stitch_rate: '0',
    logistics_cost: '0',
    lace_cost: '0',
    zip_cost: '0',
    thread_cost: '0',
    canvas_cost: '0',
    plastic_cost: '0',
    size_rates: [],
  };

  const [form, setForm] = useState(initialForm);
  const [newSizeLabel, setNewSizeLabel] = useState('');
  const [newSizeRate, setNewSizeRate] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/items?all=1'),
      api.get('/items/uoms').catch(() => ({ data: [] }))
    ]).then(([itemsRes, uomsRes]) => {
      setItems(itemsRes.data || []);
      setUoms(uomsRes.data || []);
    }).catch(err => {
      console.error('Failed to load items:', err);
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to fetch items list.' });
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewItem = () => {
    setIsEditing(false);
    setShowManufacturing(user?.modules?.feature_garment_production ?? false);
    setForm({ ...initialForm, tax_rate: user?.country === 'SA' ? '15' : '0' });
    setNewSizeLabel('');
    setNewSizeRate('');
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditItem = (item) => {
    setIsEditing(true);
    setShowManufacturing(
      Number(item.fabric_cost) > 0 || Number(item.cut_rate) > 0 || Number(item.stitch_rate) > 0 ||
      (user?.modules?.feature_garment_production ?? false)
    );
    setForm({
      id: item.id,
      name: item.name || item.display_name || '',
      category: item.category || '',
      item_code: item.item_code || '',
      item_type: item.item_type || 'product',
      uom: item.uom || 'pcs',
      selling_rate: String(item.selling_rate ?? ''),
      purchase_cost: String(item.purchase_cost ?? ''),
      tax_rate: String(item.tax_rate ?? '0'),
      hsn_code: item.hsn_code || '',
      description: item.description || '',
      is_active: item.is_active !== undefined ? (item.is_active === 1 || item.is_active === true) : true,
      fabric_cost: String(item.fabric_cost ?? '0'),
      cut_rate: String(item.cut_rate ?? '0'),
      stitch_rate: String(item.stitch_rate ?? '0'),
      logistics_cost: String(item.logistics_cost ?? '0'),
      lace_cost: String(item.lace_cost ?? '0'),
      zip_cost: String(item.zip_cost ?? '0'),
      thread_cost: String(item.thread_cost ?? '0'),
      canvas_cost: String(item.canvas_cost ?? '0'),
      plastic_cost: String(item.plastic_cost ?? '0'),
      size_rates: item.size_rates ? [...item.size_rates] : [],
    });
    setNewSizeLabel('');
    setNewSizeRate('');
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddSizeRate = () => {
    const label = newSizeLabel.trim();
    const rate = parseFloat(newSizeRate);
    if (!label) return;
    if (isNaN(rate) || rate <= 0) return;

    if (form.size_rates.some(r => r.size_label.toLowerCase() === label.toLowerCase())) {
      alert('This size label already exists.');
      return;
    }

    setForm(prev => ({
      ...prev,
      size_rates: [...prev.size_rates, { size_label: label, selling_rate: rate }]
    }));
    setNewSizeLabel('');
    setNewSizeRate('');
  };

  const handleRemoveSizeRate = (sizeLabel) => {
    setForm(prev => ({
      ...prev,
      size_rates: prev.size_rates.filter(r => r.size_label !== sizeLabel)
    }));
  };

  const handleSaveItem = async (e) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      alert('Please enter an item name.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && form.id) {
        await api.put(`/items/${form.id}`, form);
        setMsg({ type: 'success', text: `Item '${form.name}' updated successfully.` });
      } else {
        await api.post('/items', form);
        setMsg({ type: 'success', text: `Item '${form.name}' created successfully.` });
      }
      setViewMode('list');
      loadData();
      setTimeout(() => setMsg(null), 3500);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.display_name || item.name}"?`)) return;
    try {
      await api.delete(`/items/${item.id}`);
      setMsg({ type: 'success', text: `Item '${item.display_name || item.name}' deleted.` });
      loadData();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete item.');
    }
  };

  // Filtered list
  const filtered = items.filter(item => {
    if (typeFilter !== 'all' && (item.item_type || 'product') !== typeFilter) return false;
    if (uomFilter !== 'all' && (item.uom || 'pcs') !== uomFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.display_name && item.display_name.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.hsn_code && item.hsn_code.toLowerCase().includes(q))
    );
  });

  const productCount = items.filter(i => (i.item_type || 'product') === 'product').length;
  const serviceCount = items.filter(i => i.item_type === 'service').length;

  // Live calculations for form view
  const sellingPrice = parseFloat(form.selling_rate) || 0;
  const purchaseCost = parseFloat(form.purchase_cost) || 0;
  const totalMfgCost = (parseFloat(form.fabric_cost) || 0) +
                       (parseFloat(form.cut_rate) || 0) +
                       (parseFloat(form.stitch_rate) || 0) +
                       (parseFloat(form.logistics_cost) || 0) +
                       (parseFloat(form.lace_cost) || 0) +
                       (parseFloat(form.canvas_cost) || 0) +
                       (parseFloat(form.plastic_cost) || 0) +
                       (parseFloat(form.zip_cost) || 0) +
                       (parseFloat(form.thread_cost) || 0);

  const effectiveCost = purchaseCost > 0 ? purchaseCost : totalMfgCost;
  const profitPerUnit = sellingPrice - effectiveCost;
  const marginPercent = sellingPrice > 0 ? ((profitPerUnit / sellingPrice) * 100).toFixed(1) : 0;

  // ── VIEW 1: FULL-PAGE ITEM EDITOR ──
  if (viewMode === 'form') {
    return (
      <div>
        {/* Top Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setViewMode('list')}
              style={{ fontSize: 13 }}
            >
              ← Back to Catalog
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                {isEditing ? `Edit Item: ${form.name || form.category}` : 'Add New Product / Service'}
              </h1>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Configure item code, unit of measure (UOM), commercials, and optional production costs.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setViewMode('list')}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveItem}
              disabled={saving}
              style={{ padding: '8px 20px', fontWeight: 700 }}
            >
              {saving ? 'Saving Item...' : (isEditing ? '✓ Update Product' : '✓ Save Product')}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveItem}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 20 }}>
            {/* Left Column: Basic Info & Commercials */}
            <div>
              {/* Card 1: Identification */}
              <div className="card mb16">
                <div className="card-hd" style={{ fontSize: 14 }}>1. Basic Identification &amp; Unit</div>

                <div className="field mb12">
                  <label>Item / Product Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Shawl Nighty, Engine Oil Filter, AC Repair Service"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                    autoFocus
                    style={{ fontSize: 14, fontWeight: 600 }}
                  />
                </div>

                <div className="g2 mb12">
                  <div className="field">
                    <label>Item Code / SKU / Barcode</label>
                    <input
                      type="text"
                      placeholder="e.g. SKU-1002, ART-04"
                      value={form.item_code}
                      onChange={e => setForm({ ...form, item_code: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Item Type</label>
                    <select
                      value={form.item_type}
                      onChange={e => setForm({ ...form, item_type: e.target.value })}
                    >
                      <option value="product">📦 Physical Product</option>
                      <option value="service">💼 Service / Labour / Billable Hours</option>
                    </select>
                  </div>
                </div>

                <div className="field mb12">
                  <label>Unit of Measure (UOM) *</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    {['pcs', 'box', 'kg', 'mtr', 'set', 'pkt', 'hrs', 'ltr', 'dzn', 'sqft'].map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setForm({ ...form, uom: u })}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: form.uom === u ? 700 : 500,
                          background: form.uom === u ? 'var(--accent)' : 'var(--bg)',
                          color: form.uom === u ? '#fff' : 'var(--text)',
                          border: `1px solid ${form.uom === u ? 'var(--accent)' : 'var(--border)'}`,
                          cursor: 'pointer',
                          textTransform: 'uppercase'
                        }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <select
                    value={form.uom}
                    onChange={e => setForm({ ...form, uom: e.target.value })}
                    required
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="box">Boxes (box)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="mtr">Meters (mtr)</option>
                    <option value="set">Sets (set)</option>
                    <option value="pkt">Packets (pkt)</option>
                    <option value="hrs">Hours (hrs)</option>
                    <option value="ltr">Liters (ltr)</option>
                    <option value="dzn">Dozens (dzn)</option>
                    <option value="sqft">Square Feet (sqft)</option>
                  </select>
                </div>

                <div className="field">
                  <label>Item Description / Specifications</label>
                  <textarea
                    rows={2}
                    placeholder="Optional item details, fabric specs, warranty terms, or notes..."
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Card 2: Commercial Pricing */}
              <div className="card mb16">
                <div className="card-hd" style={{ fontSize: 14 }}>2. Commercial Pricing &amp; Taxes</div>

                <div className="g3 mb12">
                  <div className="field">
                    <label>Selling Rate ({currency}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.selling_rate}
                      onChange={e => setForm({ ...form, selling_rate: e.target.value })}
                      required
                      style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}
                    />
                  </div>
                  <div className="field">
                    <label>Purchase / Cost Price ({currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.purchase_cost}
                      onChange={e => setForm({ ...form, purchase_cost: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Tax / VAT Rate %</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 15, 5, 0"
                      value={form.tax_rate}
                      onChange={e => setForm({ ...form, tax_rate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="g2">
                  <div className="field">
                    <label>HSN / SAC / Commodity Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 620822 (Garments), 9983 (Services)"
                      value={form.hsn_code}
                      onChange={e => setForm({ ...form, hsn_code: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={e => setForm({ ...form, is_active: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600 }}>Active in Sales &amp; Invoicing</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Size Variations & Manufacturing Breakdown */}
            <div>
              {/* Profit & Unit Summary Card */}
              <div className="card mb16" style={{ background: 'linear-gradient(135deg, rgba(200,134,10,0.06), rgba(200,134,10,0.01))', borderColor: 'rgba(200,134,10,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
                  📊 Commercial Profit Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Effective Cost / Unit</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{fmt(effectiveCost)}</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Selling Price / {form.uom.toUpperCase()}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>{fmt(sellingPrice)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Gross Profit per Unit</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: profitPerUnit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt(profitPerUnit)} ({marginPercent}%)
                    </div>
                  </div>
                  <span className="badge" style={{ fontSize: 11, fontWeight: 700 }}>
                    Unit: {form.uom.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Size & Variation Rates Card */}
              <div className="card mb16">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div className="card-hd" style={{ fontSize: 14, margin: 0 }}>📏 Size &amp; Tier Rates</div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{form.size_rates.length} configured</span>
                </div>

                {form.size_rates.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {form.size_rates.map((sr, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, padding: '4px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>Size {sr.size_label}</div>
                        <input
                          type="number"
                          step="0.01"
                          style={{ width: 100, padding: '4px 8px', fontSize: 12, textAlign: 'right' }}
                          value={sr.selling_rate}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setForm(prev => ({
                              ...prev,
                              size_rates: prev.size_rates.map((r, i) => i === idx ? { ...r, selling_rate: val } : r)
                            }));
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--red)', borderColor: '#fca5a5', padding: '2px 6px', fontSize: 11 }}
                          onClick={() => handleRemoveSizeRate(sr.size_label)}
                        >
                          ❌
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Size (e.g. 38, S, XL)"
                    style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
                    value={newSizeLabel}
                    onChange={e => setNewSizeLabel(e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Rate (${currency})`}
                    style={{ width: 100, padding: '6px 8px', fontSize: 12 }}
                    value={newSizeRate}
                    onChange={e => setNewSizeRate(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11 }}
                    onClick={handleAddSizeRate}
                  >
                    ➕ Add
                  </button>
                </div>
              </div>

              {/* Manufacturing & Labour Cost Breakdown (Collapsible) */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showManufacturing ? 12 : 0 }}>
                  <div className="card-hd" style={{ fontSize: 14, margin: 0 }}>🧵 Manufacturing &amp; Labour Breakdown</div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowManufacturing(!showManufacturing)}
                    style={{ fontSize: 11 }}
                  >
                    {showManufacturing ? '▲ Collapse' : '▼ Expand Specs'}
                  </button>
                </div>

                {showManufacturing && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                      Wages and material breakdown used in Garment Production Logs, Stitching Settlements, and Reports.
                    </div>

                    <div className="g2 mb10">
                      <div className="field">
                        <label>Fabric Cost / pc</label>
                        <input type="number" step="0.01" value={form.fabric_cost} onChange={e => setForm({ ...form, fabric_cost: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Logistics / Transport</label>
                        <input type="number" step="0.01" value={form.logistics_cost} onChange={e => setForm({ ...form, logistics_cost: e.target.value })} />
                      </div>
                    </div>

                    <div className="g2 mb10">
                      <div className="field">
                        <label>Cutting Wage / pc</label>
                        <input type="number" step="0.01" value={form.cut_rate} onChange={e => setForm({ ...form, cut_rate: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Stitching Wage / pc</label>
                        <input type="number" step="0.01" value={form.stitch_rate} onChange={e => setForm({ ...form, stitch_rate: e.target.value })} />
                      </div>
                    </div>

                    <div className="g3 mb10">
                      <div className="field">
                        <label>Lace Cost</label>
                        <input type="number" step="0.01" value={form.lace_cost} onChange={e => setForm({ ...form, lace_cost: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Canvas</label>
                        <input type="number" step="0.01" value={form.canvas_cost} onChange={e => setForm({ ...form, canvas_cost: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Plastic / Bag</label>
                        <input type="number" step="0.01" value={form.plastic_cost} onChange={e => setForm({ ...form, plastic_cost: e.target.value })} />
                      </div>
                    </div>

                    <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Total Calculated Mfg Cost:</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>{fmt(totalMfgCost)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ── VIEW 2: CATALOG LIST VIEW ──
  return (
    <div>
      {/* Metrics Row */}
      <div className="g4 mb16">
        <div className="stat-card">
          <div className="stat-label">Total Catalog Items</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 800 }}>{items.length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{productCount} Products · {serviceCount} Services</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Physical Products</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{productCount}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Inventory &amp; Unit Managed</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Services &amp; Labour</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{serviceCount}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Billable Hours / Jobs</div>
        </div>
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={openNewItem} style={{ width: '100%', padding: '10px', fontSize: 13, fontWeight: 700 }}>
            ➕ Add Product / Service
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === 'error' ? 'alert-red' : 'alert-green'} mb16`}>
          <div className="a-icon">{msg.type === 'error' ? '⚠️' : '✓'}</div>
          <div><div className="a-title">{msg.text}</div></div>
        </div>
      )}

      {/* Main Catalog Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="🔍 Search item name, SKU, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 250, padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
            />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
            >
              <option value="all">All Types</option>
              <option value="product">📦 Products</option>
              <option value="service">💼 Services</option>
            </select>
            <select
              value={uomFilter}
              onChange={e => setUomFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
            >
              <option value="all">All Units (UOM)</option>
              {uoms.map(u => (
                <option key={u.code} value={u.code}>{u.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Showing {filtered.length} of {items.length} items
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNewItem}>
              ➕ New Item
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }} className="spinner">Loading products &amp; services...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 600 }}>No items match your filter.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click &quot;Add Product / Service&quot; above to create your first item.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Item Name &amp; Code</th>
                  <th>Type</th>
                  <th>Unit (UOM)</th>
                  <th style={{ textAlign: 'right' }}>Selling Rate</th>
                  <th style={{ textAlign: 'right' }}>Cost / Purchase</th>
                  <th style={{ textAlign: 'center' }}>Tax / VAT</th>
                  <th>Specs &amp; Variations</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const isService = item.item_type === 'service';
                  const uomCode = (item.uom || 'pcs').toUpperCase();
                  const totalMfg = Number(item.fabric_cost || 0) + Number(item.cut_rate || 0) + Number(item.stitch_rate || 0) + Number(item.logistics_cost || 0);

                  return (
                    <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.6 }}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{item.display_name || item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                            {item.item_code && <span>SKU: <code>{item.item_code}</code></span>}
                            <span>Code: <code>{item.category}</code></span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isService ? 'b-blue' : ''}`} style={{ fontSize: 10 }}>
                          {isService ? '💼 Service' : '📦 Product'}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: 11, fontWeight: 700, background: 'rgba(200,134,10,0.08)', color: 'var(--accent)', borderColor: 'rgba(200,134,10,0.3)' }}>
                          {uomCode}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>
                        {fmt(item.selling_rate)}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                        {Number(item.purchase_cost) > 0 ? fmt(item.purchase_cost) : (totalMfg > 0 ? fmt(totalMfg) : '—')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge" style={{ fontSize: 10 }}>
                          {Number(item.tax_rate) > 0 ? `${item.tax_rate}%` : '0%'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {item.size_rates && item.size_rates.length > 0 && (
                            <span className="badge b-green" style={{ fontSize: 10, marginRight: 4 }}>
                              {item.size_rates.length} size rates
                            </span>
                          )}
                          {totalMfg > 0 && (
                            <span className="badge" style={{ fontSize: 10 }}>
                              Labour/Mfg: {fmt(totalMfg)}
                            </span>
                          )}
                          {!item.size_rates?.length && totalMfg === 0 && (
                            <span>Standard</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => openEditItem(item)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                            onClick={() => handleDeleteItem(item)}
                          >
                            ❌
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
      </div>
    </div>
  );
}
