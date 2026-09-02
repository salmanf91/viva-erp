import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt  = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = n => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN');
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const INV_SOURCES = [
  { value: 'own',             label: 'Own Funds' },
  { value: 'external_credit', label: 'External Credit / Loan' },
  { value: 'income',          label: 'Other Income' },
];
const DRW_SOURCES = [
  { value: 'personal',      label: 'Personal Use' },
  { value: 'expense_repay', label: 'Expense Repayment' },
  { value: 'loan_repay',    label: 'Loan Repayment' },
  { value: 'other',         label: 'Other' },
];
const SOURCE_LABEL = Object.fromEntries([...INV_SOURCES, ...DRW_SOURCES].map(s => [s.value, s.label]));
const PARTNER_COLORS = ['var(--accent)', 'var(--cyan)', 'var(--green)'];

const PERSONAL_CATEGORIES = [
  { value: 'personal_payment',   label: 'Personal Payment (Paid by Partner)' },
  { value: 'personal_expense',   label: 'Personal Expense' },
  { value: 'partner_transfer',   label: 'Transfer to Other Partner' },
  { value: 'personal_loan',      label: 'Personal Loan / Advance' },
  { value: 'personal_repayment', label: 'Personal Repayment / Settlement' },
  { value: 'vehicle_fuel',       label: 'Vehicle & Fuel' },
  { value: 'household',          label: 'Household' },
  { value: 'other_personal',     label: 'Other Personal' },
];
const PERS_CAT_LABEL = Object.fromEntries(PERSONAL_CATEGORIES.map(c => [c.value, c.label]));

const TAB_STYLE = (active) => ({
  padding: '9px 20px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
  background: 'none', color: active ? 'var(--accent)' : 'var(--muted)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2,
  transition: 'all .15s',
});

