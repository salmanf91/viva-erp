import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

const PRESETS = {
  trading: {
    label: '🏢 Trading & Wholesale',
    desc: 'Accounting, Sales & Invoicing, Purchases, Stock Inventory, Party Ledger, Payroll (Non-manufacturing)',
    icon: '🏢',
    features: {
      feature_accounting: true,
      feature_expenses: true,
      feature_party_ledger: true,
      feature_sales_invoicing: true,
      feature_purchases: true,
      feature_inventory_stock: true,
      feature_garment_production: false,
      feature_staff_piece_log: false,
      feature_payroll: true,
      feature_zatca_einvoicing: true,
    }
  },
  services: {
    label: '💼 Services & Agency',
    desc: 'Accounting & Finance, Expense Tracking, Client Invoicing, Staff Payroll',
    icon: '💼',
    features: {
      feature_accounting: true,
      feature_expenses: true,
      feature_party_ledger: true,
      feature_sales_invoicing: true,
      feature_purchases: false,
      feature_inventory_stock: false,
      feature_garment_production: false,
      feature_staff_piece_log: false,
      feature_payroll: true,
      feature_zatca_einvoicing: true,
    }
  },
  garment_mfg: {
    label: '✂️ Garment Manufacturing',
    desc: 'Complete apparel manufacturing with cutting, stitching batches, and piece rate outputs',
    icon: '✂️',
    features: {
      feature_accounting: true,
      feature_expenses: true,
      feature_party_ledger: true,
      feature_sales_invoicing: true,
      feature_purchases: true,
      feature_inventory_stock: true,
      feature_garment_production: true,
      feature_staff_piece_log: true,
      feature_payroll: true,
      feature_zatca_einvoicing: false,
    }
  },
  custom: {
    label: '⚙️ Custom Setup',
    desc: 'Hand-pick exact operational modules suited to your business needs',
    icon: '⚙️',
    features: {
      feature_accounting: true,
      feature_expenses: true,
      feature_party_ledger: true,
      feature_sales_invoicing: true,
      feature_purchases: true,
      feature_inventory_stock: false,
      feature_garment_production: false,
      feature_staff_piece_log: false,
      feature_payroll: true,
      feature_zatca_einvoicing: false,
    }
  }
};

