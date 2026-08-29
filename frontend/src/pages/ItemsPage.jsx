import { useState, useEffect, useMemo } from 'react';
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

  // Form & view state
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'form'
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'pricing' | 'sizes' | 'manufacturing' | 'economics'
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialForm = {
    id: null,
    name: '',
    category: '',
    item_code: '',
    item_type: 'product', // 'product' | 'service'
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

  const UOM_OPTIONS = [
    { code: 'pcs', label: 'Pieces', icon: '📦', desc: 'Standard unit' },
    { code: 'box', label: 'Boxes', icon: '📦', desc: 'Carton/Pack' },
    { code: 'kg',  label: 'Kilograms', icon: '⚖️', desc: 'Weight' },
    { code: 'mtr', label: 'Meters', icon: '📏', desc: 'Length/Fabric' },
    { code: 'set', label: 'Sets', icon: '🗂️', desc: 'Bundles' },
    { code: 'pkt', label: 'Packets', icon: '🛍️', desc: 'Pouches' },
    { code: 'hrs', label: 'Hours', icon: '⏱️', desc: 'Time/Labour' },
    { code: 'ltr', label: 'Liters', icon: '🧴', desc: 'Liquids' },
    { code: 'dzn', label: 'Dozens', icon: '🔢', desc: '12 pcs batch' },
    { code: 'sqft', label: 'Sq. Feet', icon: '📐', desc: 'Area' },
  ];

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/items?all=1'),
      api.get('/items/uoms').catch(() => ({ data: [] }))
    ]).then(([itemsRes, uomsRes]) => {
      setItems(itemsRes.data || []);
      setUoms(uomsRes.data && uomsRes.data.length ? uomsRes.data : UOM_OPTIONS);
    }).catch(err => {
      console.error('Failed to load items:', err);
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to fetch catalog items.' });
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewItem = () => {
    setIsEditing(false);
    setActiveTab('basic');
    setForm({ ...initialForm, tax_rate: user?.country === 'SA' ? '15' : '0' });
    setNewSizeLabel('');
    setNewSizeRate('');
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditItem = (item) => {
    setIsEditing(true);
    setActiveTab('basic');
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
      alert(`Size variation '${label}' already exists.`);
      return;
    }

    setForm(prev => ({
      ...prev,
      size_rates: [...prev.size_rates, { size_label: label, selling_rate: rate }]
    }));
    setNewSizeLabel('');
    setNewSizeRate('');
  };

  const handleQuickAddSizes = (preset) => {
    let presets = [];
    const baseRate = parseFloat(form.selling_rate) || 0;

    if (preset === 'alpha') presets = ['S', 'M', 'L', 'XL', 'XXL'];
    if (preset === 'numeric') presets = ['38', '40', '42', '44'];
    if (preset === 'free') presets = ['Free Size'];

    const newRates = [...form.size_rates];
    for (const p of presets) {
      if (!newRates.some(r => r.size_label.toLowerCase() === p.toLowerCase())) {
        newRates.push({ size_label: p, selling_rate: baseRate });
      }
    }

    setForm(prev => ({ ...prev, size_rates: newRates }));
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
    if (!window.confirm(`Are you sure you want to remove "${item.display_name || item.name}"?`)) return;
    try {
      await api.delete(`/items/${item.id}`);
      setMsg({ type: 'success', text: `Item '${item.display_name || item.name}' deleted.` });
      loadData();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete item.');
    }
  };

  // Filtered List
  const filtered = useMemo(() => {
    return items.filter(item => {
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
  }, [items, search, typeFilter, uomFilter]);

  const productCount = items.filter(i => (i.item_type || 'product') === 'product').length;
  const serviceCount = items.filter(i => i.item_type === 'service').length;

  // Live calculations for Economics
  const sellingPrice = parseFloat(form.selling_rate) || 0;
  const purchaseCost = parseFloat(form.purchase_cost) || 0;
  const mfgFabric = parseFloat(form.fabric_cost) || 0;
  const mfgCut = parseFloat(form.cut_rate) || 0;
  const mfgStitch = parseFloat(form.stitch_rate) || 0;
  const mfgLogistics = parseFloat(form.logistics_cost) || 0;
  const mfgLace = parseFloat(form.lace_cost) || 0;
  const mfgCanvas = parseFloat(form.canvas_cost) || 0;
  const mfgPlastic = parseFloat(form.plastic_cost) || 0;
  const mfgZip = parseFloat(form.zip_cost) || 0;
  const mfgThread = parseFloat(form.thread_cost) || 0;

  const totalCalculatedMfg = mfgFabric + mfgCut + mfgStitch + mfgLogistics + mfgLace + mfgCanvas + mfgPlastic + mfgZip + mfgThread;
  const effectiveCost = purchaseCost > 0 ? purchaseCost : totalCalculatedMfg;
  const grossProfit = sellingPrice - effectiveCost;
  const marginPct = sellingPrice > 0 ? ((grossProfit / sellingPrice) * 100).toFixed(1) : '0';

  // Smooth elegant label style
  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569', // Smooth slate
    letterSpacing: '0.2px',
    marginBottom: '6px',
  };

  // ═══════════════════════════════════════════════════════════════
  // VIEW 1: FULL-WIDTH FORM (Tabs at top, clean full width layout)
  // ═══════════════════════════════════════════════════════════════
  if (viewMode === 'form') {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 40 }}>
        {/* Top Action & Navigation Header */}
        <div style={{
          background: 'var(--white)',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          marginBottom: 18,
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
              <span>←</span> Catalog
            </button>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {isEditing ? `Edit: ${form.name || form.category}` : 'New Product or Service'}
              </h1>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Configure item code, unit of measure, pricing, and manufacturing specs
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* iOS-Style Activity Toggle Switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', position: 'relative', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
                <div style={{
                  width: 38,
                  height: 22,
                  background: form.is_active ? 'var(--green)' : '#cbd5e1',
                  borderRadius: 20,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    background: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    left: form.is_active ? 19 : 3,
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </label>
              <span style={{ fontSize: 12, fontWeight: 600, color: form.is_active ? 'var(--green)' : 'var(--muted)' }}>
                {form.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '7px 14px',
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
              onClick={handleSaveItem}
              disabled={saving}
              style={{
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              {saving ? 'Saving...' : (isEditing ? '✓ Save Changes' : '✓ Create Item')}
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div style={{
          display: 'flex',
          gap: 6,
          marginBottom: 16,
          background: 'var(--white)',
          padding: 5,
          borderRadius: 10,
          border: '1px solid var(--border)',
          overflowX: 'auto'
        }}>
          {[
            { id: 'basic', label: '1. Basic & Unit (UOM)', icon: '🏷️' },
            { id: 'pricing', label: '2. Pricing & Taxes', icon: '💰' },
            { id: 'sizes', label: `3. Size Rates (${form.size_rates.length})`, icon: '📏' },
            { id: 'manufacturing', label: '4. Manufacturing & Labour', icon: '🧵' },
            { id: 'economics', label: '5. Commercial Economics', icon: '📊' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 7,
                border: 'none',
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 700 : 500,
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* ── FULL-WIDTH TAB CONTENT ── */}
        <form onSubmit={handleSaveItem}>
          
          {/* TAB 1: BASIC & UNIT (UOM) */}
          {activeTab === 'basic' && (
            <div style={{
              background: 'var(--white)',
              padding: 24,
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                Item Identification &amp; Unit
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
                Provide the item name, code, type, and unit of measurement.
              </div>

              {/* Item Name (Full Width) */}
              <div className="field mb16">
                <label style={labelStyle}>
                  Product / Item Name <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cotton T-Shirt"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}
                />
              </div>

              {/* Classification Cards */}
              <div className="field mb18">
                <label style={labelStyle}>Item Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    onClick={() => setForm({ ...form, item_type: 'product' })}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: `1.5px solid ${form.item_type === 'product' ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.item_type === 'product' ? 'var(--accent-l)' : 'var(--bg)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}
                  >
                    <div style={{ fontSize: 20 }}>📦</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: form.item_type === 'product' ? 'var(--accent)' : 'var(--text)' }}>
                        Physical Product
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Tangible goods tracked with stock &amp; units
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setForm({ ...form, item_type: 'service' })}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: `1.5px solid ${form.item_type === 'service' ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.item_type === 'service' ? 'var(--accent-l)' : 'var(--bg)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}
                  >
                    <div style={{ fontSize: 20 }}>💼</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: form.item_type === 'service' ? 'var(--accent)' : 'var(--text)' }}>
                        Service / Labour
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Billable hours, consulting, or job fees
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SKU & Category */}
              <div className="g2 mb18">
                <div className="field">
                  <label style={labelStyle}>Item Code / SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. SKU-101"
                    value={form.item_code}
                    onChange={e => setForm({ ...form, item_code: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
                <div className="field">
                  <label style={labelStyle}>Category Key (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. cotton_tshirt"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
              </div>

              {/* Unit of Measure (UOM) Pill Grid */}
              <div className="field mb18">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>
                    Unit of Measure (UOM) <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Selected: <strong>{form.uom.toUpperCase()}</strong></span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 8,
                  marginBottom: 10
                }}>
                  {UOM_OPTIONS.map(u => {
                    const isSelected = form.uom === u.code;
                    return (
                      <div
                        key={u.code}
                        onClick={() => setForm({ ...form, uom: u.code })}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--accent-l)' : 'var(--bg)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        <span style={{ fontSize: 15 }}>{u.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                            {u.label}
                          </div>
                          <div style={{ fontSize: 10, color: isSelected ? 'var(--accent)' : 'var(--muted)' }}>
                            {u.code.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="field">
                <label style={labelStyle}>Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional item details, fabric specs, or notes..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ borderRadius: 8, padding: '8px 12px' }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & TAXES */}
          {activeTab === 'pricing' && (
            <div style={{
              background: 'var(--white)',
              padding: 24,
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                Commercial Rates &amp; Taxes
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
                Set selling rate, base purchase cost, tax percentage, and HSN code.
              </div>

              <div className="g3 mb18">
                <div className="field">
                  <label style={labelStyle}>
                    Selling Rate ({currency}) <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.selling_rate}
                    onChange={e => setForm({ ...form, selling_rate: e.target.value })}
                    required
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: 'var(--accent)',
                      padding: '9px 12px',
                      borderRadius: 8
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>per {form.uom.toUpperCase()}</div>
                </div>

                <div className="field">
                  <label style={labelStyle}>
                    Purchase / Base Cost ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.purchase_cost}
                    onChange={e => setForm({ ...form, purchase_cost: e.target.value })}
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      padding: '9px 12px',
                      borderRadius: 8
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Incurred cost per unit</div>
                </div>

                <div className="field">
                  <label style={labelStyle}>
                    Tax / VAT Rate %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={form.tax_rate}
                    onChange={e => setForm({ ...form, tax_rate: e.target.value })}
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      padding: '9px 12px',
                      borderRadius: 8
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>e.g. 15% (KSA) or 5%/12% (IN)</div>
                </div>
              </div>

              <div className="g2">
                <div className="field">
                  <label style={labelStyle}>HSN / SAC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 6208"
                    value={form.hsn_code}
                    onChange={e => setForm({ ...form, hsn_code: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Required for GST / Saudi ZATCA invoices</div>
                </div>

                {/* Quick economics summary banner inside pricing */}
                <div style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Estimated Unit Margin:</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: grossProfit >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                      {fmt(grossProfit)} ({marginPct}%)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('economics')}
                    style={{ background: 'none', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    View Breakdown →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIZE & VARIATION RATES */}
          {activeTab === 'sizes' && (
            <div style={{
              background: 'var(--white)',
              padding: 24,
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  Size &amp; Variant Rates
                </div>
                <span className="badge b-green" style={{ fontSize: 11 }}>
                  {form.size_rates.length} custom rates
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
                Override default selling rate for specific sizes (e.g. Size 44 or XXL).
              </div>

              {/* Presets */}
              <div style={{
                padding: '10px 12px',
                background: 'var(--bg)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Quick Add:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAddSizes('alpha')}
                  style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>+</span> S, M, L, XL, XXL
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddSizes('numeric')}
                  style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>+</span> 38, 40, 42, 44
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddSizes('free')}
                  style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>+</span> Free Size
                </button>
              </div>

              {/* Table */}
              {form.size_rates.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border)', marginBottom: 16 }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📏</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>No size-specific rates added</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    The default selling price ({fmt(form.selling_rate || 0)}) will apply to all sizes.
                  </div>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        <th style={{ padding: '8px 12px', fontSize: 11, color: '#475569' }}>SIZE LABEL</th>
                        <th style={{ padding: '8px 12px', fontSize: 11, textAlign: 'right', color: '#475569' }}>SELLING RATE ({currency})</th>
                        <th style={{ padding: '8px 12px', fontSize: 11, textAlign: 'center', width: 50 }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.size_rates.map((sr, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>Size {sr.size_label}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              value={sr.selling_rate}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setForm(prev => ({
                                  ...prev,
                                  size_rates: prev.size_rates.map((r, i) => i === idx ? { ...r, selling_rate: val } : r)
                                }));
                              }}
                              style={{ width: 110, textAlign: 'right', padding: '5px 8px', fontWeight: 700, color: 'var(--accent)', borderRadius: 6 }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveSizeRate(sr.size_label)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Custom Size */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Size (e.g. 46, Free Size)"
                  value={newSizeLabel}
                  onChange={e => setNewSizeLabel(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8 }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder={`Rate (${currency})`}
                  value={newSizeRate}
                  onChange={e => setNewSizeRate(e.target.value)}
                  style={{ width: 130, padding: '8px 12px', borderRadius: 8 }}
                />
                <button
                  type="button"
                  onClick={handleAddSizeRate}
                  style={{
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span style={{ color: '#fff', fontWeight: 800 }}>+</span> Add Size
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: MANUFACTURING & LABOUR COST BREAKDOWN */}
          {activeTab === 'manufacturing' && (
            <div style={{
              background: 'var(--white)',
              padding: 24,
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  Manufacturing, Wages &amp; Materials
                </div>
                <span className="badge" style={{ fontSize: 11 }}>
                  Total Specs: {fmt(totalCalculatedMfg)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
                Component costs used in Garment Production Logs, Tailor Settlements, and Costing.
              </div>

              <div className="g3 mb14">
                <div className="field">
                  <label style={labelStyle}>Fabric Cost / pc</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.fabric_cost}
                    onChange={e => setForm({ ...form, fabric_cost: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
                <div className="field">
                  <label style={labelStyle}>Cutting Wage / pc</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.cut_rate}
                    onChange={e => setForm({ ...form, cut_rate: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
                <div className="field">
                  <label style={labelStyle}>Stitching Wage / pc</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.stitch_rate}
                    onChange={e => setForm({ ...form, stitch_rate: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
              </div>

              <div className="g3 mb14">
                <div className="field">
                  <label style={labelStyle}>Logistics / Transport</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.logistics_cost}
                    onChange={e => setForm({ ...form, logistics_cost: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
                <div className="field">
                  <label style={labelStyle}>Lace Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.lace_cost}
                    onChange={e => setForm({ ...form, lace_cost: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
                <div className="field">
                  <label style={labelStyle}>Canvas Material</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.canvas_cost}
                    onChange={e => setForm({ ...form, canvas_cost: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
              </div>

              <div className="g3 mb18">
                <div className="field">
                  <label style={labelStyle}>Plastic Bag / Packaging</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.plastic_cost}
                    onChange={e => setForm({ ...form, plastic_cost: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
                <div className="field">
                  <label style={labelStyle}>Zip / Fastener</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.zip_cost}
                    onChange={e => setForm({ ...form, zip_cost: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
                <div className="field">
                  <label style={labelStyle}>Thread &amp; Needles</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.thread_cost}
                    onChange={e => setForm({ ...form, thread_cost: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 8 }}
                  />
                </div>
              </div>

              <div style={{
                padding: '12px 16px',
                background: 'var(--bg)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Total Calculated Production Cost</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{fmt(totalCalculatedMfg)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, purchase_cost: String(totalCalculatedMfg) })}
                  style={{
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--accent)'
                  }}
                >
                  Sync to Base Cost
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: COMMERCIAL ECONOMICS & MARGINS */}
          {activeTab === 'economics' && (
            <div style={{
              background: 'var(--white)',
              padding: 24,
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                Commercial Economics &amp; Margin Analysis
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
                Live calculation of unit profitability, gross margins, and cost distribution.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>BASE UNIT COST</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                    {fmt(effectiveCost)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    {purchaseCost > 0 ? 'Direct Purchase Cost' : (totalCalculatedMfg > 0 ? 'Manufacturing Breakdown' : 'Cost not set')}
                  </div>
                </div>

                <div style={{ background: 'var(--bg)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>SELLING PRICE</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
                    {fmt(sellingPrice)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    per {form.uom.toUpperCase()}
                  </div>
                </div>

                <div style={{
                  background: grossProfit >= 0 ? 'var(--green-l)' : 'var(--red-l)',
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: `1px solid ${grossProfit >= 0 ? '#bbf7d0' : '#fecaca'}`
                }}>
                  <div style={{ fontSize: 11, color: grossProfit >= 0 ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                    GROSS PROFIT PER UNIT
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: grossProfit >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
                    {fmt(grossProfit)} <span style={{ fontSize: 13, fontWeight: 600 }}>({marginPct}%)</span>
                  </div>
                  <div style={{ fontSize: 10, color: grossProfit >= 0 ? '#166534' : '#991b1b', marginTop: 2 }}>
                    {grossProfit >= 0 ? 'Profitable Margin' : 'Loss-making Unit Rate'}
                  </div>
                </div>
              </div>

              {/* Breakdown Details */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Summary Checklist</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>Tax Rate:</span>
                    <span style={{ fontWeight: 700 }}>{Number(form.tax_rate) > 0 ? `${form.tax_rate}%` : '0%'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>HSN / SAC Code:</span>
                    <span style={{ fontWeight: 700 }}>{form.hsn_code || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>Size Variations:</span>
                    <span style={{ fontWeight: 700 }}>{form.size_rates.length} rates configured</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>Status:</span>
                    <span style={{ fontWeight: 700, color: form.is_active ? 'var(--green)' : 'var(--muted)' }}>
                      {form.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </form>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEW 2: CLEAN CATALOG LIST VIEW (No harsh dark blue cards)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Clean KPI Stat Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
        <div style={{
          background: 'var(--white)',
          padding: '16px 18px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Total Items
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            {items.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {productCount} Products · {serviceCount} Services
          </div>
        </div>

        <div style={{
          background: 'var(--white)',
          padding: '16px 18px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Physical Goods
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
            {productCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Units &amp; Stock Managed
          </div>
        </div>

        <div style={{
          background: 'var(--white)',
          padding: '16px 18px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Services &amp; Labour
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
            {serviceCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Billable hours &amp; jobs
          </div>
        </div>

        {/* Clean Action Card (Warm accent styling instead of harsh dark blue) */}
        <div style={{
          background: 'var(--white)',
          padding: '16px 18px',
          borderRadius: 12,
          border: '1.5px dashed var(--accent)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
            Catalog Quick Action
          </div>
          <button
            type="button"
            onClick={openNewItem}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800 }}>+</span> Add Product / Service
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
      <div style={{
        background: 'var(--white)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        {/* Controls Bar */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="🔍 Search name, SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: 220,
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 12
              }}
            />

            {/* Type Filter Buttons */}
            <div style={{ display: 'flex', background: 'var(--bg)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'product', label: '📦 Products' },
                { id: 'service', label: '💼 Services' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: typeFilter === t.id ? 700 : 500,
                    background: typeFilter === t.id ? 'var(--white)' : 'transparent',
                    color: typeFilter === t.id ? 'var(--accent)' : 'var(--muted)',
                    cursor: 'pointer',
                    boxShadow: typeFilter === t.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* UOM Filter */}
            <select
              value={uomFilter}
              onChange={e => setUomFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
            >
              <option value="all">All Units (UOM)</option>
              {UOM_OPTIONS.map(u => (
                <option key={u.code} value={u.code}>{u.label} ({u.code.toUpperCase()})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Showing <strong>{filtered.length}</strong> of {items.length} items
            </span>
            <button
              type="button"
              onClick={openNewItem}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span style={{ color: '#fff', fontWeight: 800 }}>+</span> Add Item
            </button>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>⏳</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Loading items catalog...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No items found</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, marginBottom: 14 }}>
              {search || typeFilter !== 'all' || uomFilter !== 'all' ? 'Try adjusting your search filters' : 'Start by adding your first product or billable service'}
            </div>
            <button
              type="button"
              onClick={openNewItem}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ➕ Add First Item
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569' }}>ITEM &amp; CODE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569' }}>TYPE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569' }}>UOM</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#475569' }}>SELLING PRICE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#475569' }}>COST / BASE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569' }}>TAX %</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569' }}>SPECS &amp; SIZES</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#475569' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const isService = item.item_type === 'service';
                  const uomCode = (item.uom || 'pcs').toUpperCase();
                  const totalMfg = Number(item.fabric_cost || 0) + Number(item.cut_rate || 0) + Number(item.stitch_rate || 0) + Number(item.logistics_cost || 0);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.12s ease',
                        opacity: item.is_active ? 1 : 0.6
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(244, 246, 251, 0.6)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Name & SKU */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                          {item.display_name || item.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                          {item.item_code && <span>SKU: <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 4 }}>{item.item_code}</code></span>}
                          <span>Code: <code>{item.category}</code></span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: isService ? 'var(--cyan-l)' : 'var(--accent-l)',
                          color: isService ? 'var(--cyan)' : 'var(--accent)'
                        }}>
                          {isService ? '💼 Service' : '📦 Product'}
                        </span>
                      </td>

                      {/* Unit (UOM) */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)'
                        }}>
                          {uomCode}
                        </span>
                      </td>

                      {/* Selling Price */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--accent)' }}>
                          {fmt(item.selling_rate)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>per {uomCode}</div>
                      </td>

                      {/* Cost */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                          {Number(item.purchase_cost) > 0 ? fmt(item.purchase_cost) : (totalMfg > 0 ? fmt(totalMfg) : '—')}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {totalMfg > 0 && !Number(item.purchase_cost) ? 'Mfg breakdown' : 'Base cost'}
                        </div>
                      </td>

                      {/* Tax % */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: Number(item.tax_rate) > 0 ? 'var(--yellow-l)' : 'var(--bg)',
                          color: Number(item.tax_rate) > 0 ? 'var(--yellow)' : 'var(--muted)'
                        }}>
                          {Number(item.tax_rate) > 0 ? `${item.tax_rate}%` : '0%'}
                        </span>
                      </td>

                      {/* Variations & Specs */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {item.size_rates && item.size_rates.length > 0 && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              background: 'var(--green-l)',
                              color: 'var(--green)',
                              padding: '2px 6px',
                              borderRadius: 6
                            }}>
                              📏 {item.size_rates.length} sizes
                            </span>
                          )}
                          {totalMfg > 0 && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              padding: '2px 6px',
                              borderRadius: 6
                            }}>
                              🧵 Labour specs
                            </span>
                          )}
                          {!item.size_rates?.length && totalMfg === 0 && (
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Standard</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => openEditItem(item)}
                            style={{
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              padding: '4px 9px',
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--text)',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            style={{
                              background: 'none',
                              border: '1px solid #fee2e2',
                              borderRadius: 6,
                              padding: '4px 7px',
                              fontSize: 11,
                              color: 'var(--red)',
                              cursor: 'pointer'
                            }}
                            title="Delete item"
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
