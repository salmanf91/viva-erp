import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { useDebounce } from '../hooks/useDebounce';
import Pagination from '../components/Pagination';
import { exportToCSV } from '../utils/csvExport';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const pct = n => (Number(n) > 0 ? '+' : '') + Number(n || 0).toFixed(1) + '%';

export default function CatalogAdminPage() {
  const { user } = useAuth();
  const isVivaStudio = !user?.tenant_id || user?.tenant_id === 1 || user?.tenant_slug === 'viva_studio' || (user?.tenant_name || '').toLowerCase().includes('viva');

  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [categories, setCategories] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 300);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [copiedTier, setCopiedTier] = useState(null);

  const loadData = async (targetPage = page, targetLimit = limit) => {
    setLoading(true);
    try {
      const res = await api.get('/catalog', {
        params: {
          page: targetPage,
          limit: targetLimit,
          search: debouncedSearch,
          category: selectedCat,
          status: statusFilter,
        }
      });
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
      if (res.data.categories) {
        setCategories(res.data.categories);
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCat, statusFilter]);

  useEffect(() => {
    loadData(page, limit);
  }, [page, limit, debouncedSearch, selectedCat, statusFilter]);

  const handleExport = () => {
    const filename = `Product_Catalog_Pricing_${new Date().toISOString().slice(0, 10)}`;
    const headers = [
      'Design / Product',
      'Code',
      'Category',
      'Product Cost',
      'Expense',
      'Total Cost',
      'Wholesale Rate',
      'Wholesale Margin (₹)',
      'Retail Vendor Rate',
      'Retail Vendor Margin (₹)',
      'Retail Customer Rate',
      'Retail Customer Margin (₹)',
      ...(isVivaStudio ? ['UAE Vendor Rate (AED)', 'UAE Vendor Margin (AED)'] : []),
      'Status'
    ];
    const rows = data.map(item => [
      item.name,
      item.item_code || '',
      item.category || '',
      item.product_cost,
      item.expense,
      item.total_cost,
      item.wholesale_rate,
      item.wholesale_margin,
      item.retail_vendor_rate,
      item.retail_vendor_margin,
      item.retail_customer_rate,
      item.retail_customer_margin,
      ...(isVivaStudio ? [item.uae_vendor_rate || 0, item.uae_vendor_margin || 0] : []),
      item.is_active ? 'Active' : 'Hidden'
    ]);
    exportToCSV(filename, headers, rows);
  };

  const copyPublicLink = (type) => {
    const origin = window.location.origin;
    const url = `${origin}/catalog/${type}`;
    navigator.clipboard.writeText(url);
    setCopiedTier(type);
    setTimeout(() => setCopiedTier(null), 2500);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete design "${name}"?`)) return;
    try {
      await api.delete(`/catalog/${id}`);
      loadData(page, limit);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete product');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner & Quick Share Bar */}
      <div className="card" style={{ padding: '18px 22px', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: '#fff', border: 'none', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🏷️</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Product Catalog &amp; Rate Master</h2>
                <div style={{ fontSize: 12, color: '#c7d2fe', marginTop: 2 }}>
                  Set design rates, upload photos, and share dedicated catalog links for each customer &amp; vendor tier.
                </div>
              </div>
            </div>
          </div>

          {/* Quick Share Links */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Wholesale */}
            <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.25)' }}>
              <Link
                to="/catalog/wholesale"
                target="_blank"
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 0, textDecoration: 'none' }}
                title="Open Wholesale Catalog in new tab"
              >
                🏢 Wholesale ↗
              </Link>
              <button
                onClick={() => copyPublicLink('wholesale')}
                className="btn btn-sm"
                style={{ background: copiedTier === 'wholesale' ? '#10b981' : 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', borderRadius: 0 }}
                title="Copy Wholesale Link"
              >
                {copiedTier === 'wholesale' ? '✓' : '📋'}
              </button>
            </div>

            {/* Retail Vendor */}
            <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.25)' }}>
              <Link
                to="/catalog/retail-vendor"
                target="_blank"
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 0, textDecoration: 'none' }}
                title="Open Retail Vendor Catalog in new tab"
              >
                🏪 Retail Vendor ↗
              </Link>
              <button
                onClick={() => copyPublicLink('retail-vendor')}
                className="btn btn-sm"
                style={{ background: copiedTier === 'retail-vendor' ? '#10b981' : 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', borderRadius: 0 }}
                title="Copy Retail Vendor Link"
              >
                {copiedTier === 'retail-vendor' ? '✓' : '📋'}
              </button>
            </div>

            {/* Retail Customer */}
            <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.25)' }}>
              <Link
                to="/catalog/retail-customer"
                target="_blank"
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 0, textDecoration: 'none' }}
                title="Open Retail Customer Catalog in new tab"
              >
                🛍️ Retail / E-Com ↗
              </Link>
              <button
                onClick={() => copyPublicLink('retail-customer')}
                className="btn btn-sm"
                style={{ background: copiedTier === 'retail-customer' ? '#10b981' : 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', borderRadius: 0 }}
                title="Copy Retail Customer Link"
              >
                {copiedTier === 'retail-customer' ? '✓' : '📋'}
              </button>
            </div>

            {/* UAE Vendor */}
            {isVivaStudio && (
              <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #10b981' }}>
                <Link
                  to="/catalog/uae-vendor"
                  target="_blank"
                  className="btn btn-sm"
                  style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 0, textDecoration: 'none', fontWeight: 700 }}
                  title="Open UAE Vendor Catalog in new tab (Dirhams)"
                >
                  🇦🇪 UAE Vendor ↗
                </Link>
                <button
                  onClick={() => copyPublicLink('uae-vendor')}
                  className="btn btn-sm"
                  style={{ background: copiedTier === 'uae-vendor' ? '#10b981' : '#047857', color: '#fff', border: 'none', borderRadius: 0 }}
                  title="Copy UAE Vendor Link"
                >
                  {copiedTier === 'uae-vendor' ? '✓' : '📋'}
                </button>
              </div>
            )}

            <button
              onClick={() => { setEditItem(null); setShowModal(true); }}
              className="btn btn-sm"
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700 }}
            >
              + Add Design / Product
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              type="text"
              placeholder="Search design name, SKU code, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)' }}
            />
          </div>

          <div style={{ minWidth: 150 }}>
            <select
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)' }}
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 120 }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)' }}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Hidden Only</option>
            </select>
          </div>

          <button onClick={handleExport} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📥 Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ width: 64, textAlign: 'center', padding: '10px 8px' }}>Photo</th>
                <th style={{ padding: '10px 12px' }}>Design &amp; SKU</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Cost</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Expense</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', background: '#f8fafc', fontWeight: 700 }}>Total Cost</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Wholesale</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Retail Vendor</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Retail / E-Com</th>
                {isVivaStudio && (
                  <th style={{ textAlign: 'right', padding: '10px 12px', background: '#ecfdf5', color: '#065f46' }}>
                    🇦🇪 UAE Vendor (AED)
                  </th>
                )}
                <th style={{ textAlign: 'center', padding: '10px 8px' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '10px 8px', width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isVivaStudio ? 12 : 11} style={{ textAlign: 'center', padding: 36, color: 'var(--muted)' }}>
                    Loading catalog products…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={isVivaStudio ? 12 : 11} style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
                    <div style={{ fontWeight: 600 }}>No products found</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Click <b>"+ Add Design / Product"</b> above to add designs, upload photos, and set vendor rates.
                    </div>
                  </td>
                </tr>
              ) : (
                data.map(item => {
                  const totalCost = Number(item.total_cost || 0);
                  const wsMargin = Number(item.wholesale_margin || 0);
                  const wsPct = totalCost > 0 ? (wsMargin / totalCost) * 100 : 0;

                  const rvMargin = Number(item.retail_vendor_margin || 0);
                  const rvPct = totalCost > 0 ? (rvMargin / totalCost) * 100 : 0;

                  const rcMargin = Number(item.retail_customer_margin || 0);
                  const rcPct = totalCost > 0 ? (rcMargin / totalCost) * 100 : 0;

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      {/* Image Thumbnail */}
                      <td style={{ textAlign: 'center', padding: '8px' }}>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            onClick={() => setLightboxImg(item.image_url)}
                            style={{
                              width: 44, height: 44, objectFit: 'cover', borderRadius: 6,
                              border: '1px solid var(--border)', cursor: 'pointer', transition: 'transform 0.15s'
                            }}
                            title="Click to view full photo"
                          />
                        ) : (
                          <div style={{
                            width: 44, height: 44, borderRadius: 6, background: '#f1f5f9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, color: '#94a3b8', margin: '0 auto'
                          }}>
                            🖼️
                          </div>
                        )}
                      </td>

                      {/* Product Name & SKU */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{item.name}</div>
                        {item.item_code && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            SKU: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.item_code}</span>
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: 'var(--surface)', border: '1px solid var(--border)'
                        }}>
                          {item.category || 'General'}
                        </span>
                      </td>

                      {/* Cost */}
                      <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)' }}>
                        {fmt(item.product_cost)}
                      </td>

                      {/* Expense */}
                      <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)' }}>
                        {fmt(item.expense)}
                      </td>

                      {/* Total Cost */}
                      <td style={{ textAlign: 'right', padding: '10px 12px', background: '#f8fafc', fontWeight: 700 }}>
                        {fmt(totalCost)}
                      </td>

                      {/* Wholesale Rate */}
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#0369a1' }}>{fmt(item.wholesale_rate)}</div>
                        <div style={{ fontSize: 10, color: wsMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                          Margin: {fmt(wsMargin)} ({pct(wsPct)})
                        </div>
                      </td>

                      {/* Retail Vendor Rate */}
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#4338ca' }}>{fmt(item.retail_vendor_rate)}</div>
                        <div style={{ fontSize: 10, color: rvMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                          Margin: {fmt(rvMargin)} ({pct(rvPct)})
                        </div>
                      </td>

                      {/* Retail Customer Rate */}
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#b45309' }}>{fmt(item.retail_customer_rate)}</div>
                        <div style={{ fontSize: 10, color: rcMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                          Margin: {fmt(rcMargin)} ({pct(rcPct)})
                        </div>
                      </td>

                      {/* UAE Vendor Rate */}
                      {isVivaStudio && (
                        <td style={{ textAlign: 'right', padding: '10px 12px', background: '#f0fdf4' }}>
                          <div style={{ fontWeight: 800, color: '#047857' }}>
                            {Number(item.uae_vendor_rate) > 0 ? `AED ${Number(item.uae_vendor_rate).toFixed(2)}` : '—'}
                          </div>
                          {Number(item.uae_vendor_rate) > 0 && (
                            <div style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>
                              Margin: AED {Number(item.uae_vendor_margin || 0).toFixed(2)}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Status */}
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                          background: item.is_active ? 'var(--green-l)' : '#f1f5f9',
                          color: item.is_active ? 'var(--green)' : '#94a3b8'
                        }}>
                          {item.is_active ? '✓ Active' : 'Hidden'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => { setEditItem(item); setShowModal(true); }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            title="Edit Product"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', fontSize: 12, color: 'var(--red)' }}
                            title="Delete Product"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Reusable Pagination */}
        <Pagination
          page={page}
          pages={pages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={l => { setLimit(l); setPage(1); }}
        />
      </div>

      {/* Product Form Modal (Add / Edit) */}
      {/* Product Form Modal (Add / Edit) */}
      {showModal && (
        <ProductFormModal
          item={editItem}
          categories={categories}
          isVivaStudio={isVivaStudio}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSaved={() => { setShowModal(false); setEditItem(null); loadData(page, limit); }}
        />
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="modal-overlay" onClick={() => setLightboxImg(null)} style={{ zIndex: 1000, background: 'rgba(0,0,0,0.85)' }}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img
              src={lightboxImg}
              alt="Design Preview"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, display: 'block', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
            />
            <button
              onClick={() => setLightboxImg(null)}
              style={{
                position: 'absolute', top: -14, right: -14, background: '#fff', border: 'none',
                borderRadius: '50%', width: 32, height: 32, fontSize: 16, cursor: 'pointer', fontWeight: 800
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const POPULAR_GARMENT_CATEGORIES = [
  'Salwar Suit',
  'Shawl Nighty',
  'Ordinary Nighty',
  'Kurti',
  'Western Wear',
  'Abaya / Burqa',
  'Gown / Frock',
  'Cotton Fabric',
  'Saree',
  'Dupatta',
  'Nightwear',
  'Kids Wear',
  'Bottom Wear',
  'Co-ord Set',
  'Kaftan'
];

/**
 * Add / Edit Modal for Showcase Product
 */
function ProductFormModal({ item, categories, isVivaStudio, onClose, onSaved }) {
  const [name, setName] = useState(item?.name || '');
  const [itemCode, setItemCode] = useState(item?.item_code || '');
  const [category, setCategory] = useState(item?.category || '');
  const [uom, setUom] = useState(item?.uom || 'pcs');
  const [description, setDescription] = useState(item?.description || '');
  const [imageUrl, setImageUrl] = useState(item?.image_url || '');

  // Cost, Expense (one textbox), and Selling Rates
  const [productCost, setProductCost] = useState(item ? String(item.product_cost || '') : '');
  const [expense, setExpense] = useState(item ? String(item.expense || '') : '');
  const [wholesaleRate, setWholesaleRate] = useState(item ? String(item.wholesale_rate || '') : '');
  const [retailVendorRate, setRetailVendorRate] = useState(item ? String(item.retail_vendor_rate || '') : '');
  const [retailCustomerRate, setRetailCustomerRate] = useState(item ? String(item.retail_customer_rate || '') : '');
  const [uaeVendorRate, setUaeVendorRate] = useState(item ? String(item.uae_vendor_rate || '') : '');

  const [isActive, setIsActive] = useState(item ? !!item.is_active : true);
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef(null);

  const allCategories = Array.from(new Set([...(categories || []), ...POPULAR_GARMENT_CATEGORIES])).filter(Boolean);

  // Computed Financials for Live Preview
  const costVal = parseFloat(productCost) || 0;
  const expVal = parseFloat(expense) || 0;
  const totalCost = costVal + expVal;

  const wsRate = parseFloat(wholesaleRate) || 0;
  const wsMargin = wsRate - totalCost;
  const wsPct = totalCost > 0 ? (wsMargin / totalCost) * 100 : 0;

  const rvRate = parseFloat(retailVendorRate) || 0;
  const rvMargin = rvRate - totalCost;
  const rvPct = totalCost > 0 ? (rvMargin / totalCost) * 100 : 0;

  const rcRate = parseFloat(retailCustomerRate) || 0;
  const rcMargin = rcRate - totalCost;
  const rcPct = totalCost > 0 ? (rcMargin / totalCost) * 100 : 0;

  const uaeRate = parseFloat(uaeVendorRate) || 0;
  const uaeMargin = uaeRate - totalCost;
  const uaePct = totalCost > 0 ? (uaeMargin / totalCost) * 100 : 0;

  // Handle client-side image compression via Canvas
  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (JPEG, PNG, WEBP)');
      return;
    }
    setImageError('');

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setImageUrl(dataUrl);
      };
      img.src = uploadEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a product / design name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        item_code: itemCode.trim() || null,
        category: category.trim() || null,
        uom: uom.trim() || 'pcs',
        description: description.trim() || null,
        image_url: imageUrl || null,
        product_cost: costVal,
        expense: expVal,
        wholesale_rate: wsRate,
        retail_vendor_rate: rvRate,
        retail_customer_rate: rcRate,
        uae_vendor_rate: isVivaStudio ? (parseFloat(uaeVendorRate) || 0) : 0,
        is_active: isActive ? 1 : 0
      };

      if (item) {
        await api.put(`/catalog/${item.id}`, payload);
      } else {
        await api.post('/catalog', payload);
      }
      onSaved();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save product showcase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 680, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {item ? '✏️ Edit Product Design' : '✨ Add New Product Design'}
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave}>
          {/* Section 1: Design Details */}
          <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
              1. Design &amp; Item Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="field">
                <label>Design / Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kashmiri Embroidered Salwar Suit"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field">
                <label>SKU / Style Code</label>
                <input
                  type="text"
                  placeholder="e.g. VIVA-SS-2026"
                  value={itemCode}
                  onChange={e => setItemCode(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ margin: 0 }}>Category</label>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Pick or type any new category</span>
                </div>
                <input
                  type="text"
                  list="category-suggestions"
                  placeholder="e.g. Salwar Suit, Shawl Nighty, Kurti, Abaya..."
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                />
                <datalist id="category-suggestions">
                  {allCategories.map(c => <option key={c} value={c} />)}
                </datalist>

                {/* Quick Category Selection Badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {allCategories.slice(0, 10).map(catName => (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setCategory(catName)}
                      style={{
                        border: category.toLowerCase() === catName.toLowerCase() ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: category.toLowerCase() === catName.toLowerCase() ? 'rgba(79, 70, 229, 0.1)' : 'var(--surface)',
                        color: category.toLowerCase() === catName.toLowerCase() ? 'var(--accent)' : 'var(--text)',
                        borderRadius: 12, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
                        fontWeight: category.toLowerCase() === catName.toLowerCase() ? 700 : 500
                      }}
                    >
                      {catName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Unit of Measure (UOM)</label>
                <select value={uom} onChange={e => setUom(e.target.value)}>
                  <option value="pcs">pcs (Pieces)</option>
                  <option value="set">set (Set)</option>
                  <option value="meter">meter</option>
                  <option value="box">box</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Photo / Design Image Upload */}
          <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
              2. Design Photo Upload
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {/* Image Preview Box */}
              <div style={{
                width: 100, height: 100, borderRadius: 8, border: '1.5px dashed var(--border)',
                background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, position: 'relative'
              }}>
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 28, color: '#94a3b8' }}>📷</span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImageFile}
                />

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📁 Browse / Upload Photo
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red)' }}
                      onClick={() => setImageUrl('')}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Upload high-res design image. Automatically optimized for fast mobile loading.
                </div>
                {imageError && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{imageError}</div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Cost, Expense & Multi-Tier Rates */}
          <div style={{ background: '#fdfcf7', padding: 14, borderRadius: 10, border: '1px solid #e7dfc6', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                3. Cost, Expense &amp; Selling Rates (CRUD)
              </div>
              <div style={{
                fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a'
              }}>
                Total Cost: {fmt(totalCost)}
              </div>
            </div>

            {/* Product Cost and Expense (Single Textbox) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="field">
                <label style={{ fontWeight: 700 }}>Product Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={productCost}
                  onChange={e => setProductCost(e.target.value)}
                  style={{ fontWeight: 700 }}
                />
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Base material &amp; stitching cost</span>
              </div>

              <div className="field">
                <label style={{ fontWeight: 700 }}>Expense (₹) <span style={{ fontWeight: 400, fontSize: 10 }}>(one textbox)</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={expense}
                  onChange={e => setExpense(e.target.value)}
                  style={{ fontWeight: 700 }}
                />
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Packaging, transport, misc overhead</span>
              </div>
            </div>

            {/* Selling Rates for the Customer / Vendor Types */}
            <div style={{ display: 'grid', gridTemplateColumns: isVivaStudio ? 'repeat(auto-fit, minmax(130px, 1fr))' : '1fr 1fr 1fr', gap: 10 }}>
              {/* Wholesale Vendor Rate */}
              <div style={{ background: '#f0f9ff', padding: 10, borderRadius: 8, border: '1px solid #bae6fd' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', display: 'block', marginBottom: 4 }}>
                  🏢 Wholesale Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={wholesaleRate}
                  onChange={e => setWholesaleRate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid #7dd3fc', fontWeight: 800, color: '#0369a1' }}
                />
                <div style={{ fontSize: 10, marginTop: 4, color: wsMargin >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  Margin: {fmt(wsMargin)} ({pct(wsPct)})
                </div>
              </div>

              {/* Retail Vendor Rate */}
              <div style={{ background: '#f5f3ff', padding: 10, borderRadius: 8, border: '1px solid #ddd6fe' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', display: 'block', marginBottom: 4 }}>
                  🏪 Retail Vendor Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={retailVendorRate}
                  onChange={e => setRetailVendorRate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid #c4b5fd', fontWeight: 800, color: '#4338ca' }}
                />
                <div style={{ fontSize: 10, marginTop: 4, color: rvMargin >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  Margin: {fmt(rvMargin)} ({pct(rvPct)})
                </div>
              </div>

              {/* Retail Customer / E-Commerce Rate */}
              <div style={{ background: '#fffbeb', padding: 10, borderRadius: 8, border: '1px solid #fde68a' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#b45309', display: 'block', marginBottom: 4 }}>
                  🛍️ Retail Customer Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={retailCustomerRate}
                  onChange={e => setRetailCustomerRate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid #fcd34d', fontWeight: 800, color: '#b45309' }}
                />
                <div style={{ fontSize: 10, marginTop: 4, color: rcMargin >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  Margin: {fmt(rcMargin)} ({pct(rcPct)})
                </div>
              </div>

              {/* UAE Vendor Rate (Exclusive to Viva Studio) */}
              {isVivaStudio && (
                <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 8, border: '1.5px solid #a7f3d0' }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#065f46', display: 'block', marginBottom: 4 }}>
                    🇦🇪 UAE Vendor Rate (AED)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={uaeVendorRate}
                    onChange={e => setUaeVendorRate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid #6ee7b7', fontWeight: 800, color: '#065f46' }}
                  />
                  <div style={{ fontSize: 10, marginTop: 4, color: '#047857', fontWeight: 600 }}>
                    Export rate in Dirhams (AED)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Description & Status */}
          <div style={{ marginBottom: 16 }}>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Description / Fabric Specifications (Visible to Customers)</label>
              <textarea
                rows={3}
                placeholder="e.g. Pure cotton breathable fabric, fast colors, includes dupatta and salwar bottom..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="showcase-active-check"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                style={{ width: 'auto', accentColor: 'var(--accent)' }}
              />
              <label htmlFor="showcase-active-check" style={{ margin: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Publish and show this design in digital catalogs
              </label>
            </div>
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : item ? 'Update Design' : 'Create Design'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
