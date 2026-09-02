import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = n => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN');
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const PARTNER_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b'];

const PERSONAL_CATEGORIES = [
  { value: 'personal_payment',   label: 'Personal Payment (Paid by Partner)' },
  { value: 'personal_expense',   label: 'Personal Expense / Shopping' },
  { value: 'partner_transfer',   label: 'Transfer to Other Partner' },
  { value: 'personal_loan',      label: 'Personal Loan / Advance' },
  { value: 'personal_repayment', label: 'Personal Repayment / Settlement' },
  { value: 'vehicle_fuel',       label: 'Vehicle & Fuel' },
  { value: 'household',          label: 'Household & Family' },
  { value: 'other_personal',     label: 'Other Personal' },
];
const PERS_CAT_LABEL = Object.fromEntries(PERSONAL_CATEGORIES.map(c => [c.value, c.label]));

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export default function PersonalAccountsPage() {
  const [partners, setPartners]         = useState([]);
  const [persSummary, setPersSummary]   = useState({ partners: [], combined: { total_credit: 0, total_debit: 0, net_balance: 0, tx_count: 0 } });
  const [persLedger, setPersLedger]     = useState([]);
  const [activePid, setActivePid]       = useState('all'); // 'all' or partner id
  const [typeFilter, setTypeFilter]     = useState('all'); // 'all' | 'credit' | 'debit'
  const [catFilter, setCatFilter]       = useState('all');
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showStatement, setShowStatement] = useState(false);

  const [form, setForm] = useState({
    partner_id: '',
    entry_date: new Date().toISOString().slice(0, 10),
    type: 'credit',
    category: 'personal_payment',
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    description: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [partnersRes, summaryRes] = await Promise.all([
        api.get('/partners'),
        api.get('/partners/personal/summary'),
      ]);
      setPartners(partnersRes.data || []);
      setPersSummary(summaryRes.data || { partners: [], combined: { total_credit: 0, total_debit: 0, net_balance: 0, tx_count: 0 } });
      if (partnersRes.data?.length > 0 && !form.partner_id) {
        setForm(f => ({ ...f, partner_id: partnersRes.data[0].id }));
      }
    } catch (e) {
      console.error('Failed to load personal accounts data', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async () => {
    try {
      const pId = activePid || 'all';
      const url = `/partners/personal/ledger/${pId}?type=${typeFilter}&category=${catFilter}`;
      const r = await api.get(url);
      setPersLedger(r.data || []);
    } catch (e) {
      console.error('Failed to load personal ledger', e);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    loadLedger();
  }, [activePid, typeFilter, catFilter]);

  const saveEntry = async () => {
    if (!form.partner_id || !form.amount || Number(form.amount) <= 0) {
      alert('Please select a partner and enter a valid amount.');
      return;
    }
    try {
      if (editingEntry) {
        await api.put(`/partners/personal/entries/${editingEntry.id}`, {
          partner_id: +form.partner_id,
          entry_date: form.entry_date,
          type: form.type,
          category: form.category,
          amount: +form.amount,
          payment_mode: form.payment_mode,
          reference_no: form.reference_no,
          description: form.description,
        });
      } else {
        await api.post('/partners/personal/entries', {
          partner_id: +form.partner_id,
          entry_date: form.entry_date,
          type: form.type,
          category: form.category,
          amount: +form.amount,
          payment_mode: form.payment_mode,
          reference_no: form.reference_no,
          description: form.description,
        });
      }
      setShowModal(false);
      setEditingEntry(null);
      resetForm();
      loadData();
      loadLedger();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to save personal entry');
    }
  };

  const deleteEntry = async (id) => {
    if (!confirm('Are you sure you want to delete this personal entry?')) return;
    try {
      await api.delete(`/partners/personal/entries/${id}`);
      loadData();
      loadLedger();
    } catch (e) {
      alert('Failed to delete personal entry');
    }
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setForm({
      partner_id: entry.partner_id,
      entry_date: entry.entry_date ? entry.entry_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: entry.type,
      category: entry.category,
      amount: String(entry.amount),
      payment_mode: entry.payment_mode || 'cash',
      reference_no: entry.reference_no || '',
      description: entry.description || '',
    });
    setShowModal(true);
  };

  const openNewModal = (defaultType = 'credit', partnerId = null) => {
    setEditingEntry(null);
    setForm({
      partner_id: partnerId || (activePid !== 'all' ? activePid : partners[0]?.id || ''),
      entry_date: new Date().toISOString().slice(0, 10),
      type: defaultType,
      category: defaultType === 'credit' ? 'personal_payment' : 'personal_expense',
      amount: '',
      payment_mode: 'cash',
      reference_no: '',
      description: '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({
      partner_id: partners[0]?.id || '',
      entry_date: new Date().toISOString().slice(0, 10),
      type: 'credit',
      category: 'personal_payment',
      amount: '',
      payment_mode: 'cash',
      reference_no: '',
      description: '',
    });
  };

  const addQuickAmount = (val) => {
    const curr = Number(form.amount || 0);
    setForm(f => ({ ...f, amount: String(curr + val) }));
  };

  if (loading && partners.length === 0) return <div className="spinner">Loading personal accounts…</div>;

  const filteredLedger = persLedger.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.partner_name || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.reference_no || '').toLowerCase().includes(q) ||
      (PERS_CAT_LABEL[r.category] || r.category || '').toLowerCase().includes(q)
    );
  });

  const selectedPartnerObj = partners.find(p => String(p.id) === String(form.partner_id));
  const currentSelectedSummary = persSummary.partners.find(p => String(p.id) === String(form.partner_id));
  const currentNet = Number(currentSelectedSummary?.net_balance || 0);
  const inputAmt = Number(form.amount || 0);
  const projectedNet = form.type === 'credit' ? (currentNet + inputAmt) : (currentNet - inputAmt);

  return (
    <>
      {/* Header */}
      <div className="sec-hd mb16" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="sec-title" style={{ margin: 0 }}>👤 Partner Personal Accounts</h1>
            <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 700, border: '1px solid #cbd5e1' }}>
              🔒 100% Independent of Company Accounts
            </span>
          </div>
          <div className="sec-sub" style={{ marginTop: 4 }}>
            Track payments, personal expenses &amp; settlements made personally by partners
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowStatement(true)}>
            🖨️ Statement
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}
            onClick={() => openNewModal('credit')}
          >
            + Record Credit (Paid Personally)
          </button>
          <button
            className="btn btn-red btn-sm"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', boxShadow: '0 2px 8px rgba(239,68,68,0.25)' }}
            onClick={() => openNewModal('debit')}
          >
            − Record Debit (Personal Expense)
          </button>
        </div>
      </div>

      {/* Info notice banner */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '10px 16px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: '#475569'
      }}>
        <span style={{ fontSize: 20 }}>🛡️</span>
        <div>
          <strong>Personal Money Movement Only:</strong> This module is exclusively for personal funds and private partner expenses. It does not affect company bank accounts, operational expenses, sales, or business capital equity.
        </div>
      </div>

      {/* Partner Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(persSummary.partners.length + 1, 3)}, 1fr)`, gap: 14, marginBottom: 20 }}>
        {persSummary.partners.map((p, i) => {
          const color = PARTNER_COLORS[i % PARTNER_COLORS.length];
          const isSelected = String(activePid) === String(p.id);
          const netBal = Number(p.net_balance || 0);

          return (
            <div
              key={p.id}
              className="card"
              onClick={() => setActivePid(p.id)}
              style={{
                borderTop: `4px solid ${color}`,
                padding: '16px 18px',
                cursor: 'pointer',
                background: isSelected ? '#f5f3ff' : '#fff',
                boxShadow: isSelected ? '0 0 0 2px var(--accent)' : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all .15s',
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.tx_count} personal entries</div>
                </div>
                <span className="badge" style={{
                  background: isSelected ? 'var(--accent)' : '#ede9fe',
                  color: isSelected ? '#fff' : 'var(--accent)',
                  fontSize: 10,
                  fontWeight: 700
                }}>
                  {isSelected ? '✓ Filter Active' : 'Personal Khata'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Total Paid (+)</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(p.total_credit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Total Spent (−)</span>
                  <span style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(p.total_debit)}</span>
                </div>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>Personal Balance</span>
                  <span style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: netBal > 0 ? 'var(--green)' : netBal < 0 ? 'var(--red)' : 'var(--text)'
                  }}>
                    {netBal > 0 ? '+' : ''}{fmt(netBal)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, fontSize: 11, padding: '4px 6px', color: 'var(--green)', borderColor: '#86efac', background: '#f0fdf4' }}
                  onClick={(e) => { e.stopPropagation(); openNewModal('credit', p.id); }}
                >
                  + Credit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, fontSize: 11, padding: '4px 6px', color: 'var(--red)', borderColor: '#fca5a5', background: '#fef2f2' }}
                  onClick={(e) => { e.stopPropagation(); openNewModal('debit', p.id); }}
                >
                  − Debit
                </button>
              </div>
            </div>
          );
        })}

        {/* Combined Card */}
        <div
          className="card"
          onClick={() => setActivePid('all')}
          style={{
            borderTop: '4px solid #64748b',
            padding: '16px 18px',
            background: activePid === 'all' ? '#f1f5f9' : 'var(--light)',
            cursor: 'pointer',
            boxShadow: activePid === 'all' ? '0 0 0 2px #64748b' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all .15s',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#475569' }}>Combined Accounts</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{persSummary.combined.tx_count} total entries</div>
            </div>
            <span className="badge b-gray" style={{ fontSize: 10, fontWeight: 700 }}>
              {activePid === 'all' ? '✓ Showing All' : 'Both Partners'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>Combined Paid (+)</span>
              <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(persSummary.combined.total_credit)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>Combined Spent (−)</span>
              <span style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(persSummary.combined.total_debit)}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Combined Net</span>
              <span style={{
                fontWeight: 800,
                fontSize: 15,
                color: persSummary.combined.net_balance > 0 ? 'var(--green)' : persSummary.combined.net_balance < 0 ? 'var(--red)' : 'var(--text)'
              }}>
                {persSummary.combined.net_balance > 0 ? '+' : ''}{fmt(persSummary.combined.net_balance)}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: 14, fontSize: 11, color: '#475569', background: '#fff' }}
            onClick={(e) => { e.stopPropagation(); setActivePid('all'); }}
          >
            View All Transactions
          </button>
        </div>
      </div>

      {/* Ledger Section */}
      <div className="card" style={{ borderRadius: 10, padding: 18 }}>
        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {/* Partner Selector Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActivePid('all')}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1px solid',
                borderColor: activePid === 'all' ? 'var(--accent)' : 'var(--border)',
                background: activePid === 'all' ? 'var(--accent)' : '#fff',
                color: activePid === 'all' ? '#fff' : 'var(--text)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              All Partners
            </button>
            {partners.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePid(p.id)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: '1px solid',
                  borderColor: String(activePid) === String(p.id) ? 'var(--accent)' : 'var(--border)',
                  background: String(activePid) === String(p.id) ? 'var(--accent)' : '#fff',
                  color: String(activePid) === String(p.id) ? '#fff' : 'var(--text)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}
              >
                👤 {p.name}
              </button>
            ))}
          </div>

          {/* Type, Category & Search Filters */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff' }}
            >
              <option value="all">All Types (Credit &amp; Debit)</option>
              <option value="credit">🟢 Credit (+) Only</option>
              <option value="debit">🔴 Debit (−) Only</option>
            </select>

            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff' }}
            >
              <option value="all">All Categories</option>
              {PERSONAL_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="🔍 Search notes, ref..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', width: 170 }}
            />
          </div>
        </div>

        {/* Ledger Table */}
        {filteredLedger.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📑</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>No personal account entries found</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Click <b>+ Record Credit (Paid Personally)</b> or <b>− Record Debit (Personal Expense)</b> above to log a transaction.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Date</th>
                  <th>Partner</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Payment Mode</th>
                  <th>Description / Ref</th>
                  <th style={{ textAlign: 'right', color: 'var(--green)' }}>Credit (+)</th>
                  <th style={{ textAlign: 'right', color: 'var(--red)' }}>Debit (−)</th>
                  <th style={{ textAlign: 'right' }}>Running Balance</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((r, idx) => {
                  const isCredit = r.type === 'credit';
                  return (
                    <tr key={r.id} style={{ background: isCredit ? 'inherit' : 'rgba(239, 68, 68, 0.02)' }}>
                      <td style={{ color: 'var(--muted)', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }}>{fmtD(r.entry_date?.slice(0, 10))}</td>
                      <td style={{ fontWeight: 700, fontSize: 12 }}>{r.partner_name}</td>
                      <td>
                        {isCredit ? (
                          <span className="badge b-green" style={{ fontSize: 11 }}>🟢 Credit</span>
                        ) : (
                          <span className="badge b-red" style={{ fontSize: 11 }}>🔴 Debit</span>
                        )}
                      </td>
                      <td>
                        <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          {PERS_CAT_LABEL[r.category] || r.category}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--muted)' }}>
                        {r.payment_mode === 'bank_transfer' ? 'Bank Transfer' : r.payment_mode || 'cash'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {r.description || '—'}
                        {r.reference_no && (
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Ref: {r.reference_no}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>
                        {isCredit ? fmt(r.amount) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>
                        {!isCredit ? fmt(r.amount) : '—'}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: 13,
                        color: r.running_balance > 0 ? 'var(--green)' : r.running_balance < 0 ? 'var(--red)' : 'var(--text)'
                      }}>
                        {r.running_balance > 0 ? '+' : ''}{fmt(r.running_balance)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px', fontSize: 11 }}
                            onClick={() => openEditModal(r)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px', fontSize: 11, color: '#ef4444' }}
                            onClick={() => deleteEntry(r.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                  <td colSpan={7} style={{ fontSize: 13, color: 'var(--muted)' }}>Page Totals ({filteredLedger.length} entries)</td>
                  <td style={{ textAlign: 'right', color: 'var(--green)', fontSize: 13 }}>
                    {fmt(filteredLedger.filter(x => x.type === 'credit').reduce((s, x) => s + Number(x.amount || 0), 0))}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--red)', fontSize: 13 }}>
                    {fmt(filteredLedger.filter(x => x.type === 'debit').reduce((s, x) => s + Number(x.amount || 0), 0))}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 14 }}>
                    {fmt(
                      filteredLedger.filter(x => x.type === 'credit').reduce((s, x) => s + Number(x.amount || 0), 0) -
                      filteredLedger.filter(x => x.type === 'debit').reduce((s, x) => s + Number(x.amount || 0), 0)
                    )}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          REDESIGNED LUXURY MODAL: RECORD / EDIT PERSONAL TRANSACTION
      ════════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            style={{
              width: 580,
              maxWidth: '95vw',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
              padding: 24,
              background: '#ffffff'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  {editingEntry ? '✏️ Edit Personal Transaction' : '💳 Personal Account Entry'}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Record payments or expenses made personally by partners
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 14, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Premium Segmented Switch for Credit vs Debit */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: '#f1f5f9',
              padding: 4,
              borderRadius: 10,
              marginBottom: 18,
              gap: 4
            }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, type: 'credit', category: f.category || 'personal_payment' }))}
                style={{
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: form.type === 'credit' ? '#10b981' : 'transparent',
                  color: form.type === 'credit' ? '#ffffff' : '#64748b',
                  boxShadow: form.type === 'credit' ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>💳</span>
                <span>[+] Credit (Paid Personally)</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, type: 'debit', category: f.category || 'personal_expense' }))}
                style={{
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: form.type === 'debit' ? '#ef4444' : 'transparent',
                  color: form.type === 'debit' ? '#ffffff' : '#64748b',
                  boxShadow: form.type === 'debit' ? '0 2px 8px rgba(239,68,68,0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>💸</span>
                <span>[−] Debit (Personal Expense)</span>
              </button>
            </div>

            {/* Form Fields */}
            <div className="form-grid">
              {/* Partner Field */}
              <div className="field">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Partner *</label>
                <select
                  value={form.partner_id}
                  onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))}
                  style={{ fontWeight: 600 }}
                >
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Field */}
              <div className="field">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Date *</label>
                <input
                  type="date"
                  value={form.entry_date}
                  onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
                />
              </div>

              {/* Amount Input with Quick Add Chips */}
              <div className="field form-full">
                <label style={{ fontWeight: 700, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Amount (₹) *</span>
                  <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 11 }}>Quick Add:</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: 12, fontSize: 16, fontWeight: 700, color: form.type === 'credit' ? '#10b981' : '#ef4444' }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    style={{
                      paddingLeft: 30,
                      fontSize: 16,
                      fontWeight: 800,
                      color: form.type === 'credit' ? '#047857' : '#b91c1c',
                      width: '100%'
                    }}
                    autoFocus
                  />
                </div>

                {/* Quick amount chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {QUICK_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => addQuickAmount(amt)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      +{fmtInt(amt)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, amount: '' }))}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#dc2626',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Category Field */}
              <div className="field">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Personal Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {PERSONAL_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Payment Mode Field */}
              <div className="field">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Payment Mode</label>
                <select
                  value={form.payment_mode}
                  onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}
                >
                  <option value="cash">💵 Cash</option>
                  <option value="bank_transfer">🏛️ Bank Transfer / NEFT</option>
                  <option value="upi">📱 UPI / GPay / PhonePe</option>
                  <option value="cheque">📜 Cheque</option>
                </select>
              </div>

              {/* Ref No Field */}
              <div className="field">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Ref / Cheque # (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-82934 / CHQ-104"
                  value={form.reference_no}
                  onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
                />
              </div>

              {/* Description Field */}
              <div className="field form-full">
                <label style={{ fontWeight: 700, fontSize: 12 }}>Description / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Paid for vehicle maintenance personally"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Real-time Calculation Summary Box */}
            {selectedPartnerObj && inputAmt > 0 && (
              <div style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 8,
                background: form.type === 'credit' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${form.type === 'credit' ? '#86efac' : '#fca5a5'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#475569' }}>Partner:</span>
                  <strong>{selectedPartnerObj.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#475569' }}>Current Personal Balance:</span>
                  <span style={{ fontWeight: 700 }}>{fmt(currentNet)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#475569' }}>This Entry:</span>
                  <span style={{ fontWeight: 700, color: form.type === 'credit' ? '#059669' : '#dc2626' }}>
                    {form.type === 'credit' ? '+' : '−'}{fmt(inputAmt)} ({PERS_CAT_LABEL[form.category] || form.category})
                  </span>
                </div>
                <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>
                  <span>Updated Personal Balance:</span>
                  <span style={{ color: projectedNet > 0 ? '#059669' : projectedNet < 0 ? '#dc2626' : '#1e293b' }}>
                    {projectedNet > 0 ? '+' : ''}{fmt(projectedNet)}
                  </span>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 18px', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveEntry}
                disabled={!form.partner_id || !form.amount || Number(form.amount) <= 0}
                style={{
                  padding: '8px 24px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: form.type === 'credit' ? '#10b981' : '#ef4444',
                  border: 'none',
                }}
              >
                {editingEntry ? 'Save Changes' : form.type === 'credit' ? 'Record Personal Credit' : 'Record Personal Debit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PRINTABLE STATEMENT MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showStatement && (
        <div className="modal-overlay" onClick={() => setShowStatement(false)}>
          <div className="modal" style={{ width: 720, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>🖨️ Partner Personal Statement</h2>
              <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>

            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 16 }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>VIVA STUDIO ERP</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  Partner Personal Account Statement — {activePid === 'all' ? 'All Partners Combined' : partners.find(p => String(p.id) === String(activePid))?.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Generated on {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
                </div>
              </div>

              {/* Statement Summary Table */}
              <table style={{ width: '100%', marginBottom: 16, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th>Date</th>
                    <th>Partner</th>
                    <th>Particulars</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                    <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                    <th style={{ textAlign: 'right' }}>Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtD(r.entry_date?.slice(0, 10))}</td>
                      <td style={{ fontWeight: 600 }}>{r.partner_name}</td>
                      <td>{r.description || '—'} {r.reference_no ? `(${r.reference_no})` : ''}</td>
                      <td>{PERS_CAT_LABEL[r.category] || r.category}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                        {r.type === 'credit' ? Number(r.amount).toFixed(2) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>
                        {r.type === 'debit' ? Number(r.amount).toFixed(2) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>
                        {Number(r.running_balance).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setShowStatement(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
