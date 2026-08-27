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

  // Modal states
  const [editItem, setEditItem] = useState(null); // null = closed, {} = new, item object = editing
  const [isEditing, setIsEditing] = useState(false);
  const [showManufacturing, setShowManufacturing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    category: '',
    item_code: '',
    item_type: 'product',
    uom: 'pcs',
    selling_rate: '',
    purchase_cost: '',
    tax_rate: '0',
    hsn_code: '',
    description: '',
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
  });

  const [newSizeLabel, setNewSizeLabel] = useState('');
  const [newSizeRate, setNewSizeRate] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/items?all=1'),
      api.get('/items/uoms').catch(() => ({ data: [] }))
    ]).then(([itemsRes, uomsRes]) => {
      setItems(itemsRes.data);
      setUoms(uomsRes.data);
    }).catch(err => {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load items.' });
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewItem = () => {
    setIsEditing(false);
    setShowManufacturing(user?.modules?.feature_garment_production ?? false);
    setForm({
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
    });
    setNewSizeLabel('');
    setNewSizeRate('');
    setEditItem({});
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
    setEditItem(item);
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
    e.preventDefault();
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
      setEditItem(null);
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
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Tracked with UOM &amp; Inventory</div>
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
              style={{ width: 240, padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
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

          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Showing {filtered.length} of {items.length} items
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center' }} className="spinner">Loading products &amp; services...</div>
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
                  const totalMfgCost = Number(item.fabric_cost || 0) + Number(item.cut_rate || 0) + Number(item.stitch_rate || 0) + Number(item.logistics_cost || 0);

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
                        {Number(item.purchase_cost) > 0 ? fmt(item.purchase_cost) : (totalMfgCost > 0 ? fmt(totalMfgCost) : '—')}
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
                          {totalMfgCost > 0 && (
                            <span className="badge" style={{ fontSize: 10 }}>
                              Labour/Mfg: {fmt(totalMfgCost)}
                            </span>
                          )}
                          {!item.size_rates?.length && totalMfgCost === 0 && (
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

      {/* ── CREATE / EDIT ITEM MODAL ── */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal" style={{ maxWidth: 620, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                {isEditing ? `Edit Item — ${form.name || form.category}` : 'Add New Product / Service'}
              </h2>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem}>
              {/* Basic Details */}
              <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.5, marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                1. Item Identification &amp; Unit
              </div>

              <div className="g2" style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Shawl Nighty, Engine Oil, IT Support"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Item Code / SKU (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. SKU-101, ART-04"
                    value={form.item_code}
                    onChange={e => setForm({ ...form, item_code: e.target.value })}
                  />
                </div>
              </div>

              <div className="g3" style={{ marginBottom: 16 }}>
                <div className="field">
                  <label>Item Type</label>
                  <select
                    value={form.item_type}
                    onChange={e => setForm({ ...form, item_type: e.target.value })}
                  >
                    <option value="product">📦 Physical Product</option>
                    <option value="service">💼 Service / Labour</option>
                  </select>
                </div>
                <div className="field">
                  <label>Unit of Measure (UOM) *</label>
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
                  <label>Tax / VAT %</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 15, 5, 0"
                    value={form.tax_rate}
                    onChange={e => setForm({ ...form, tax_rate: e.target.value })}
                  />
                </div>
              </div>

              {/* Commercial Pricing */}
              <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.5, marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                2. Pricing &amp; Commercials
              </div>

              <div className="g3" style={{ marginBottom: 16 }}>
                <div className="field">
                  <label>Selling Rate ({currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.selling_rate}
                    onChange={e => setForm({ ...form, selling_rate: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Cost / Purchase ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.purchase_cost}
                    onChange={e => setForm({ ...form, purchase_cost: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>HSN / SAC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 620822, 9983"
                    value={form.hsn_code}
                    onChange={e => setForm({ ...form, hsn_code: e.target.value })}
                  />
                </div>
              </div>

              {/* Size Rates section */}
              <div style={{ marginBottom: 16, background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>📏 Size-Specific Selling Rates (Optional)</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Overrides default selling rate per size</span>
                </div>

                {form.size_rates.map((sr, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{sr.size_label}</div>
                    <input
                      type="number"
                      step="0.01"
                      style={{ width: 110, padding: '4px 8px', fontSize: 12, textAlign: 'right' }}
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

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Size (e.g. S, 38, Free Size)"
                    style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                    value={newSizeLabel}
                    onChange={e => setNewSizeLabel(e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Rate (${currency})`}
                    style={{ width: 110, padding: '4px 8px', fontSize: 12 }}
                    value={newSizeRate}
                    onChange={e => setNewSizeRate(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11 }}
                    onClick={handleAddSizeRate}
                  >
                    ➕ Add Size
                  </button>
                </div>
              </div>

              {/* Manufacturing & Labour Breakdown (Expandable) */}
              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowManufacturing(!showManufacturing)}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: '1px dashed var(--border)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>🧵 Manufacturing, Cutting &amp; Stitching Breakdown</span>
                  <span>{showManufacturing ? '▲ Collapse' : '▼ Expand'}</span>
                </button>

                {showManufacturing && (
                  <div style={{ marginTop: 10, padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div className="g3" style={{ marginBottom: 8 }}>
                      <div className="field">
                        <label>Fabric Cost / pc</label>
                        <input type="number" step="0.01" value={form.fabric_cost} onChange={e => setForm({ ...form, fabric_cost: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Cutting Rate (Wages)</label>
                        <input type="number" step="0.01" value={form.cut_rate} onChange={e => setForm({ ...form, cut_rate: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Stitching Rate (Wages)</label>
                        <input type="number" step="0.01" value={form.stitch_rate} onChange={e => setForm({ ...form, stitch_rate: e.target.value })} />
                      </div>
                    </div>
                    <div className="g3">
                      <div className="field">
                        <label>Logistics Cost</label>
                        <input type="number" step="0.01" value={form.logistics_cost} onChange={e => setForm({ ...form, logistics_cost: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Lace Cost</label>
                        <input type="number" step="0.01" value={form.lace_cost} onChange={e => setForm({ ...form, lace_cost: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Canvas / Accessories</label>
                        <input type="number" step="0.01" value={form.canvas_cost} onChange={e => setForm({ ...form, canvas_cost: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (isEditing ? 'Update Item' : 'Create Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
