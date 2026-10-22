import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const fmt = (n, symbol = '₹') => symbol + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const TIER_META = {
  'uae-vendor': {
    title: 'UAE Wholesale & Export Catalog',
    subtitle: 'Exclusive export collection and pricing for UAE merchants and partners.',
    badge: '🇦🇪 UAE Vendor Pricing',
    bgHeader: 'linear-gradient(135deg, #064e3b 0%, #0f766e 100%)',
    accentColor: '#059669',
    currency: 'AED',
    currencySymbol: 'AED '
  },
  'wholesale': {
    title: 'Wholesale Partner Catalog',
    subtitle: 'Exclusive bulk rates for distributors, wholesalers, and retail merchants.',
    badge: '🏢 Wholesale Pricing',
    bgHeader: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    accentColor: '#0284c7'
  },
  'retail-vendor': {
    title: 'Retail Vendor Catalog',
    subtitle: 'Special commercial rates for boutique owners, shops, and retail dealers.',
    badge: '🏪 Retail Vendor Pricing',
    bgHeader: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    accentColor: '#6366f1'
  },
  'retail-customer': {
    title: 'Retail & E-Commerce Collection',
    subtitle: 'Direct customer catalog with current designs and seasonal releases.',
    badge: '🛍️ Retail Collection',
    bgHeader: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
    accentColor: '#d97706'
  }
};

