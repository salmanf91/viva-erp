import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
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

  const activePartyName = () => {
    const list = tab === 'client' ? parties.clients : parties.vendors;
    return list.find(p => String(p.id) === selectedId)?.name || 'Select Party';
  };

  const handlePrint = () => {
    window.print();
  };

  // Summaries
  const totalBilled = ledger.reduce((s, r) => s + r.debit, 0);
  const totalPaid = ledger.reduce((s, r) => s + r.credit, 0);
  const netBalance = openingBalance + totalBilled - totalPaid;

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Dynamic Style block for Print view */}
      <style>{`
        @media print {
          /* Hide everything except the print container */
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
            width: 100%;
            padding: 0;
            margin: 0;
            background: #fff !important;
            color: #000 !important;
          }
          /* Hide sidebar/navigation wrapper */
          .sidebar, .topbar, .no-print, button, select, input {
            display: none !important;
          }
        }
      `}</style>

      {/* Control / Filter Bar (Hidden when printing) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
          <button style={TAB_STYLE(tab === 'client')} onClick={() => setTab('client')}>👥 Client Ledger</button>
          <button style={TAB_STYLE(tab === 'vendor')} onClick={() => setTab('vendor')}>🏪 Vendor Ledger</button>
        </div>
        <button 
          onClick={handlePrint}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          disabled={!selectedId || ledger.length === 0}
        >
          🖨️ Print / Save PDF
        </button>
      </div>

      {/* Main Ledger Content Wrapper */}
      <div id="print-area">
        {/* Print Header (styled nicely for sharing) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--accent)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)', margin: 0 }}>Viva Studio</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>Garment Manufacturing Statement</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
              {tab === 'client' ? 'Client Ledger Statement' : 'Vendor Ledger Statement'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
              Period: {from ? fmtD(from) : 'Beginning'} to {fmtD(to)}
            </p>
          </div>
        </div>

        {/* Party Details & Summary Cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
          {/* Party Selection & Details Card */}
          <div className="card" style={{ flex: 1.5, minWidth: 260, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Party details</div>
            
            <div className="no-print" style={{ marginTop: 8, marginBottom: 4 }}>
              <select 
                value={selectedId} 
                onChange={e => setSelectedId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', outline: 'none', fontSize: 14 }}
              >
                <option value="" disabled>Select a {tab}...</option>
                {(tab === 'client' ? parties.clients : parties.vendors).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{activePartyName()}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Type: {tab === 'client' ? 'Client / Customer' : 'Vendor / Supplier'}</div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>From</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>To</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6 }} />
              </div>
            </div>
          </div>

          {/* Dynamic Summary Cards */}
          <div className="card" style={{ flex: 1, minWidth: 150, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '3.5px solid var(--muted)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
              Opening Balance
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{fmt(openingBalance)}</div>
          </div>

          <div className="card" style={{ flex: 1, minWidth: 150, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '3.5px solid var(--accent)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
              {tab === 'client' ? 'Total Invoiced' : 'Total Purchased'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{fmt(totalBilled)}</div>
          </div>

          <div className="card" style={{ flex: 1, minWidth: 150, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '3.5px solid var(--green)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Total Paid</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{fmt(totalPaid)}</div>
          </div>

          <div className="card" style={{ flex: 1.2, minWidth: 160, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(135deg, var(--accent-l) 0%, rgba(196,181,253,0.15) 100%)', border: '1.5px solid var(--accent)', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.08)' }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
              {tab === 'client' ? 'Net Outstanding' : 'Net Owed'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>{fmt(netBalance)}</div>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="spinner">Loading ledger transactions…</div>
          ) : ledger.length === 0 && openingBalance === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>
              No transactions recorded in this period.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1.5px solid var(--border)' }}>
                  <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Date</th>
                  <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Type</th>
                  <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Reference</th>
                  <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Description</th>
                  <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>
                    {tab === 'client' ? 'Billed (+)' : 'Purchased (+)'}
                  </th>
                  <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Paid (-)</th>
                  <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                {from && (
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(243,244,246,0.5)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)' }}>{fmtD(from)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      <span className="badge b-yellow" style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Opening</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)' }}>—</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                      Opening Balance Brought Forward
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'right', color: 'var(--muted)' }}>—</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'right', color: 'var(--muted)' }}>—</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                      {fmt(openingBalance)}
                    </td>
                  </tr>
                )}

                {/* Ledger Transactions */}
                {ledger.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'rgba(249,250,251,0.6)' : '#fff' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>{fmtD(r.date)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <span className={`badge ${r.type === 'invoice' || r.type === 'bill' ? 'b-accent' : 'b-green'}`} style={{ textTransform: 'capitalize', fontSize: 11, fontWeight: 600 }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.ref || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>
                      {r.description || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: r.debit ? 'var(--text)' : 'var(--muted)' }}>
                      {r.debit ? fmt(r.debit) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: r.credit ? 'var(--green)' : 'var(--muted)' }}>
                      {r.credit ? fmt(r.credit) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      {fmt(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                  <td colSpan={4} style={{ padding: '12px 16px', fontWeight: 800 }}>
                    Summary Totals (Period Net: {fmt(netBalance)})
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--text)' }}>
                    {fmt(totalBilled)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>
                    {fmt(totalPaid)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--accent)' }}>
                    {fmt(netBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