export default function PartnersPage() {
  const [tab, setTab]             = useState('personal');   // 'personal' | 'overview' | 'ledger' | 'reminders'
  const [partners, setPartners]   = useState([]);
  const [reminders, setReminders] = useState([]);
  const [ledger, setLedger]       = useState({});           // { [partnerId]: [...rows] }
  const [activePid, setActivePid] = useState(null);         // selected partner for capital ledger tab
  const [loading, setLoading]     = useState(true);
  const [showRem, setShowRem]     = useState(false);
  const [remForm, setRemForm]     = useState({ note: '', type: 'warning' });

  // ── Capital form state ──
  const emptyForm = () => ({
    partner_id: '', type: 'investment', source: 'own',
    amount: '', mode: 'cash', note: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [form, setForm] = useState(emptyForm());

  // ── Personal Accounts State ──
  const [persSummary, setPersSummary]   = useState({ partners: [], combined: { total_credit: 0, total_debit: 0, net_balance: 0, tx_count: 0 } });
  const [persLedger, setPersLedger]     = useState([]);
  const [persActivePid, setPersActivePid] = useState('all'); // 'all' or partner id
  const [persTypeFilter, setPersTypeFilter] = useState('all'); // 'all' | 'credit' | 'debit'
  const [persCatFilter, setPersCatFilter] = useState('all');
  const [persSearch, setPersSearch]     = useState('');
  const [showPersModal, setShowPersModal] = useState(false);
  const [editingPersEntry, setEditingPersEntry] = useState(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [persForm, setPersForm] = useState({
    partner_id: '',
    entry_date: new Date().toISOString().slice(0, 10),
    type: 'credit',
    category: 'personal_expense',
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    description: '',
  });

  const load = () => Promise.all([
    api.get('/partners').then(r => setPartners(r.data)),
    api.get('/partners/reminders').then(r => setReminders(r.data)),
    loadPersonalSummary(),
  ]).finally(() => setLoading(false));

  const loadPersonalSummary = async () => {
    try {
      const r = await api.get('/partners/personal/summary');
      setPersSummary(r.data);
    } catch (e) {
      console.error('Failed to load personal accounts summary', e);
    }
  };

  const loadPersonalLedger = async () => {
    try {
      const pId = persActivePid || 'all';
      let url = `/partners/personal/ledger/${pId}?type=${persTypeFilter}&category=${persCatFilter}`;
      const r = await api.get(url);
      setPersLedger(r.data || []);
    } catch (e) {
      console.error('Failed to load personal ledger', e);
    }
  };

  useEffect(() => { load(); }, []);

  // auto-select first partner for capital ledger tab
  useEffect(() => {
    if (partners.length && !activePid) setActivePid(partners[0].id);
    if (partners.length && !persForm.partner_id) setPersForm(f => ({ ...f, partner_id: partners[0].id }));
  }, [partners]);

  useEffect(() => {
    if (tab === 'personal') {
      loadPersonalSummary();
      loadPersonalLedger();
    }
  }, [tab, persActivePid, persTypeFilter, persCatFilter]);

  const loadLedger = async id => {
    const r = await api.get(`/partners/${id}/ledger`);
    setLedger(prev => ({ ...prev, [id]: r.data }));
  };

  useEffect(() => {
    if (tab === 'ledger' && activePid && !ledger[activePid]) loadLedger(activePid);
  }, [tab, activePid]);

  const saveTransaction = async () => {
    if (!form.partner_id || !form.amount) return;
    await api.post('/partners/payments', {
      partner_id: +form.partner_id, amount: +form.amount,
      type: form.type, source: form.source,
      payment_date: form.date, mode: form.mode, note: form.note || null,
    });
    setForm(emptyForm());
    await load();
    if (activePid) {
      const r = await api.get(`/partners/${activePid}/ledger`);
      setLedger(prev => ({ ...prev, [activePid]: r.data }));
    }
  };

  const savePersonalEntry = async () => {
    if (!persForm.partner_id || !persForm.amount || Number(persForm.amount) <= 0) {
      alert('Please select a partner and enter a valid amount.');
      return;
    }
    try {
      if (editingPersEntry) {
        await api.put(`/partners/personal/entries/${editingPersEntry.id}`, {
          partner_id: +persForm.partner_id,
          entry_date: persForm.entry_date,
          type: persForm.type,
          category: persForm.category,
          amount: +persForm.amount,
          payment_mode: persForm.payment_mode,
          reference_no: persForm.reference_no,
          description: persForm.description,
        });
      } else {
        await api.post('/partners/personal/entries', {
          partner_id: +persForm.partner_id,
          entry_date: persForm.entry_date,
          type: persForm.type,
          category: persForm.category,
          amount: +persForm.amount,
          payment_mode: persForm.payment_mode,
          reference_no: persForm.reference_no,
          description: persForm.description,
        });
      }
      setShowPersModal(false);
      setEditingPersEntry(null);
      resetPersForm();
      loadPersonalSummary();
      loadPersonalLedger();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to save personal entry');
    }
  };

  const deletePersonalEntry = async (id) => {
    if (!confirm('Are you sure you want to delete this personal entry?')) return;
    try {
      await api.delete(`/partners/personal/entries/${id}`);
      loadPersonalSummary();
      loadPersonalLedger();
    } catch (e) {
      alert('Failed to delete personal entry');
    }
  };

  const openEditPersonalModal = (entry) => {
    setEditingPersEntry(entry);
    setPersForm({
      partner_id: entry.partner_id,
      entry_date: entry.entry_date ? entry.entry_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: entry.type,
      category: entry.category,
      amount: entry.amount,
      payment_mode: entry.payment_mode || 'cash',
      reference_no: entry.reference_no || '',
      description: entry.description || '',
    });
    setShowPersModal(true);
  };

  const openNewPersonalModal = (defaultType = 'credit', partnerId = null) => {
    setEditingPersEntry(null);
    setPersForm({
      partner_id: partnerId || (persActivePid !== 'all' ? persActivePid : partners[0]?.id || ''),
      entry_date: new Date().toISOString().slice(0, 10),
      type: defaultType,
      category: defaultType === 'credit' ? 'personal_payment' : 'personal_expense',
      amount: '',
      payment_mode: 'cash',
      reference_no: '',
      description: '',
    });
    setShowPersModal(true);
  };

  const resetPersForm = () => {
    setPersForm({
      partner_id: partners[0]?.id || '',
      entry_date: new Date().toISOString().slice(0, 10),
      type: 'credit',
      category: 'personal_expense',
      amount: '',
      payment_mode: 'cash',
      reference_no: '',
      description: '',
    });
  };

  const addReminder = async () => {
    if (!remForm.note.trim()) return;
    await api.post('/partners/reminders', { note: remForm.note, type: remForm.type });
    setShowRem(false);
    setRemForm({ note: '', type: 'warning' });
    load();
  };

  const resolveReminder = async id => {
    await api.put(`/partners/reminders/${id}/resolve`);
    load();
  };

  if (loading) return <div className="spinner">Loading…</div>;

  const pendingReminders = reminders.filter(r => !r.is_resolved);
  const sources = form.type === 'investment' ? INV_SOURCES : DRW_SOURCES;

  // Filtered personal ledger rows for search
  const filteredPersLedger = persLedger.filter(r => {
    if (!persSearch.trim()) return true;
    const q = persSearch.toLowerCase();
    return (
      (r.partner_name || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.reference_no || '').toLowerCase().includes(q) ||
      (PERS_CAT_LABEL[r.category] || r.category || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Header */}
      <div className="sec-hd mb16">
        <div>
          <div className="sec-title">Partners &amp; Capital</div>
          <div className="sec-sub">
            Personal Credit/Debit Accounts, Capital Equity &amp; Reminders
          </div>
        </div>
        {tab === 'personal' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowStatementModal(true)}>
              🖨️ Statement
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => openNewPersonalModal('credit')}>
              + Record Personal Credit
            </button>
            <button className="btn btn-red btn-sm" onClick={() => openNewPersonalModal('debit')}>
              − Record Personal Debit
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button style={TAB_STYLE(tab === 'personal')} onClick={() => setTab('personal')}>
          👤 Personal Accounts
        </button>
        <button style={TAB_STYLE(tab === 'overview')} onClick={() => setTab('overview')}>
          💼 Capital Overview
        </button>
        <button style={TAB_STYLE(tab === 'ledger')} onClick={() => setTab('ledger')}>
          📒 Capital Ledger
        </button>
        <button style={TAB_STYLE(tab === 'reminders')} onClick={() => setTab('reminders')}>
          🔔 Reminders {pendingReminders.length > 0 && <span className="badge b-yellow" style={{ fontSize: 10, marginLeft: 4 }}>{pendingReminders.length}</span>}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: 👤 PERSONAL ACCOUNTS (CREDIT & DEBIT SEPARATE KHATA)
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'personal' && (
        <>
          {/* Independence Info Banner */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            color: '#475569'
          }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <div>
              <strong>Independent Personal Ledger:</strong> This module tracks payments and transactions made personally by partners. It is 100% separate from company books and does not affect company accounts, expenses, P&amp;L, or capital equity.
            </div>
          </div>

          {/* Partner Personal Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(persSummary.partners.length + 1, 3)}, 1fr)`, gap: 14, marginBottom: 20 }}>
            {persSummary.partners.map((p, i) => {
              const color = PARTNER_COLORS[i % PARTNER_COLORS.length];
              const isSelected = String(persActivePid) === String(p.id);
              const netBal = Number(p.net_balance || 0);

              return (
                <div
                  key={p.id}
                  className="card"
                  onClick={() => setPersActivePid(p.id)}
                  style={{
                    borderTop: `4px solid ${color}`,
                    padding: '16px 18px',
                    cursor: 'pointer',
                    background: isSelected ? '#f5f3ff' : '#fff',
                    boxShadow: isSelected ? '0 0 0 2px var(--accent)' : 'none',
                    transition: 'all .15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.tx_count} personal entries</div>
                    </div>
                    <span className="badge" style={{ background: '#ede9fe', color: 'var(--accent)', fontSize: 11, fontWeight: 700 }}>
                      {isSelected ? '✓ Selected' : 'Personal Khata'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Total Credit (+)</span>
                      <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(p.total_credit)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Total Debit (−)</span>
                      <span style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(p.total_debit)}</span>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>Net Balance</span>
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
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, fontSize: 11, padding: '4px 6px', color: 'var(--green)', borderColor: '#86efac' }}
                      onClick={(e) => { e.stopPropagation(); openNewPersonalModal('credit', p.id); }}
                    >
                      + Credit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, fontSize: 11, padding: '4px 6px', color: 'var(--red)', borderColor: '#fca5a5' }}
                      onClick={(e) => { e.stopPropagation(); openNewPersonalModal('debit', p.id); }}
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
              onClick={() => setPersActivePid('all')}
              style={{
                borderTop: '4px solid #64748b',
                padding: '16px 18px',
                background: persActivePid === 'all' ? '#f1f5f9' : 'var(--light)',
                cursor: 'pointer',
                boxShadow: persActivePid === 'all' ? '0 0 0 2px #64748b' : 'none',
                transition: 'all .15s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#475569' }}>Combined Personal</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{persSummary.combined.tx_count} total entries</div>
                </div>
                <span className="badge b-gray" style={{ fontSize: 11, fontWeight: 700 }}>
                  {persActivePid === 'all' ? '✓ Selected' : 'Both Partners'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Combined Credit (+)</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(persSummary.combined.total_credit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Combined Debit (−)</span>
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
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', marginTop: 14, fontSize: 11, color: '#475569' }}
                onClick={(e) => { e.stopPropagation(); setPersActivePid('all'); }}
              >
                View All Transactions
              </button>
            </div>
          </div>

          {/* Personal Account Ledger */}
          <div className="card">
            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {/* Partner pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPersActivePid('all')}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: '1px solid',
                    borderColor: persActivePid === 'all' ? 'var(--accent)' : 'var(--border)',
                    background: persActivePid === 'all' ? 'var(--accent)' : '#fff',
                    color: persActivePid === 'all' ? '#fff' : 'var(--text)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  All Partners
                </button>
                {partners.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPersActivePid(p.id)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, border: '1px solid',
                      borderColor: String(persActivePid) === String(p.id) ? 'var(--accent)' : 'var(--border)',
                      background: String(persActivePid) === String(p.id) ? 'var(--accent)' : '#fff',
                      color: String(persActivePid) === String(p.id) ? '#fff' : 'var(--text)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    👤 {p.name}
                  </button>
                ))}
              </div>

              {/* Type and Category dropdowns */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={persTypeFilter}
                  onChange={e => setPersTypeFilter(e.target.value)}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                >
                  <option value="all">All Types (Credit &amp; Debit)</option>
                  <option value="credit">🟢 Credit (+) Only</option>
                  <option value="debit">🔴 Debit (−) Only</option>
                </select>

                <select
                  value={persCatFilter}
                  onChange={e => setPersCatFilter(e.target.value)}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                >
                  <option value="all">All Categories</option>
                  {PERSONAL_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="🔍 Search notes, ref..."
                  value={persSearch}
                  onChange={e => setPersSearch(e.target.value)}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', width: 160 }}
                />
              </div>
            </div>

            {/* Ledger Table */}
            {filteredPersLedger.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 28, marginBottom: 6 }}>📑</div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>No personal account entries found</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Use <b>+ Record Personal Credit</b> or <b>− Record Personal Debit</b> above to add a transaction.
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
                    {filteredPersLedger.map((r, idx) => {
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
                            {r.payment_mode === 'bank_transfer' ? 'Bank' : r.payment_mode || 'cash'}
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
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', fontSize: 11 }}
                                onClick={() => openEditPersonalModal(r)}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', fontSize: 11, color: '#ef4444' }}
                                onClick={() => deletePersonalEntry(r.id)}
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
                      <td colSpan={7} style={{ fontSize: 13, color: 'var(--muted)' }}>Page Totals ({filteredPersLedger.length} entries)</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontSize: 13 }}>
                        {fmt(filteredPersLedger.filter(x => x.type === 'credit').reduce((s, x) => s + Number(x.amount || 0), 0))}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--red)', fontSize: 13 }}>
                        {fmt(filteredPersLedger.filter(x => x.type === 'debit').reduce((s, x) => s + Number(x.amount || 0), 0))}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 14 }}>
                        {fmt(
                          filteredPersLedger.filter(x => x.type === 'credit').reduce((s, x) => s + Number(x.amount || 0), 0) -
                          filteredPersLedger.filter(x => x.type === 'debit').reduce((s, x) => s + Number(x.amount || 0), 0)
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: 💼 CAPITAL OVERVIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* Partner summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${partners.length + 1}, 1fr)`, gap: 12, marginBottom: 20 }}>
            {partners.map((p, i) => {
              const invested = Number(p.total_invested || 0);
              const drawn    = Number(p.total_drawn    || 0);
              const net      = Number(p.net_capital    || 0);
              const color    = PARTNER_COLORS[i % PARTNER_COLORS.length];
              return (
                <div key={p.id} className="card" style={{ borderTop: `3px solid ${color}`, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color, marginBottom: 10 }}>{p.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Total Invested</span>
                      <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(invested)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Total Drawn</span>
                      <span style={{ fontWeight: 700, color: drawn > 0 ? 'var(--red)' : 'var(--muted)' }}>−{fmt(drawn)}</span>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ fontWeight: 700 }}>Net Capital</span>
                      <span style={{ fontWeight: 800, color }}>{fmt(net)}</span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm"
                    style={{ marginTop: 12, width: '100%', fontSize: 12, color }}
                    onClick={() => { setActivePid(p.id); setTab('ledger'); }}>
                    📒 View Capital Ledger
                  </button>
                </div>
              );
            })}
            {/* Combined */}
            <div className="card" style={{ borderTop: '3px solid var(--muted)', padding: '16px 18px', background: 'var(--light)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Combined Capital</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Total Invested</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(partners.reduce((s, p) => s + Number(p.total_invested || 0), 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Total Drawn</span>
                  <span style={{ fontWeight: 700, color: 'var(--red)' }}>−{fmt(partners.reduce((s, p) => s + Number(p.total_drawn || 0), 0))}</span>
                </div>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ fontWeight: 700 }}>Net Capital</span>
                  <span style={{ fontWeight: 800 }}>{fmt(partners.reduce((s, p) => s + Number(p.net_capital || 0), 0))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Record capital transaction form */}
          <div className="card">
            <div className="card-hd">Record Capital Transaction</div>
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxWidth: 300 }}>
              {[
                { val: 'investment', label: '↑ Investment', color: 'var(--green)' },
                { val: 'drawing',    label: '↓ Drawing',    color: 'var(--red)' },
              ].map(t => (
                <button key={t.val} onClick={() => setForm(f => ({ ...f, type: t.val, source: t.val === 'investment' ? 'own' : 'personal' }))}
                  style={{
                    flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: form.type === t.val ? t.color : 'var(--white)',
                    color: form.type === t.val ? '#fff' : 'var(--muted)',
                    transition: 'all .15s',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Partner</label>
                <select value={form.partner_id} onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))}>
                  <option value="">Select partner…</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Amount (₹)</label>
                <input type="number" placeholder="e.g. 15000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="field">
                <label>{form.type === 'investment' ? 'Source' : 'Reason'}</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Mode</label>
                <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / NEFT</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="field">
                <label>Note <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
                <input placeholder="e.g. First tranche" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            {form.partner_id && form.amount && (
              <div className="calc-box mt12" style={{
                borderColor: form.type === 'investment' ? '#86efac' : '#fca5a5',
                background:  form.type === 'investment' ? '#f0fdf4'  : '#fef2f2',
              }}>
                <div className="calc-row">
                  <span className="cl">{partners.find(p => p.id === +form.partner_id)?.name}</span>
                  <span className="cv">{form.type === 'investment' ? '↑ Investment' : '↓ Drawing'}</span>
                </div>
                <div className="calc-row">
                  <span className="cl">{SOURCE_LABEL[form.source]}</span>
                  <span className="cv" style={{ color: form.type === 'investment' ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>
                    {form.type === 'investment' ? '+' : '−'}{fmt(+form.amount)}
                  </span>
                </div>
              </div>
            )}
            <div className="row mt12">
              <button className="btn btn-primary" onClick={saveTransaction} disabled={!form.partner_id || !form.amount}>Save Capital Transaction</button>
              <button className="btn btn-ghost" onClick={() => setForm(emptyForm())}>Clear</button>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: 📒 CAPITAL LEDGER
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'ledger' && (
        <div className="card">
          {/* Partner selector tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {partners.map((p, i) => {
              const color = PARTNER_COLORS[i % PARTNER_COLORS.length];
              const active = activePid === p.id;
              return (
                <button key={p.id}
                  onClick={() => { setActivePid(p.id); if (!ledger[p.id]) loadLedger(p.id); }}
                  style={{
                    padding: '7px 18px', borderRadius: 8, border: `2px solid ${active ? color : 'var(--border)'}`,
                    background: active ? color : 'var(--white)', color: active ? '#fff' : 'var(--text)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>
                  {p.name}
                </button>
              );
            })}
          </div>

          {(() => {
            const p     = partners.find(x => x.id === activePid);
            const rows  = ledger[activePid] || [];
            const color = PARTNER_COLORS[partners.indexOf(p) % PARTNER_COLORS.length];
            if (!p) return null;
            return (
              <>
                {/* Mini summary */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total Invested', value: fmt(p.total_invested), color: 'var(--green)' },
                    { label: 'Total Drawn',    value: fmt(p.total_drawn),    color: 'var(--red)' },
                    { label: 'Net Capital',    value: fmt(p.net_capital),    color },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--light)', borderRadius: 8, padding: '10px 16px', minWidth: 140 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {rows.length === 0
                  ? <div className="empty-state">No capital transactions yet.</div>
                  : (
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Source / Reason</th>
                          <th>Mode</th>
                          <th>Note</th>
                          <th style={{ textAlign: 'right', color: 'var(--green)' }}>Invested (+)</th>
                          <th style={{ textAlign: 'right', color: 'var(--red)' }}>Drawn (−)</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, idx) => (
                          <tr key={r.id} style={{ background: r.type === 'drawing' ? 'var(--red-l)' : 'inherit' }}>
                            <td style={{ color: 'var(--muted)', fontSize: 12 }}>{idx + 1}</td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtD(r.payment_date?.slice(0, 10))}</td>
                            <td>
                              {r.type === 'investment'
                                ? <span className="badge b-green" style={{ fontSize: 11 }}>↑ Investment</span>
                                : <span className="badge b-red"   style={{ fontSize: 11 }}>↓ Drawing</span>}
                            </td>
                            <td style={{ fontSize: 12 }}>{SOURCE_LABEL[r.source] || r.source || '—'}</td>
                            <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{r.mode || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.note || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>
                              {r.type === 'investment' ? fmt(r.amount) : ''}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>
                              {r.type === 'drawing' ? fmt(r.amount) : ''}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color }}>
                              {fmt(r.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--light)', fontWeight: 800 }}>
                          <td colSpan={6} style={{ fontSize: 13, color: 'var(--muted)' }}>Net Capital</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)', fontSize: 13 }}>{fmt(p.total_invested)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--red)', fontSize: 13 }}>−{fmt(p.total_drawn)}</td>
                          <td style={{ textAlign: 'right', color, fontSize: 14 }}>{fmt(p.net_capital)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
              </>
            );
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: 🔔 REMINDERS
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'reminders' && (
        <div className="card">
          <div className="card-hd">
            Reminders
            <a onClick={() => setShowRem(true)}>+ Add</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reminders.length === 0 && <div className="empty-state">No reminders.</div>}
            {reminders.map(r => (
              <div key={r.id} style={{
                border: `1px solid ${r.is_resolved ? 'var(--border)' : r.type === 'critical' ? '#fca5a5' : '#fcd34d'}`,
                background: r.is_resolved ? 'var(--light)' : r.type === 'critical' ? 'var(--red-l)' : 'var(--yellow-l)',
                borderRadius: 8, padding: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: r.is_resolved ? 'var(--muted)' : r.type === 'critical' ? 'var(--red)' : 'var(--yellow)' }}>
                    {r.type === 'critical' ? '🔴' : r.is_resolved ? '✅' : '⏳'} {r.title}
                  </div>
                  <span className={`badge ${r.is_resolved ? 'b-gray' : r.type === 'critical' ? 'b-red' : 'b-yellow'}`}>
                    {r.is_resolved ? 'Resolved' : r.type === 'critical' ? 'Critical' : 'Open'}
                  </span>
                </div>
                {r.body && r.body !== r.title && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{r.body}</div>}
                {!r.is_resolved && (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => resolveReminder(r.id)}>Mark Resolved</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL: RECORD / EDIT PERSONAL ACCOUNT ENTRY
      ════════════════════════════════════════════════════════════════════════ */}
      {showPersModal && (
        <div className="modal-overlay" onClick={() => setShowPersModal(false)}>
          <div className="modal" style={{ width: 560, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>
                {editingPersEntry ? '✏️ Edit Personal Entry' : '👤 Record Partner Personal Entry'}
              </h2>
            </div>

            {/* Toggle Credit vs Debit */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setPersForm(f => ({ ...f, type: 'credit', category: f.category || 'personal_payment' }))}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: persForm.type === 'credit' ? 'var(--green)' : 'var(--white)',
                  color: persForm.type === 'credit' ? '#fff' : 'var(--muted)',
                  transition: 'all .15s',
                }}
              >
                🟢 [+] Credit (Personal Payment / Given)
              </button>
              <button
                type="button"
                onClick={() => setPersForm(f => ({ ...f, type: 'debit', category: f.category || 'personal_expense' }))}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: persForm.type === 'debit' ? 'var(--red)' : 'var(--white)',
                  color: persForm.type === 'debit' ? '#fff' : 'var(--muted)',
                  transition: 'all .15s',
                }}
              >
                🔴 [−] Debit (Personal Expense / Spent)
              </button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Partner *</label>
                <select
                  value={persForm.partner_id}
                  onChange={e => setPersForm(f => ({ ...f, partner_id: e.target.value }))}
                >
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Entry Date *</label>
                <input
                  type="date"
                  value={persForm.entry_date}
                  onChange={e => setPersForm(f => ({ ...f, entry_date: e.target.value }))}
                />
              </div>

              <div className="field">
                <label>Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={persForm.amount}
                  onChange={e => setPersForm(f => ({ ...f, amount: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="field">
                <label>Category</label>
                <select
                  value={persForm.category}
                  onChange={e => setPersForm(f => ({ ...f, category: e.target.value }))}
                >
                  {PERSONAL_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Payment Mode</label>
                <select
                  value={persForm.payment_mode}
                  onChange={e => setPersForm(f => ({ ...f, payment_mode: e.target.value }))}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="field">
                <label>Reference No. / Cheque #</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-98234 / CHQ-102"
                  value={persForm.reference_no}
                  onChange={e => setPersForm(f => ({ ...f, reference_no: e.target.value }))}
                />
              </div>

              <div className="field form-full">
                <label>Description / Particulars</label>
                <input
                  type="text"
                  placeholder="e.g. Paid for factory diesel from personal account"
                  value={persForm.description}
                  onChange={e => setPersForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            {persForm.partner_id && persForm.amount && (
              <div className="calc-box mt12" style={{
                borderColor: persForm.type === 'credit' ? '#86efac' : '#fca5a5',
                background:  persForm.type === 'credit' ? '#f0fdf4'  : '#fef2f2',
              }}>
                <div className="calc-row">
                  <span className="cl">{partners.find(p => p.id === +persForm.partner_id)?.name}</span>
                  <span className="cv">{persForm.type === 'credit' ? '🟢 Personal Credit' : '🔴 Personal Debit'}</span>
                </div>
                <div className="calc-row">
                  <span className="cl">{PERS_CAT_LABEL[persForm.category] || persForm.category}</span>
                  <span className="cv" style={{ color: persForm.type === 'credit' ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>
                    {persForm.type === 'credit' ? '+' : '−'}{fmt(+persForm.amount)}
                  </span>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowPersModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={savePersonalEntry}
                disabled={!persForm.partner_id || !persForm.amount || Number(persForm.amount) <= 0}
              >
                {editingPersEntry ? 'Save Changes' : 'Record Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL: PRINTABLE STATEMENT VIEW
      ════════════════════════════════════════════════════════════════════════ */}
      {showStatementModal && (
        <div className="modal-overlay" onClick={() => setShowStatementModal(false)}>
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
                  Partner Personal Account Statement — {persActivePid === 'all' ? 'All Partners Combined' : partners.find(p => p.id === +persActivePid)?.name}
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
                  {filteredPersLedger.map((r) => (
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
              <button className="btn btn-ghost" onClick={() => setShowStatementModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add reminder modal */}
      {showRem && (
        <div className="modal-overlay" onClick={() => setShowRem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Reminder</h2>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Note</label>
              <input autoFocus placeholder="e.g. Collect Partner B balance"
                value={remForm.note} onChange={e => setRemForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 4 }}>
              <label>Type</label>
              <select value={remForm.type} onChange={e => setRemForm(f => ({ ...f, type: e.target.value }))}>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowRem(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addReminder} disabled={!remForm.note.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
