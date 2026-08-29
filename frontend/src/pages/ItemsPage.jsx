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
  const [viewLayout, setViewLayout] = useState('table'); // 'table' | 'cards'
  const [msg, setMsg] = useState(null);

  // Form & view state
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'form'
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'pricing' | 'sizes' | 'manufacturing'
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
    { code: 'pcs', label: 'Pieces', icon: '👕', desc: 'Standard unit' },
    { code: 'box', label: 'Boxes', icon: '📦', desc: 'Carton/Pack' },
    { code: 'kg',  label: 'Kilograms', icon: '⚖️', desc: 'Weight' },
    { code: 'mtr', label: 'Meters', icon: '📏', desc: 'Fabric/Length' },
    { code: 'set', label: 'Sets', icon: '🗂️', desc: 'Bundles' },
    { code: 'pkt', label: 'Packets', icon: '🛍️', desc: 'Pouches' },
    { code: 'hrs', label: 'Hours', icon: '⏱️', desc: 'Labour/Time' },
    { code: 'ltr', label: 'Liters', icon: '🧴', desc: 'Liquids/Chemicals' },
    { code: 'dzn', label: 'Dozens', icon: '🔢', desc: '12 pcs batch' },
    { code: 'sqft', label: 'Sq. Feet', icon: '📐', desc: 'Area measurement' },
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
      alert(`Size variation '${label}' is already added.`);
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
      alert('Please provide a valid item name.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && form.id) {
        await api.put(`/items/${form.id}`, form);
        setMsg({ type: 'success', text: `Item '${form.name}' updated successfully.` });
      } else {
        await api.post('/items', form);
        setMsg({ type: 'success', text: `Item '${form.name}' added to catalog.` });
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
    if (!window.confirm(`Are you sure you want to remove "${item.display_name || item.name}" from your catalog?`)) return;
    try {
      await api.delete(`/items/${item.id}`);
      setMsg({ type: 'success', text: `Item '${item.display_name || item.name}' removed.` });
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

  // Live calculations for form
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

  // ═══════════════════════════════════════════════════════════════
  // VIEW 1: PREMIUM FULL-PAGE ITEM EDITOR
  // ═══════════════════════════════════════════════════════════════
  if (viewMode === 'form') {
    return (
      <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 40 }}>
        {/* Top Header Bar */}
        <div style={{
          background: 'var(--white)',
          padding: '16px 24px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>←</span> Catalog
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  {isEditing ? `Edit: ${form.name || form.category}` : 'Create New Catalog Item'}
                </h1>
                <span className={`badge ${form.is_active ? 'b-green' : ''}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                  {form.is_active ? '● Active' : '○ Inactive'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Configure item attributes, unit measurements, commercial rates, and labour specs
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
                padding: '8px 16px',
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
                padding: '9px 24px',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
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
          marginBottom: 20,
          background: 'var(--white)',
          padding: 6,
          borderRadius: 10,
          border: '1px solid var(--border)',
          width: 'fit-content'
        }}>
          {[
            { id: 'basic', label: '1. Basic & Unit (UOM)', icon: '🏷️' },
            { id: 'pricing', label: '2. Pricing & Commercials', icon: '💰' },
            { id: 'sizes', label: `3. Size Rates (${form.size_rates.length})`, icon: '📏' },
            { id: 'manufacturing', label: '4. Manufacturing & Labour', icon: '🧵' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 7,
                border: 'none',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 700 : 500,
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Main Grid Workspace */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.85fr) minmax(0, 1.15fr)', gap: 24, alignItems: 'start' }}>
          {/* LEFT COLUMN: TAB CONTENT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* ── TAB 1: BASIC IDENTIFICATION & UOM ── */}
            {activeTab === 'basic' && (
              <div style={{
                background: 'var(--white)',
                padding: 24,
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  Item Identification &amp; Category
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
                  Define what you are selling and choose the primary unit of measurement.
                </div>

                <div className="field mb16">
                  <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Product / Item Name <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shawl Nighty, 5W-30 Synthetic Engine Oil, Maintenance Service"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}
                  />
                </div>

                {/* Item Type Selector Card Buttons */}
                <div className="field mb20">
                  <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Item Classification</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div
                      onClick={() => setForm({ ...form, item_type: 'product' })}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: `2px solid ${form.item_type === 'product' ? 'var(--accent)' : 'var(--border)'}`,
                        background: form.item_type === 'product' ? 'var(--accent-l)' : 'var(--bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontSize: 24 }}>📦</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: form.item_type === 'product' ? 'var(--accent)' : 'var(--text)' }}>
                          Physical Product
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          Tangible inventory, tracked with stock &amp; UOM
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setForm({ ...form, item_type: 'service' })}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: `2px solid ${form.item_type === 'service' ? 'var(--accent)' : 'var(--border)'}`,
                        background: form.item_type === 'service' ? 'var(--accent-l)' : 'var(--bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontSize: 24 }}>💼</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: form.item_type === 'service' ? 'var(--accent)' : 'var(--text)' }}>
                          Service / Labour
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          Non-inventory billable hours, fees, or jobs
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SKU Code & Status */}
                <div className="g2 mb20">
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Item Code / SKU / Barcode</label>
                    <input
                      type="text"
                      placeholder="e.g. SKU-101, ART-04"
                      value={form.item_code}
                      onChange={e => setForm({ ...form, item_code: e.target.value })}
                      style={{ padding: '9px 12px', borderRadius: 8 }}
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Active Status</label>
                    <div
                      onClick={() => setForm({ ...form, is_active: !form.is_active })}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {form.is_active ? '✅ Active in Sales &amp; Invoices' : '⏸️ Inactive (Archived)'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Click to toggle</span>
                    </div>
                  </div>
                </div>

                {/* Visual Unit of Measure (UOM) Selector Grid */}
                <div className="field mb16">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                      Unit of Measure (UOM) <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Selected: <strong>{form.uom.toUpperCase()}</strong></span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: 8,
                    marginBottom: 12
                  }}>
                    {UOM_OPTIONS.map(u => {
                      const isSelected = form.uom === u.code;
                      return (
                        <div
                          key={u.code}
                          onClick={() => setForm({ ...form, uom: u.code })}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            background: isSelected ? 'var(--accent-l)' : 'var(--bg)',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>{u.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                              {u.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: isSelected ? 'var(--accent)' : 'var(--muted)' }}>
                            {u.code.toUpperCase()} · {u.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Description &amp; Specifications</label>
                  <textarea
                    rows={3}
                    placeholder="Optional item details, fabric composition, packaging info, or customer notes..."
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    style={{ borderRadius: 8, padding: '10px 12px' }}
                  />
                </div>
              </div>
            )}

            {/* ── TAB 2: PRICING, TAXES & COMMERCIALS ── */}
            {activeTab === 'pricing' && (
              <div style={{
                background: 'var(--white)',
                padding: 24,
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  Commercial Pricing &amp; Tax Structure
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
                  Define base selling price, purchase cost, tax percentage, and legal codes.
                </div>

                <div className="g3 mb20">
                  <div className="field">
                    <label style={{ fontSize: 13, fontWeight: 700 }}>
                      Selling Price ({currency}) <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.selling_rate}
                      onChange={e => setForm({ ...form, selling_rate: e.target.value })}
                      required
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: 'var(--accent)',
                        padding: '10px 14px',
                        borderRadius: 8
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Default rate per {form.uom.toUpperCase()}</div>
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 13, fontWeight: 700 }}>
                      Purchase / Base Cost ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.purchase_cost}
                      onChange={e => setForm({ ...form, purchase_cost: e.target.value })}
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        padding: '10px 14px',
                        borderRadius: 8
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Cost incurred per unit</div>
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 13, fontWeight: 700 }}>
                      Tax / VAT Rate %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 15, 5, 0"
                      value={form.tax_rate}
                      onChange={e => setForm({ ...form, tax_rate: e.target.value })}
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        padding: '10px 14px',
                        borderRadius: 8
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>e.g. 15% (KSA) or 5%/12% (IN)</div>
                  </div>
                </div>

                <div className="g2">
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>HSN / SAC / Commodity Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 620822 (Garments), 9983 (IT Services)"
                      value={form.hsn_code}
                      onChange={e => setForm({ ...form, hsn_code: e.target.value })}
                      style={{ padding: '9px 12px', borderRadius: 8 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Printed on official GST and Saudi ZATCA invoices</div>
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Internal System Key</label>
                    <input
                      type="text"
                      placeholder="Auto-generated identifier"
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      style={{ padding: '9px 12px', borderRadius: 8 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Database category key (e.g. <code>shawl_nighty</code>)</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: SIZE & VARIATION RATES ── */}
            {activeTab === 'sizes' && (
              <div style={{
                background: 'var(--white)',
                padding: 24,
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    Size &amp; Variant Pricing
                  </div>
                  <span className="badge b-green" style={{ fontSize: 11 }}>
                    {form.size_rates.length} custom rates defined
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
                  Override the default selling rate for specific sizes (e.g., Size 44 or XXL).
                </div>

                {/* Preset Quick-Add Buttons */}
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>⚡ Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickAddSizes('alpha')}
                    style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + S, M, L, XL, XXL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddSizes('numeric')}
                    style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + 38, 40, 42, 44
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddSizes('free')}
                    style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Free Size
                  </button>
                </div>

                {/* Size Table */}
                {form.size_rates.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--border)', marginBottom: 16 }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📏</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>No size-specific rates configured</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      The default rate ({fmt(form.selling_rate || 0)}) will apply to all sizes.
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg)' }}>
                          <th style={{ padding: '10px 14px', fontSize: 12 }}>Size Label</th>
                          <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right' }}>Selling Rate ({currency})</th>
                          <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', width: 60 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.size_rates.map((sr, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                              Size {sr.size_label}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
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
                                style={{
                                  width: 120,
                                  textAlign: 'right',
                                  padding: '6px 10px',
                                  fontWeight: 700,
                                  color: 'var(--accent)',
                                  borderRadius: 6
                                }}
                              />
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveSizeRate(sr.size_label)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--red)',
                                  cursor: 'pointer',
                                  fontSize: 13
                                }}
                                title="Remove size"
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

                {/* Add Size Input Form */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="New Size (e.g. 46, Jumbo, Custom)"
                    value={newSizeLabel}
                    onChange={e => setNewSizeLabel(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 8 }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Rate (${currency})`}
                    value={newSizeRate}
                    onChange={e => setNewSizeRate(e.target.value)}
                    style={{ width: 140, padding: '9px 12px', borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSizeRate}
                    style={{
                      background: 'var(--accent)',
                      border: 'none',
                      color: '#fff',
                      padding: '9px 16px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    ➕ Add Size
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB 4: MANUFACTURING & LABOUR COST BREAKDOWN ── */}
            {activeTab === 'manufacturing' && (
              <div style={{
                background: 'var(--white)',
                padding: 24,
                borderRadius: 12,
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    Manufacturing, Labour &amp; Piece-Rate Wages
                  </div>
                  <span className="badge" style={{ fontSize: 11 }}>
                    Calculated Total: {fmt(totalCalculatedMfg)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
                  Used across Production Logs, Tailor Stitching Wage Settlements, and Real-time Profit Reports.
                </div>

                <div className="g3 mb16">
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Fabric Cost / pc</label>
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
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Cutting Wage / pc</label>
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
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Stitching Wage / pc</label>
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

                <div className="g3 mb16">
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Logistics / Delivery</label>
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
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Lace Cost</label>
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
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Canvas Material</label>
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

                <div className="g3 mb20">
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Plastic Bag / Packaging</label>
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
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Zip / Fastener</label>
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
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Thread &amp; Needles</label>
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
                  padding: '14px 18px',
                  background: 'var(--bg)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Total Calculated Production Cost</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{fmt(totalCalculatedMfg)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, purchase_cost: String(totalCalculatedMfg) })}
                    style={{
                      background: 'var(--white)',
                      border: '1px solid var(--border)',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: 'var(--accent)'
                    }}
                  >
                    Sync to Base Cost
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: REAL-TIME PROFIT & SPEC SUMMARY CARD */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live Profit Card */}
            <div style={{
              background: 'var(--white)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              padding: 20,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                  📊 Commercial Economics
                </span>
                <span className="badge" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                  {form.uom}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Base Cost</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                    {fmt(effectiveCost)}
                  </div>
                </div>

                <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Selling Price</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
                    {fmt(sellingPrice)}
                  </div>
                </div>
              </div>

              {/* Profit Indicator Bar */}
              <div style={{
                background: grossProfit >= 0 ? 'var(--green-l)' : 'var(--red-l)',
                border: `1px solid ${grossProfit >= 0 ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: grossProfit >= 0 ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                      ESTIMATED GROSS MARGIN
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: grossProfit >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                      {fmt(grossProfit)} <span style={{ fontSize: 13, fontWeight: 600 }}>({marginPct}%)</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 24 }}>
                    {grossProfit >= 0 ? '📈' : '📉'}
                  </div>
                </div>
              </div>

              {/* Checklist details */}
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Tax Rate:</span>
                  <span style={{ fontWeight: 700 }}>{Number(form.tax_rate) > 0 ? `${form.tax_rate}%` : '0% (Exempt)'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>HSN / SAC Code:</span>
                  <span style={{ fontWeight: 700 }}>{form.hsn_code || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Size Variations:</span>
                  <span style={{ fontWeight: 700 }}>{form.size_rates.length} rates</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div style={{
              background: 'var(--white)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              padding: 16
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
                STEPS TO COMPLETE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('basic')}
                  style={{
                    background: activeTab === 'basic' ? 'var(--bg)' : 'transparent',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: 6,
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: form.name ? 'var(--green)' : 'var(--text)'
                  }}
                >
                  {form.name ? '✓ 1. Name & UOM set' : '○ 1. Enter Product Name & UOM'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  style={{
                    background: activeTab === 'pricing' ? 'var(--bg)' : 'transparent',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: 6,
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: sellingPrice > 0 ? 'var(--green)' : 'var(--text)'
                  }}
                >
                  {sellingPrice > 0 ? '✓ 2. Commercial pricing set' : '○ 2. Set Selling Rate'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sizes')}
                  style={{
                    background: activeTab === 'sizes' ? 'var(--bg)' : 'transparent',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: 6,
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  3. Size variations ({form.size_rates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('manufacturing')}
                  style={{
                    background: activeTab === 'manufacturing' ? 'var(--bg)' : 'transparent',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: 6,
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  4. Manufacturing &amp; Labour Wages
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEW 2: PREMIUM CATALOG LIST VIEW
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Top Banner & KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{
          background: 'var(--white)',
          padding: '18px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Total Catalog Items
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            {items.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {productCount} Products · {serviceCount} Services
          </div>
        </div>

        <div style={{
          background: 'var(--white)',
          padding: '18px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Physical Goods
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
            {productCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Tracked with UOM &amp; Variants
          </div>
        </div>

        <div style={{
          background: 'var(--white)',
          padding: '18px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Services &amp; Labour
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
            {serviceCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Billable hours &amp; jobs
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, var(--accent), #3730a3)',
          padding: '18px 20px',
          borderRadius: 12,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 16px rgba(79, 70, 229, 0.25)'
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', opacity: 0.85 }}>
              Universal Master
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
              Add New Product or Service
            </div>
          </div>
          <button
            type="button"
            onClick={openNewItem}
            style={{
              background: '#fff',
              color: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              marginTop: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            ➕ Create Item
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
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        {/* Controls Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Search name, SKU, code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: 260,
                  padding: '8px 12px 8px 30px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 13
                }}
              />
              <span style={{ position: 'absolute', left: 10, top: 9, fontSize: 13, color: 'var(--muted)' }}>🔍</span>
            </div>

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
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: typeFilter === t.id ? 700 : 500,
                    background: typeFilter === t.id ? 'var(--white)' : 'transparent',
                    color: typeFilter === t.id ? 'var(--accent)' : 'var(--muted)',
                    cursor: 'pointer',
                    boxShadow: typeFilter === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
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
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
            >
              <option value="all">All Units (UOM)</option>
              {UOM_OPTIONS.map(u => (
                <option key={u.code} value={u.code}>{u.label} ({u.code.toUpperCase()})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                padding: '7px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ➕ Add Product / Service
            </button>
          </div>
        </div>

        {/* Content Table / Cards */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <div style={{ fontWeight: 600 }}>Loading items catalog...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>No items found</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, marginBottom: 16 }}>
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
                padding: '9px 20px',
                fontSize: 13,
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
                  <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>ITEM &amp; CODE</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>TYPE</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>UOM</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>SELLING PRICE</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>COST / BASE</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>TAX %</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>SPECS &amp; SIZES</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>ACTIONS</th>
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
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                          {item.display_name || item.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                          {item.item_code && <span>SKU: <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>{item.item_code}</code></span>}
                          <span>Code: <code>{item.category}</code></span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '14px 14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: isService ? 'var(--cyan-l)' : 'var(--accent-l)',
                          color: isService ? 'var(--cyan)' : 'var(--accent)'
                        }}>
                          {isService ? '💼 Service' : '📦 Product'}
                        </span>
                      </td>

                      {/* Unit (UOM) */}
                      <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: 6,
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)'
                        }}>
                          {uomCode}
                        </span>
                      </td>

                      {/* Selling Price */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>
                          {fmt(item.selling_rate)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>per {uomCode}</div>
                      </td>

                      {/* Cost */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {Number(item.purchase_cost) > 0 ? fmt(item.purchase_cost) : (totalMfg > 0 ? fmt(totalMfg) : '—')}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {totalMfg > 0 && !Number(item.purchase_cost) ? 'Mfg breakdown' : 'Base cost'}
                        </div>
                      </td>

                      {/* Tax % */}
                      <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: Number(item.tax_rate) > 0 ? 'var(--yellow-l)' : 'var(--bg)',
                          color: Number(item.tax_rate) > 0 ? 'var(--yellow)' : 'var(--muted)'
                        }}>
                          {Number(item.tax_rate) > 0 ? `${item.tax_rate}%` : '0%'}
                        </span>
                      </td>

                      {/* Variations & Specs */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {item.size_rates && item.size_rates.length > 0 && (
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'var(--green-l)',
                              color: 'var(--green)',
                              padding: '2px 7px',
                              borderRadius: 6
                            }}>
                              📏 {item.size_rates.length} sizes
                            </span>
                          )}
                          {totalMfg > 0 && (
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              padding: '2px 7px',
                              borderRadius: 6
                            }}>
                              🧵 Labour specs
                            </span>
                          )}
                          {!item.size_rates?.length && totalMfg === 0 && (
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Standard</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => openEditItem(item)}
                            style={{
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 12,
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
                              padding: '5px 8px',
                              fontSize: 12,
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
