import { useState } from 'react';
import api from '../api/client';

const PRESETS = {
  trading: {
    label: '🏢 Trading / Distribution',
    desc: 'Accounting, Sales, Purchases, Stock, Party Ledger, Payroll (No garment manufacturing)',
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
    label: '💼 Services / Accounting Agency',
    desc: 'Accounting, Finance, Expenses, Client Invoicing, Payroll',
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
    desc: 'All features including Cutting, Stitching, Batches, Piece Rates',
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
    label: '⚙️ Custom Configuration',
    desc: 'Choose exactly which modules to enable',
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

export default function TenantOnboardModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [country, setCountry] = useState('SA');
  const [currency, setCurrency] = useState('SAR');
  const [preset, setPreset] = useState('trading');
  const [features, setFeatures] = useState(PRESETS.trading.features);

  // Admin account state
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
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        features,
      });

      onSuccess({ name, slug, email: adminEmail });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>🚀 Create New Company Workspace</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Step {step} of 2 · {step === 1 ? 'Company Profile & Modules' : 'Admin Account & Provisioning'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="alert alert-red mb12">
            <div className="a-icon">⚠️</div>
            <div className="a-body">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div>
              {/* Company Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="field">
                  <label>Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al-Madina Trading Co."
                    value={name}
                    onChange={e => handleNameChange(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Workspace Slug *</label>
                  <input
                    type="text"
                    required
                    placeholder="al_madina"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                  />
                </div>
              </div>

              {/* Country & Currency */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="field">
                  <label>Country *</label>
                  <select value={country} onChange={e => handleCountryChange(e.target.value)}>
                    <option value="SA">🇸🇦 Saudi Arabia (KSA)</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="AE">🇦🇪 United Arab Emirates</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="OTHER">🌍 Other</option>
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

              {/* Business Domain Preset */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                  Business Domain / Preset
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(PRESETS).map(([k, p]) => (
                    <div
                      key={k}
                      onClick={() => handlePresetSelect(k)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: preset === k ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: preset === k ? 'rgba(234,179,8,0.06)' : 'var(--surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Module Feature Checklist */}
              <div style={{ marginBottom: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Choose Features &amp; Modules</label>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Checked modules will be created in isolated DB</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                  {[
                    ['feature_accounting', '📈 Accounting & Finance (Cash Ledger)'],
                    ['feature_expenses', '🧾 Expense Tracking & Capital'],
                    ['feature_party_ledger', '📒 Party Ledger (Clients/Vendors)'],
                    ['feature_sales_invoicing', '🚚 Sales Orders & Invoicing'],
                    ['feature_purchases', '📦 Purchases & Supplier Bills'],
                    ['feature_inventory_stock', '🏭 Stock Inventory & Materials'],
                    ['feature_garment_production', '✂️ Garment Cutting & Stitching Batches'],
                    ['feature_staff_piece_log', '📋 Staff Daily Piece Output Log'],
                    ['feature_payroll', '👷 Monthly Staff Payroll & Dues'],
                    ['feature_zatca_einvoicing', '🇸🇦 Saudi ZATCA E-Invoicing (Fatoora)'],
                  ].map(([k, label]) => (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                      <input
                        type="checkbox"
                        checked={!!features[k]}
                        onChange={() => toggleFeature(k)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontWeight: features[k] ? 600 : 400, color: features[k] ? 'var(--text)' : 'var(--muted)' }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!name || !slug}
                  onClick={() => setStep(2)}
                >
                  Continue to Admin Setup →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="alert alert-accent mb12" style={{ fontSize: 12 }}>
                <div className="a-icon">ℹ️</div>
                <div className="a-body">
                  A completely isolated physical database <code>erp_tenant_{slug}</code> will be generated automatically.
                </div>
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Admin Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmed Al-Otaibi"
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Admin Login Email *</label>
                <input
                  type="email"
                  required
                  placeholder="ahmed@company.com"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label>Admin Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !adminName || !adminEmail || !adminPassword}
                >
                  {loading ? 'Provisioning Isolated Database…' : '⚡ Create & Provision Workspace'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
