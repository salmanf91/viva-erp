import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function PlatformTenantsPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);

  // Module Modal State
  const [modTenant, setModTenant] = useState(null);
  const [modulesState, setModulesState] = useState({});
  const [loadingModules, setLoadingModules] = useState(false);
  const [savingModules, setSavingModules] = useState(false);

  const openModuleModal = async (tenant) => {
    setModTenant(tenant);
    setLoadingModules(true);
    try {
      const res = await api.get(`/tenants/${tenant.id}/modules`);
      setModulesState(res.data || {});
    } catch (err) {
      alert('Failed to load module configuration');
    } finally {
      setLoadingModules(false);
    }
  };

  const handleSaveModules = async () => {
    if (!modTenant) return;
    setSavingModules(true);
    try {
      await api.put(`/tenants/${modTenant.id}/modules`, modulesState);
      setMsg({ type: 'success', text: `Modules updated for workspace '${modTenant.name}'.` });
      setModTenant(null);
      setTimeout(() => setMsg(null), 3500);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save module configuration');
    } finally {
      setSavingModules(false);
    }
  };

  const loadTenants = () => {
    setLoading(true);
    api.get('/tenants')
      .then(r => setTenants(r.data))
      .catch(err => {
        setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load workspaces.' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const action = nextStatus === 'active' ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${action} this workspace? ${nextStatus === 'suspended' ? 'Users will not be able to log in until reactivated.' : ''}`)) return;

    try {
      await api.patch(`/tenants/${id}/status`, { status: nextStatus });
      loadTenants();
      setMsg({ type: 'success', text: `Workspace has been ${nextStatus === 'active' ? 'activated' : 'deactivated'}.` });
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update workspace status.' });
    }
  };

  const handleDeleteTenant = async (id, name) => {
    const confirmText = window.prompt(`⚠️ DANGER: To permanently delete workspace "${name}", please type the workspace name exactly as shown:`);
    if (confirmText !== name) {
      if (confirmText !== null) alert('Workspace name did not match. Deletion cancelled.');
      return;
    }

    const dropDb = window.confirm(`Do you also want to permanently DROP and ERASE the physical database for "${name}" from MySQL? (Click OK to delete DB, Cancel to keep DB file)`);

    try {
      await api.delete(`/tenants/${id}`, { data: { drop_database: dropDb } });
      loadTenants();
      setMsg({ type: 'success', text: `Workspace "${name}" and its records have been deleted.` });
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to delete workspace.' });
    }
  };

  const filteredTenants = tenants.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.slug && t.slug.toLowerCase().includes(q)) ||
      (t.country && t.country.toLowerCase().includes(q)) ||
      (t.db_name && t.db_name.toLowerCase().includes(q))
    );
  });

  const activeCount = tenants.filter(t => t.status !== 'suspended').length;
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length;

  return (
    <div>
      {/* Top Banner / Stats */}
      <div className="card mb16" style={{ background: 'linear-gradient(135deg, rgba(200,134,10,0.08), rgba(200,134,10,0.02))', borderColor: 'rgba(200,134,10,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>🛡️</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Super Admin · Platform Tenants</h2>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Centralized administration panel for isolated databases, company tenants, and workspace lifecycles.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/onboard" className="btn btn-primary btn-sm" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>➕</span> Onboard New Workspace
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="g4 mb16">
        <div className="stat-card">
          <div className="stat-label">Total Workspaces</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 800 }}>{tenants.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Workspaces</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{activeCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deactivated</div>
          <div className="stat-val" style={{ fontSize: 24, fontWeight: 800, color: suspendedCount > 0 ? 'var(--red)' : 'var(--muted)' }}>
            {suspendedCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Multi-Tenant Architecture</div>
          <div className="stat-val" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
            Isolated DB per Tenant
          </div>
        </div>
      </div>

      {/* Tenant Table Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Registered Tenant Directories ({filteredTenants.length})
          </div>
          <div style={{ width: 280 }}>
            <input
              type="text"
              placeholder="🔍 Search by company, slug, country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, width: '100%' }}
            />
          </div>
        </div>

        {msg && (
          <div className={`alert ${msg.type === 'error' ? 'alert-red' : 'alert-green'} mb12`}>
            <div className="a-icon">{msg.type === 'error' ? '⚠️' : '✓'}</div>
            <div><div className="a-title">{msg.text}</div></div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center' }} className="spinner">Loading tenant directories…</div>
        ) : filteredTenants.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>
            {search ? 'No workspaces match your search filter.' : 'No registered workspaces found.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Workspace &amp; Company</th>
                  <th>Country &amp; Currency</th>
                  <th>Isolated Database</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map(t => {
                  const isActive = t.status !== 'suspended';
                  const isPrimary = t.slug === 'viva_studio';
                  return (
                    <tr key={t.id} style={{ opacity: isActive ? 1 : 0.65 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {t.logo_url ? (
                            <img src={t.logo_url} alt="Logo" style={{ height: 32, width: 32, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)' }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                              {t.country === 'SA' ? '🇸🇦' : t.country === 'AE' ? '🇦🇪' : t.country === 'IN' ? '🇮🇳' : '🏢'}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Slug: <code>{t.slug}</code></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: 11 }}>
                          {t.country === 'SA' ? '🇸🇦 KSA' : t.country === 'AE' ? '🇦🇪 UAE' : t.country === 'IN' ? '🇮🇳 India' : t.country} · {t.currency}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{t.db_name || 'viva_erp'}</code>
                      </td>
                      <td style={{ fontSize: 12, textTransform: 'capitalize' }}>
                        {t.business_domain ? t.business_domain.replace('_', ' ') : 'General'}
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'b-green' : 'b-red'}`} style={{ fontSize: 10 }}>
                          {isActive ? '✓ Active' : '⏸ Deactivated'}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: 'var(--accent)', borderColor: 'var(--accent)' }}
                            onClick={() => openModuleModal(t)}
                          >
                            ⚙️ Modules
                          </button>
                          {!isPrimary && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11 }}
                              onClick={() => handleToggleStatus(t.id, t.status)}
                            >
                              {isActive ? '⏸ Deactivate' : '▶️ Activate'}
                            </button>
                          )}
                          {!isPrimary && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, color: 'var(--red)', borderColor: '#fca5a5' }}
                              onClick={() => handleDeleteTenant(t.id, t.name)}
                            >
                              🗑️ Delete
                            </button>
                          )}
                          {isPrimary && (
                            <span className="badge" style={{ fontSize: 10, background: 'rgba(200,134,10,0.1)', borderColor: 'rgba(200,134,10,0.3)', color: 'var(--accent)' }}>
                              👑 Master
                            </span>
                          )}
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

      {/* Module Configuration Modal */}
      {modTenant && (
        <div className="modal-overlay" onClick={() => setModTenant(null)}>
          <div
            className="modal"
            style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Workspace Modules & Features</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                  Configuring modules for <b>{modTenant.name}</b> (<code>{modTenant.slug}</code>)
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setModTenant(null)}
              >
                ✕
              </button>
            </div>

            {loadingModules ? (
              <div className="spinner" style={{ padding: 30 }}>Loading module settings…</div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', margin: '16px 0' }}>
                  {[
                    ['feature_accounting', '📈 Accounting & Finance'],
                    ['feature_expenses', '🧾 Expense Tracking'],
                    ['feature_party_ledger', '📒 Party Ledger'],
                    ['feature_quotations', '📄 Quotations & Estimates'],
                    ['feature_sales_invoicing', '🚚 Sales Invoicing'],
                    ['feature_delivery_notes', '🚚 Delivery Notes & Challans'],
                    ['feature_purchases', '📦 Purchases Master'],
                    ['feature_inventory_stock', '🏭 Raw Stock Inventory'],
                    ['feature_garment_production', '✂️ Garment Manufacturing'],
                    ['feature_staff_piece_log', '📋 Staff Piece Log'],
                    ['feature_payroll', '👷 Monthly Payroll'],
                    ['feature_zatca_einvoicing', '🇸🇦 Saudi ZATCA E-Invoicing'],
                  ].map(([k, label]) => (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '6px 0' }}>
                      <input
                        type="checkbox"
                        checked={!!modulesState[k]}
                        onChange={() => setModulesState(prev => ({ ...prev, [k]: !prev[k] }))}
                        style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                      />
                      <span style={{ fontWeight: modulesState[k] ? 700 : 400, color: modulesState[k] ? 'var(--text)' : 'var(--muted)' }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="modal-actions" style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setModTenant(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={savingModules}
                    onClick={handleSaveModules}
                  >
                    {savingModules ? 'Saving…' : 'Save Module Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