export default function PublicCatalogPage() {
  const { type = 'wholesale', tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const tenantParam = tenantSlug || searchParams.get('tenant') || searchParams.get('tenant_id') || '1';
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogData, setCatalogData] = useState({ products: [], categories: [], tenant: {}, tier: {} });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'price-asc', 'price-desc', 'name-asc'
  const [lightboxImg, setLightboxImg] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const meta = TIER_META[type] || TIER_META['wholesale'];

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/catalog/public/${type}`, {
      params: { tenant: tenantParam }
    })
      .then(res => {
        setCatalogData(res.data);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Failed to load catalog. Please check your link.');
      })
      .finally(() => setLoading(false));
  }, [type, tenantParam]);

  // Filter & sort
  const filteredProducts = (catalogData.products || []).filter(p => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.item_code && p.item_code.toLowerCase().includes(search.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' ||
      (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return (a.rate || 0) - (b.rate || 0);
    if (sortBy === 'price-desc') return (b.rate || 0) - (a.rate || 0);
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    return b.id - a.id;
  });

  const tenant = catalogData.tenant || {};
  const symbol = type === 'uae-vendor' ? 'AED ' : (tenant.currency_symbol || '₹');

  const sendWhatsApp = (product) => {
    const phone = tenant.phone || '919876543210';
    const text = encodeURIComponent(
      `Hello ${tenant.name || 'Viva Studio'},\n\nI am interested in your design:\n*${product.name}* (${product.item_code || 'No SKU'})\nCategory: ${product.category || 'General'}\nRate: ${symbol}${product.rate}/${product.uom || 'pcs'}\n\nPlease share availability and order minimums.`
    );
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
  };

  const copyProductLink = (product) => {
    const url = window.location.href.split('#')[0] + `#prod-${product.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{
        background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '12px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={tenant.logo_url || '/logo.png'} alt={tenant.name || 'Viva Studio'} style={{ height: 42, width: 'auto' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', letterSpacing: '-0.01em' }}>
                {tenant.name || 'Viva Studio'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                Garment Manufacturing &amp; Wholesale
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0'
            }}>
              {meta.badge}
            </span>
            {user ? (
              <Link
                to="/"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}
              >
                📊 Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
              >
                🔐 Staff Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner with Theme Accent */}
      <section style={{ background: meta.bgHeader, color: '#fff', padding: '36px 20px 42px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 16,
            background: 'rgba(255,255,255,0.15)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8
          }}>
            {catalogData.tier?.label || meta.title}
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            {catalogData.tier?.label || meta.title}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#cbd5e1', maxWidth: 640 }}>
            {catalogData.tier?.subtitle || meta.subtitle}
          </p>

          {/* Quick Tier Switching Links: NEVER show for UAE vendor; only show for authenticated users */}
          {type !== 'uae-vendor' && user && (
            <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center', marginRight: 4 }}>
                Switch catalog tier:
              </span>
              <Link
                to={`/catalog/wholesale${tenantParam !== '1' ? `?tenant=${tenantParam}` : ''}`}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: type === 'wholesale' ? '#fff' : 'rgba(255,255,255,0.1)',
                  color: type === 'wholesale' ? '#0f172a' : '#fff', textDecoration: 'none'
                }}
              >
                🏢 Wholesale
              </Link>
              <Link
                to={`/catalog/retail-vendor${tenantParam !== '1' ? `?tenant=${tenantParam}` : ''}`}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: type === 'retail-vendor' ? '#fff' : 'rgba(255,255,255,0.1)',
                  color: type === 'retail-vendor' ? '#0f172a' : '#fff', textDecoration: 'none'
                }}
              >
                🏪 Retail Vendor
              </Link>
              <Link
                to={`/catalog/retail-customer${tenantParam !== '1' ? `?tenant=${tenantParam}` : ''}`}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: type === 'retail-customer' ? '#fff' : 'rgba(255,255,255,0.1)',
                  color: type === 'retail-customer' ? '#0f172a' : '#fff', textDecoration: 'none'
                }}
              >
                🛍️ Retail / Online
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 48px', width: '100%', flex: 1 }}>
        {/* Controls Bar: Search, Category Pills, Sort */}
        <div style={{
          background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
          padding: '16px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <input
                type="text"
                placeholder="🔍 Search design, style code, fabric specifications..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 8,
                  border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: 0 }}>Sort by:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13 }}
              >
                <option value="newest">✨ Latest Designs</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: selectedCategory === 'all' ? `1.5px solid ${meta.accentColor}` : '1.5px solid #e2e8f0',
                background: selectedCategory === 'all' ? meta.accentColor : '#fff',
                color: selectedCategory === 'all' ? '#fff' : '#475569',
                whiteSpace: 'nowrap'
              }}
            >
              All Designs ({catalogData.products?.length || 0})
            </button>
            {(catalogData.categories || []).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: selectedCategory === cat ? `1.5px solid ${meta.accentColor}` : '1.5px solid #e2e8f0',
                  background: selectedCategory === cat ? meta.accentColor : '#fff',
                  color: selectedCategory === cat ? '#fff' : '#475569',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Loading catalog collection…</div>
          </div>
        ) : error ? (
          <div style={{
            background: '#ffffff', border: '1.5px solid #fed7aa', borderRadius: 12,
            padding: 32, textAlign: 'center', color: '#1e293b', maxWidth: 460, margin: '40px auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a', marginBottom: 6 }}>
              {error.toLowerCase().includes('authentication') || error.toLowerCase().includes('restricted') ? 'Protected Catalog' : 'Catalog Notice'}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 20 }}>
              {error}
            </div>
            {error.toLowerCase().includes('authentication') || error.toLowerCase().includes('sign in') ? (
              <Link
                to={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: 13, textDecoration: 'none' }}
              >
                Sign In to View Catalog
              </Link>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Please contact the administrator for an updated link.
              </div>
            )}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{
            background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
            padding: '60px 20px', textAlign: 'center', color: '#64748b'
          }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>👗</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>No designs matched your filter</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Try clearing your search term or selecting a different category.
            </div>
            {(search || selectedCategory !== 'all') && (
              <button
                onClick={() => { setSearch(''); setSelectedCategory('all'); }}
                className="btn btn-outline btn-sm"
                style={{ marginTop: 14 }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20
          }}>
            {filteredProducts.map(prod => (
              <div
                key={prod.id}
                id={`prod-${prod.id}`}
                style={{
                  background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                {/* Product Image */}
                <div
                  style={{
                    position: 'relative', height: 260, background: '#f1f5f9',
                    overflow: 'hidden', cursor: prod.image_url ? 'pointer' : 'default'
                  }}
                  onClick={() => prod.image_url && setLightboxImg(prod.image_url)}
                >
                  {prod.image_url ? (
                    <img
                      src={prod.image_url}
                      alt={prod.name}
                      style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        transition: 'transform 0.25s'
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 6, color: '#94a3b8'
                    }}>
                      <span style={{ fontSize: 36 }}>🖼️</span>
                      <span style={{ fontSize: 11 }}>Photo Coming Soon</span>
                    </div>
                  )}

                  {/* Category Pill Tag */}
                  {prod.category && (
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      background: 'rgba(15,23,42,0.82)', color: '#fff',
                      padding: '3px 10px', borderRadius: 12, fontSize: 10,
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      backdropFilter: 'blur(4px)'
                    }}>
                      {prod.category}
                    </div>
                  )}

                  {/* SKU Tag */}
                  {prod.item_code && (
                    <div style={{
                      position: 'absolute', bottom: 10, left: 10,
                      background: 'rgba(255,255,255,0.92)', color: '#0f172a',
                      padding: '2px 8px', borderRadius: 6, fontSize: 10,
                      fontWeight: 700, fontFamily: 'monospace',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      {prod.item_code}
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                    {prod.name}
                  </h3>

                  {prod.description && (
                    <p style={{
                      margin: '0 0 14px 0', fontSize: 12, color: '#64748b',
                      lineHeight: 1.5, flex: 1, display: '-webkit-box',
                      WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {prod.description}
                    </p>
                  )}

                  {/* Rate & Pricing Display */}
                  <div style={{
                    marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', display: 'block', letterSpacing: '0.05em' }}>
                        {type === 'wholesale' ? 'Wholesale Rate' : type === 'retail-vendor' ? 'Vendor Rate' : 'Price'}
                      </span>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
                        {fmt(prod.rate, symbol)}
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginLeft: 3 }}>
                          /{prod.uom || 'pcs'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => copyProductLink(prod)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '4px 8px', color: '#64748b' }}
                      title="Copy link to this design"
                    >
                      {copiedId === prod.id ? '✓ Copied' : '🔗 Link'}
                    </button>
                  </div>

                  {/* Inquiry / Action Button */}
                  <button
                    onClick={() => sendWhatsApp(prod)}
                    className="btn btn-primary"
                    style={{
                      width: '100%', marginTop: 12, padding: '8px 12px',
                      fontSize: 12, fontWeight: 700, borderRadius: 8,
                      background: '#16a34a', border: 'none', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    <span>💬 Inquire on WhatsApp</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          className="modal-overlay"
          onClick={() => setLightboxImg(null)}
          style={{ zIndex: 1000, background: 'rgba(0,0,0,0.85)', padding: 20 }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img
              src={lightboxImg}
              alt="Design Detail"
              style={{
                maxWidth: '100%', maxHeight: '85vh', borderRadius: 10,
                display: 'block', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
              }}
            />
            <button
              onClick={() => setLightboxImg(null)}
              style={{
                position: 'absolute', top: -14, right: -14, background: '#fff', border: 'none',
                borderRadius: '50%', width: 34, height: 34, fontSize: 18, cursor: 'pointer',
                fontWeight: 800, boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '24px 20px', marginTop: 'auto' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
        }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            © {new Date().getFullYear()} {tenant.name || 'Viva Studio'}. All rights reserved.
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            Powered by Viva ERP Platform
          </div>
        </div>
      </footer>
    </div>
  );
}
