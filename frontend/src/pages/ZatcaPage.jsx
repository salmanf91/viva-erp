import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ZatcaPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Form State
  const [vatNumber, setVatNumber] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgUnit, setOrgUnit] = useState('Head Office');
  const [city, setCity] = useState('Riyadh');
  const [environment, setEnvironment] = useState('sandbox');

  // OTP Onboarding
  const [otp, setOtp] = useState('');
  const [onboarding, setOnboarding] = useState(false);

  // Invoice Modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/zatca/config'),
      api.get('/zatca/invoices').catch(() => ({ data: [] }))
    ]).then(([cfgRes, invRes]) => {
      setConfig(cfgRes.data);
      if (cfgRes.data) {
        setVatNumber(cfgRes.data.vat_registration_number || '');
        setCrNumber(cfgRes.data.commercial_registration || '');
        setOrgName(cfgRes.data.organization_name || user?.tenant_name || '');
        setOrgUnit(cfgRes.data.organization_unit || 'Head Office');
        setCity(cfgRes.data.city || 'Riyadh');
        setEnvironment(cfgRes.data.environment || 'sandbox');
      }
      setInvoices(invRes.data || []);
    }).catch(err => {
      setError(err.message);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMsg('');
    try {
      await api.post('/zatca/config', {
        vat_registration_number: vatNumber,
        commercial_registration: crNumber,
        organization_name: orgName,
        organization_unit: orgUnit,
        city,
        environment,
      });
      setMsg('ZATCA Tax Profile updated successfully');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleOnboardOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP from Fatoora portal');
      return;
    }
    setOnboarding(true);
    setError('');
    setMsg('');
    try {
      const res = await api.post('/zatca/onboard', { otp });
      setMsg(res.data.message || 'Onboarded with ZATCA successfully!');
      setOtp('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Onboarding failed');
    } finally {
      setOnboarding(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🇸🇦 Saudi ZATCA E-Invoicing (Fatoora)</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            Universal Business Language (UBL 2.1) · Phase 1 &amp; Phase 2 E-Invoicing Integration
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className={`badge ${config?.has_production_csid ? 'b-green' : 'b-yellow'}`} style={{ fontSize: 12, padding: '6px 12px' }}>
            {config?.has_production_csid ? '✓ Production CSID Active' : '⏳ Onboarding Required'}
          </span>
        </div>
      </div>

      {msg && (
        <div className="alert alert-green mb12">
          <div className="a-icon">✓</div>
          <div className="a-body">{msg}</div>
        </div>
      )}

      {error && (
        <div className="alert alert-red mb12">
          <div className="a-icon">⚠️</div>
          <div className="a-body">{error}</div>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>ZATCA Tax Rate</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>15.0% <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>Standard VAT</span></div>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cleared B2B Invoices</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
            {invoices.filter(i => i.clearance_status === 'cleared').length} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>invoices</span>
          </div>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--cyan,#0891b2)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Reported B2C Invoices</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cyan,#0891b2)', marginTop: 4 }}>
            {invoices.filter(i => i.clearance_status === 'reported').length} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>invoices</span>
          </div>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>ZATCA Environment</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6', marginTop: 6, textTransform: 'capitalize' }}>
            {environment}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'flex-start', marginBottom: 24 }}>
        {/* Tax Profile Form */}
        <div className="card">
          <div className="card-hd">🏢 Company Tax &amp; ZATCA Profile</div>
          <form onSubmit={handleSaveConfig}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="field">
                <label>VAT Registration Number (15 Digits) *</label>
                <input
                  type="text"
                  required
                  placeholder="300000000000003"
                  value={vatNumber}
                  onChange={e => setVatNumber(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Commercial Registration (CRN) *</label>
                <input
                  type="text"
                  required
                  placeholder="1010000000"
                  value={crNumber}
                  onChange={e => setCrNumber(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="field">
                <label>Organization Name (Arabic/English) *</label>
                <input
                  type="text"
                  required
                  placeholder="Al-Madina Trading LLC"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Branch / Unit Name</label>
                <input
                  type="text"
                  placeholder="Head Office"
                  value={orgUnit}
                  onChange={e => setOrgUnit(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="field">
                <label>City</label>
                <input
                  type="text"
                  placeholder="Riyadh"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Target Environment</label>
                <select value={environment} onChange={e => setEnvironment(e.target.value)}>
                  <option value="sandbox">Developer Sandbox (Test)</option>
                  <option value="simulation">ZATCA Simulation (Pre-Prod)</option>
                  <option value="production">Live Production (Official)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving Profile…' : 'Save ZATCA Tax Profile'}
            </button>
          </form>
        </div>

        {/* Onboarding OTP Activation Card */}
        <div className="card">
          <div className="card-hd">🔐 Fatoora Portal Onboarding (EGS)</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
            To activate cryptographic signing (CSID), generate a 6-digit OTP in the <b>ZATCA Fatoora Portal</b> under <i>Settings → Onboard Solution Unit</i>.
          </div>

          <form onSubmit={handleOnboardOtp}>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>6-Digit Portal OTP *</label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                style={{ fontSize: 18, letterSpacing: 4, textAlign: 'center', fontWeight: 700 }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={onboarding || otp.length !== 6 || !vatNumber}
            >
              {onboarding ? 'Connecting & Requesting CSID…' : '⚡ Complete ZATCA Onboarding'}
            </button>
          </form>

          <div style={{ marginTop: 14, padding: 10, background: 'var(--surface)', borderRadius: 8, fontSize: 11, color: 'var(--muted)' }}>
            ✓ Automated <code>secp256k1</code> ECDSA keypair generation<br />
            ✓ UBL 2.1 XML compliance checks &amp; SHA-256 digest<br />
            ✓ Sequential Previous Invoice Hash (PIH) chaining
          </div>
        </div>
      </div>

      {/* ZATCA Invoices Table */}
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>ZATCA E-Invoices History</span>
          <button className="btn btn-ghost btn-sm" onClick={loadData}>↻ Refresh</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }} className="spinner">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            No ZATCA invoices issued yet. Create a sales invoice to clear or report with ZATCA.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Type</th>
                <th>Client / Buyer</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 700 }}>{inv.invoice_number}</td>
                  <td>{inv.issue_datetime ? new Date(inv.issue_datetime).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <span className={`badge ${inv.invoice_type === 'standard' ? 'b-accent' : 'b-cyan'}`} style={{ fontSize: 10 }}>
                      {inv.invoice_type === 'standard' ? 'B2B Standard' : 'B2C Simplified'}
                    </span>
                  </td>
                  <td>{inv.client_name || 'Walk-in Customer'}</td>
                  <td>
                    <span className="badge b-green" style={{ fontSize: 10 }}>
                      ✓ {inv.clearance_status === 'cleared' ? 'Cleared' : 'Reported'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      👁️ View Bilingual Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bilingual Invoice Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--accent)', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: 'var(--accent)' }}>فاتورة ضريبية / TAX INVOICE</h2>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>ZATCA Compliant E-Invoice · Saudi Arabia</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedInvoice(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16, fontSize: 12 }}>
              <div>
                <div style={{ fontWeight: 800 }}>المورد / Supplier:</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{config?.organization_name || user?.tenant_name}</div>
                <div style={{ color: 'var(--muted)' }}>VAT: {config?.vat_registration_number}</div>
                <div style={{ color: 'var(--muted)' }}>CRN: {config?.commercial_registration}</div>
                <div style={{ color: 'var(--muted)' }}>{config?.city || 'Riyadh'}, Saudi Arabia</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800 }}>العميل / Buyer:</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedInvoice.client_name || 'Cash Customer'}</div>
                <div style={{ color: 'var(--muted)' }}>Invoice: {selectedInvoice.invoice_number}</div>
                <div style={{ color: 'var(--muted)' }}>Date: {new Date(selectedInvoice.issue_datetime).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: 20, background: '#f8fafc', borderRadius: 8, margin: '16px 0', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                📱 ZATCA Official QR Code (Phase 2 TLV Base64 Encoded)
              </div>
              <div style={{ fontSize: 10, wordBreak: 'break-all', color: '#64748b', fontFamily: 'monospace', maxHeight: 80, overflowY: 'auto' }}>
                {selectedInvoice.qr_code_tlv || 'AQ1WaXZhIFN0dWRpbwITMzAwMDAwMDAwMDAwMDAzAxQyMDI2LTA4LTI3VDEwOjAwOjAwBAMxMDAFAzE1'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setSelectedInvoice(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