export default function OnboardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Company & Branding
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [country, setCountry] = useState('SA');
  const [currency, setCurrency] = useState('SAR');
  const [logoPreview, setLogoPreview] = useState('');

  // Step 2: Preset & Features
  const [preset, setPreset] = useState('trading');
  const [features, setFeatures] = useState(PRESETS.trading.features);

  // Step 3: Admin User
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleNameChange = (val) => {
    setName(val);
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 30);
    setSlug(autoSlug);
  };

  const handleCountryChange = (c) => {
    setCountry(c);
    if (c === 'SA') {
      setCurrency('SAR');
      setFeatures(prev => ({ ...prev, feature_zatca_einvoicing: true }));
    } else if (c === 'IN') {
      setCurrency('INR');
      setFeatures(prev => ({ ...prev, feature_zatca_einvoicing: false }));
    } else if (c === 'AE') {
      setCurrency('AED');
    } else {
      setCurrency('USD');
    }
  };

  const handlePresetSelect = (presetKey) => {
    setPreset(presetKey);
    const presetFeatures = { ...PRESETS[presetKey].features };
    if (country === 'SA') {
      presetFeatures.feature_zatca_einvoicing = true;
    }
    setFeatures(presetFeatures);
  };

  const toggleFeature = (featKey) => {
    setFeatures(prev => ({ ...prev, [featKey]: !prev[featKey] }));
    setPreset('custom');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/register-tenant', {
        name,
        slug,
        country,
        currency,
        business_domain: preset,
        logo_url: logoPreview || undefined,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        features,
      });

      navigate('/login', {
        state: {
          msg: `Workspace '${name}' provisioned successfully! You can now sign in with ${adminEmail}.`,
          selectedSlug: slug,
          registeredEmail: adminEmail,
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to provision workspace database');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 840, width: '100%' }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.png" alt="Logo" style={{ height: 42 }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>Enterprise ERP Provisioner</h1>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Multi-Tenant Workspace &amp; Isolated Database Setup</div>
            </div>
          </div>
          <Link to="/login" className="btn btn-ghost btn-sm">
            ← Back to Sign In
          </Link>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { num: 1, title: 'Company & Logo', desc: 'Identity & currency' },
            { num: 2, title: 'Modules & Domain', desc: 'Enabled features' },
            { num: 3, title: 'Admin & Provision', desc: 'Create database' },
          ].map(s => (
            <div
              key={s.num}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: step === s.num ? 'var(--white)' : 'rgba(255,255,255,0.6)',
                border: step === s.num ? '2px solid var(--accent)' : '1px solid var(--border)',
                boxShadow: step === s.num ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: step >= s.num ? 'var(--accent)' : 'var(--muted)',
                  color: '#fff', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {step > s.num ? '✓' : s.num}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: step === s.num ? 'var(--text)' : 'var(--muted)' }}>
                  {s.title}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginLeft: 30 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="alert alert-red mb16">
            <div className="a-icon">⚠️</div>
            <div className="a-body">{error}</div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="card" style={{ padding: '28px 32px' }}>
          <form onSubmit={handleSubmit}>
            {/* STEP 1: Company Info & Logo */}
            {step === 1 && (
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px 0' }}>1. Company Information &amp; Branding</h2>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                  Enter company details and upload your organization logo.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="field">
                    <label>Company / Organization Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Al-Madina Trading LLC"
                      value={name}
                      onChange={e => handleNameChange(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Workspace Slug (Unique ID) *</label>
                    <input
                      type="text"
                      required
                      placeholder="al_madina"
                      value={slug}
                      onChange={e => setSlug(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div className="field">
                    <label>Country *</label>
                    <select value={country} onChange={e => handleCountryChange(e.target.value)}>
                      <option value="SA">🇸🇦 Saudi Arabia (KSA - ZATCA)</option>
                      <option value="IN">🇮🇳 India (GST)</option>
                      <option value="AE">🇦🇪 United Arab Emirates</option>
                      <option value="US">🇺🇸 United States</option>
                      <option value="OTHER">🌍 Other International</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Operating Currency *</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value)}>
                      <option value="SAR">SAR (Saudi Riyal - ﷼)</option>
                      <option value="INR">INR (Indian Rupee - ₹)</option>
                      <option value="AED">AED (UAE Dirham)</option>
                      <option value="USD">USD (US Dollar - $)</option>
                    </select>
                  </div>
                </div>

                {/* Logo Upload Section */}
                <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                    🏢 Company Logo (Optional)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 100, height: 100, borderRadius: 12, border: '2px dashed var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--surface)', overflow: 'hidden'
                    }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 32, opacity: 0.4 }}>🏢</span>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        id="logo-upload-input"
                        accept="image/png, image/jpeg, image/svg+xml"
                        onChange={handleLogoUpload}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="logo-upload-input" className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 6 }}>
                        📁 Upload Logo Image
                      </label>
                      {logoPreview && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--red)', marginLeft: 8 }}
                          onClick={() => setLogoPreview('')}
                        >
                          Remove
                        </button>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Recommended PNG or SVG with transparent background (Max 2MB).
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <Link to="/login" className="btn btn-ghost">Cancel</Link>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!name || !slug}
                    onClick={() => { setError(''); setStep(2); }}
                  >
                    Next: Choose Features &amp; Modules →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Presets & Modular Features */}
            {step === 2 && (
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px 0' }}>2. Business Domain &amp; Modular Features</h2>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                  Select the operations your company performs. Non-relevant modules will be disabled.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {Object.entries(PRESETS).map(([k, p]) => (
                    <div
                      key={k}
                      onClick={() => handlePresetSelect(k)}
                      style={{
                        padding: '14px',
                        borderRadius: 10,
                        border: preset === k ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: preset === k ? 'rgba(234,179,8,0.08)' : 'var(--surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>{p.desc}</div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 800 }}>Feature Toggles &amp; Database Tables</label>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Checked modules will be provisioned in your isolated DB</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                    {[
                      ['feature_accounting', '📈 Accounting & Finance (Cash Ledger)'],
                      ['feature_expenses', '🧾 Expense Tracking & Capital Accounts'],
                      ['feature_party_ledger', '📒 Party Ledger (Customer & Supplier Statements)'],
                      ['feature_sales_invoicing', '🚚 Sales Orders & Tax Invoicing'],
                      ['feature_purchases', '📦 Purchases & Supplier Invoices'],
                      ['feature_inventory_stock', '🏭 Raw Materials & Stock Inventory'],
                      ['feature_garment_production', '✂️ Garment Cutting & Stitching Batches'],
                      ['feature_staff_piece_log', '📋 Staff Daily Piece Output Log'],
                      ['feature_payroll', '👷 Monthly Staff Payroll & Dues'],
                      ['feature_zatca_einvoicing', '🇸🇦 Saudi ZATCA E-Invoicing (Fatoora Phase 1 & 2)'],
                    ].map(([k, label]) => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
                        <input
                          type="checkbox"
                          checked={!!features[k]}
                          onChange={() => toggleFeature(k)}
                          style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                        />
                        <span style={{ fontWeight: features[k] ? 700 : 400, color: features[k] ? 'var(--text)' : 'var(--muted)' }}>
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { setError(''); setStep(3); }}
                  >
                    Next: Admin Account &amp; Provision →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Admin User & Summary */}
            {step === 3 && (
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px 0' }}>3. Administrator Credentials &amp; Database Provisioning</h2>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                  Create the owner administrator account for <b>{name}</b>.
                </div>

                {/* Summary Box */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Database: <code>erp_tenant_{slug}</code> · {country === 'SA' ? '🇸🇦 Saudi Arabia' : country === 'IN' ? '🇮🇳 India' : country} · {currency}
                    </div>
                  </div>
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo" style={{ height: 36, maxWidth: 80, objectFit: 'contain' }} />
                  )}
                </div>

                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Administrator Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Salman Farees"
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Administrator Login Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@company.com"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                  />
                </div>

                <div className="field" style={{ marginBottom: 24 }}>
                  <label>Administrator Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '10px 24px', fontSize: 14, fontWeight: 800 }}
                    disabled={loading || !adminName || !adminEmail || !adminPassword}
                  >
                    {loading ? '⚡ Provisioning Database & Workspace…' : '⚡ Create & Provision Workspace'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
