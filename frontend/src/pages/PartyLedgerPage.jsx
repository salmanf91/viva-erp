import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { exportToCSV } from '../utils/csvExport';

const fmtD = s => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);
const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const TAB_STYLE = active => ({
  padding: '8px 18px',
  fontWeight: 600,
  fontSize: 13,
  border: 'none',
  cursor: 'pointer',
  borderRadius: 8,
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--muted)',
  transition: 'all .2s'
});

export default function PartyLedgerPage() {
  const { user } = useAuth();
  const currency = user?.currency || '₹';
  const fmt = n => `${currency} ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [tab, setTab] = useState('client'); // 'client' | 'vendor'
  const [parties, setParties] = useState({ clients: [], vendors: [] });
  const [selectedId, setSelectedId] = useState('');
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [ledger, setLedger] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch list of clients and vendors
  useEffect(() => {
    api.get('/finance/party-ledger/parties')
      .then(r => {
        setParties(r.data);
        if (tab === 'client' && r.data.clients?.length) {
          setSelectedId(String(r.data.clients[0].id));
        } else if (tab === 'vendor' && r.data.vendors?.length) {
          setSelectedId(String(r.data.vendors[0].id));
        }
      })
      .catch(err => console.error('Error fetching parties:', err));
  }, []);

  // Update selected party when switching tabs
  useEffect(() => {
    if (tab === 'client' && parties.clients?.length) {
      setSelectedId(String(parties.clients[0].id));
    } else if (tab === 'vendor' && parties.vendors?.length) {
      setSelectedId(String(parties.vendors[0].id));
    } else {
      setSelectedId('');
    }
    setLedger([]);
    setOpeningBalance(0);
  }, [tab, parties]);

  // Load ledger details
  const loadLedger = () => {
    if (!selectedId) return;
    setLoading(true);
    const endpoint = `/finance/party-ledger/${tab}/${selectedId}?from=${from}&to=${to}`;
    api.get(endpoint)
      .then(r => {
        setLedger(r.data.transactions || []);
        setOpeningBalance(r.data.openingBalance || 0);
      })
      .catch(err => console.error('Error loading ledger:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLedger();
  }, [selectedId, from, to]);

  const activeParty = () => {
    const list = tab === 'client' ? parties.clients : parties.vendors;
    return list.find(p => String(p.id) === selectedId) || null;
  };
  const currentParty = activeParty();

  const handlePrint = () => {
    window.print();
  };

  const CAT_LABEL = {
    shawl_nighty: 'Shawl Nighty',
    ordinary_nighty: 'Ordinary Nighty',
    shawl_nighty_lace: 'Shawl + Lace',
    mixed: 'Mixed',
  };

  const formatItems = text => {
    if (!text || text === 'null') return '—';
    let formatted = text;
    Object.entries(CAT_LABEL).forEach(([k, v]) => {
      formatted = formatted.replaceAll(k, v);
    });
    return formatted;
  };

  // Summaries
  const totalBilled = ledger.reduce((s, r) => s + r.debit, 0);
  const totalPaid = ledger.reduce((s, r) => s + r.credit, 0);
  const netBalance = openingBalance + totalBilled - totalPaid;

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!selectedId || (!ledger.length && openingBalance === 0)) {
      alert('No ledger transactions available to export.');
      return;
    }

    const partyName = currentParty?.name || 'Party';
    const filename = `${tab === 'client' ? 'Client' : 'Vendor'}_Ledger_${partyName.replace(/\s+/g, '_')}_${from}_to_${to}`;

    const headers = [
      'Date',
      'Transaction Type',
      'Reference / Invoice #',
      'Items Detail',
      'Description / Notes',
      `${tab === 'client' ? 'Billed Amount (+)' : 'Purchased Amount (+)'} (${currency})`,
      `Paid Amount (-) (${currency})`,
      `Running Balance (${currency})`
    ];

    const rows = [];

    // Opening balance row if applicable
    if (from) {
      rows.push([
        fmtD(from),
        'OPENING BALANCE',
        '—',
        '—',
        'Opening Balance Brought Forward',
        '0.00',
        '0.00',
        Number(openingBalance || 0).toFixed(2)
      ]);
    }

    // Ledger transactions
    ledger.forEach(r => {
      rows.push([
        fmtD(r.date),
        (r.type || '').toUpperCase(),
        r.ref || '—',
        formatItems(r.items_detail),
        r.description || '—',
        Number(r.debit || 0).toFixed(2),
        Number(r.credit || 0).toFixed(2),
        Number(r.balance || 0).toFixed(2)
      ]);
    });

    // Summary totals row
    rows.push([
      'TOTALS / SUMMARY',
      'PERIOD SUMMARY',
      '—',
      '—',
      `Net Outstanding: ${Number(netBalance || 0).toFixed(2)} ${currency}`,
      Number(totalBilled || 0).toFixed(2),
      Number(totalPaid || 0).toFixed(2),
      Number(netBalance || 0).toFixed(2)
    ]);

    exportToCSV(filename, headers, rows);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Dynamic Style block for Print view */}
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 8mm 6mm 8mm 6mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            color: #0f172a !important;
            box-sizing: border-box !important;
          }
          #print-area .card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
          #print-area .ledger-summary-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
          #print-area .ledger-summary-grid .card {
            padding: 8px 10px !important;
          }
          #print-area .ledger-summary-grid div {
            font-size: 14px !important;
          }
          #print-area .tbl-wrap {
            overflow: visible !important;
            width: 100% !important;
          }
          #print-area table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            margin: 0 !important;
          }
          #print-area th, #print-area td {
            padding: 6px 4px !important;
            font-size: 10.5px !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            box-sizing: border-box !important;
          }
          #print-area th {
            font-size: 9.5px !important;
            letter-spacing: 0px !important;
          }
          .sidebar, .topbar, .no-print, button, select, input {
            display: none !important;
          }
        }
      `}</style>

      {/* Control / Filter Bar (Hidden when printing) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
          <button style={TAB_STYLE(tab === 'client')} onClick={() => setTab('client')}>👥 Client Ledger</button>
          <button style={TAB_STYLE(tab === 'vendor')} onClick={() => setTab('vendor')}>🏪 Vendor Ledger</button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
            disabled={!selectedId || (ledger.length === 0 && openingBalance === 0)}
            title="Export full ledger statement to CSV / Microsoft Excel"
          >
            📥 Export CSV
          </button>
          <button 
            type="button"
            onClick={handlePrint}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            disabled={!selectedId || (ledger.length === 0 && openingBalance === 0)}
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Ledger Content Wrapper */}
      <div id="print-area">
        {/* Print Header (styled nicely for sharing) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--accent)', paddingBottom: 14, marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', margin: 0 }}>
              {user?.tenant_name || 'Viva Studio'}
            </h1>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 0' }}>Garment Manufacturing Statement</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, textTransform: 'uppercase' }}>
              {tab === 'client' ? 'Client Ledger Statement' : 'Vendor Ledger Statement'}
            </h2>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 0' }}>
              Period: {from ? fmtD(from) : 'Beginning'} to {fmtD(to)}
            </p>
          </div>
        </div>

        {/* ── Single-Line Party Details Row ── */}
        <div className="card" style={{ padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', border: '1px solid var(--border)', background: 'var(--white)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 260 }}>
            <div className="no-print" style={{ minWidth: 180 }}>
              <select 
                value={selectedId} 
                onChange={e => setSelectedId(e.target.value)}
                style={{ width: '100%', padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', outline: 'none', fontSize: 13, fontWeight: 600, background: 'var(--surface)' }}
              >
                <option value="" disabled>Select a {tab}...</option>
                {(tab === 'client' ? parties.clients : parties.vendors).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                {currentParty?.name || 'Select Party'}
              </span>
              <span className={`badge ${tab === 'client' ? 'b-accent' : 'b-cyan'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                {tab === 'client' ? 'Client' : 'Vendor'}
              </span>
              {currentParty?.city && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  📍 {currentParty.city}
                </span>
              )}
              {currentParty?.phone && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  📞 {currentParty.phone}
                </span>
              )}
            </div>
          </div>

          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Period:</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }} />
          </div>
        </div>

        {/* ── Summary Cards Row ── */}
        <div className="ledger-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ padding: '12px 16px', borderLeft: '3.5px solid var(--muted)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              Opening Balance
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{fmt(openingBalance)}</div>
          </div>

          <div className="card" style={{ padding: '12px 16px', borderLeft: '3.5px solid var(--accent)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              {tab === 'client' ? 'Total Invoiced' : 'Total Purchased'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{fmt(totalBilled)}</div>
          </div>

          <div className="card" style={{ padding: '12px 16px', borderLeft: '3.5px solid var(--green)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Paid</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{fmt(totalPaid)}</div>
          </div>

          <div className="card" style={{ padding: '12px 16px', background: 'linear-gradient(135deg, var(--accent-l) 0%, rgba(196,181,253,0.15) 100%)', border: '1.5px solid var(--accent)', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.08)' }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
              {tab === 'client' ? 'Net Outstanding' : 'Net Owed'}
            </div>
            <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--accent)' }}>{fmt(netBalance)}</div>
          </div>
        </div>

        {/* ── Ledger Transactions Table with Item Details ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="spinner">Loading ledger transactions…</div>
          ) : ledger.length === 0 && openingBalance === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>
              No transactions recorded in this period.
            </div>
          ) : (
            <div className="tbl-wrap" style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '1.5px solid var(--border)' }}>
                    <th style={{ width: '11%', padding: '10px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Date</th>
                    <th style={{ width: '9%', padding: '10px 6px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Type</th>
                    <th style={{ width: '13%', padding: '10px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Reference</th>
                    <th style={{ width: '20%', padding: '10px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Items Details</th>
                    <th style={{ width: '17%', padding: '10px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Description / Notes</th>
                    <th style={{ width: '10%', padding: '10px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>
                      {tab === 'client' ? 'Billed (+)' : 'Purchased (+)'}
                    </th>
                    <th style={{ width: '10%', padding: '10px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Paid (-)</th>
                    <th style={{ width: '10%', padding: '10px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening Balance Row */}
                  {from && (
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(243,244,246,0.5)' }}>
                      <td style={{ padding: '8px 8px', fontSize: 12, color: 'var(--muted)' }}>{fmtD(from)}</td>
                      <td style={{ padding: '8px 6px', fontSize: 12 }}>
                        <span className="badge b-yellow" style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 700, padding: '1px 5px' }}>Opening</span>
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: 12, color: 'var(--muted)' }}>—</td>
                      <td style={{ padding: '8px 8px', fontSize: 12, color: 'var(--muted)' }}>—</td>
                      <td style={{ padding: '8px 8px', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                        Opening Balance Brought Forward
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right', color: 'var(--muted)' }}>—</td>
                      <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right', color: 'var(--muted)' }}>—</td>
                      <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                        {fmt(openingBalance)}
                      </td>
                    </tr>
                  )}

                  {/* Ledger Transactions */}
                  {ledger.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'rgba(249,250,251,0.6)' : '#fff' }}>
                      <td style={{ padding: '8px 8px', fontSize: 11.5, fontWeight: 500 }}>{fmtD(r.date)}</td>
                      <td style={{ padding: '8px 6px', fontSize: 11 }}>
                        <span className={`badge ${r.type === 'invoice' || r.type === 'bill' ? 'b-accent' : 'b-green'}`} style={{ textTransform: 'capitalize', fontSize: 9.5, fontWeight: 600, padding: '1px 5px' }}>
                          {r.type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>{r.ref || '—'}</td>
                      <td style={{ padding: '8px 8px', fontSize: 11.5, color: 'var(--text)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                        {formatItems(r.items_detail)}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-word' }} title={r.description}>
                        {r.description || '—'}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right', fontWeight: 600, color: r.debit ? 'var(--text)' : 'var(--muted)' }}>
                        {r.debit ? fmt(r.debit) : '—'}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right', fontWeight: 600, color: r.credit ? 'var(--green)' : 'var(--muted)' }}>
                        {r.credit ? fmt(r.credit) : '—'}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                        {fmt(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                    <td colSpan={5} style={{ padding: '10px 8px', fontWeight: 800, fontSize: 12 }}>
                      Summary Totals (Period Net: {fmt(netBalance)})
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--text)', fontSize: 12 }}>
                      {fmt(totalBilled)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--green)', fontSize: 12 }}>
                      {fmt(totalPaid)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900, color: 'var(--accent)', fontSize: 12 }}>
                      {fmt(netBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
