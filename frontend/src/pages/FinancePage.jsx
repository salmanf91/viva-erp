import { useState, useEffect } from 'react';
import api from '../api/client';

const fmt  = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TAB = (active) => ({
  padding: '9px 20px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
  background: 'none', color: active ? 'var(--accent)' : 'var(--muted)',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  marginBottom: -2,
});

const ROW = ({ label, value, sub, color, bold, indent }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: bold ? '8px 0' : '5px 0',
    paddingLeft: indent ? 16 : 0,
    borderTop: bold ? '1px solid var(--border)' : 'none',
  }}>
    <span style={{ fontSize: indent ? 12 : 13, color: indent ? 'var(--muted)' : 'var(--text)', fontWeight: bold ? 800 : 500 }}>
      {label}
      {sub && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{sub}</span>}
    </span>
    <span style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 800 : 600, color: color || 'var(--text)', minWidth: 90, textAlign: 'right' }}>
      {value}
    </span>
  </div>
);

const DIRECTION_COLOR = { in: 'var(--green)', out: 'var(--red)' };
const TYPE_BADGE = {
  investment:    { label: '↑ Investment',    cls: 'b-green'  },
  drawing:       { label: '↓ Drawing',       cls: 'b-red'    },
  sale:          { label: '↑ Sale',          cls: 'b-cyan'   },
  expense:       { label: '↓ Expense',       cls: 'b-yellow' },
  reimbursement: { label: '↓ Reimbursement', cls: 'b-red'    },
  purchase:      { label: '↓ Purchase',      cls: 'b-accent' },
  payroll:       { label: '↓ Payroll',       cls: 'b-accent' },
};

export default function FinancePage() {
  const now   = new Date();
  const [tab, setTab]     = useState('pnl');

  // P&L state
  const [pnlMonth, setPnlMonth] = useState(now.getMonth() + 1);
  const [pnlYear,  setPnlYear]  = useState(now.getFullYear());
  const [pnl,      setPnl]      = useState(null);
  const [pnlLoad,  setPnlLoad]  = useState(false);

  // Cash Ledger state
  const firstDay = `${now.getFullYear()}-04-01`; // business started April
  const today    = now.toISOString().slice(0, 10);
  const [from,      setFrom]      = useState(firstDay);
  const [to,        setTo]        = useState(today);
  const [ledger,    setLedger]    = useState([]);
  const [ledgerLoad,setLedgerLoad]= useState(false);

  const loadPnl = () => {
    setPnlLoad(true);
    api.get(`/finance/pnl?month=${pnlMonth}&year=${pnlYear}`)
      .then(r => setPnl(r.data))
      .finally(() => setPnlLoad(false));
  };

  const loadLedger = () => {
    setLedgerLoad(true);
    api.get(`/finance/cash-ledger?from=${from}&to=${to}`)
      .then(r => setLedger(r.data))
      .finally(() => setLedgerLoad(false));
  };

  useEffect(() => { loadPnl(); },    [pnlMonth, pnlYear]);
  useEffect(() => { loadLedger(); }, [from, to]);

  // ── P&L ─────────────────────────────────────────────────────────────────────
  const PnLTab = () => {
    if (pnlLoad) return <div className="spinner">Loading…</div>;
    if (!pnl)    return null;

    const profitColor = pnl.net_profit >= 0 ? 'var(--green)' : 'var(--red)';
    const grossColor  = pnl.gross_profit >= 0 ? 'var(--green)' : 'var(--red)';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Month picker */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={pnlMonth} onChange={e => setPnlMonth(+e.target.value)}
            style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', outline: 'none' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={pnlYear} onChange={e => setPnlYear(+e.target.value)}
            style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'var(--white)', outline: 'none' }}>
            {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Summary stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Revenue',      value: fmt(pnl.revenue),      color: 'var(--green)',  bg: '#f0fdf4' },
            { label: 'COGS',         value: fmt(pnl.cogs.total),   color: 'var(--red)',    bg: '#fef2f2' },
            { label: 'Gross Profit', value: fmt(pnl.gross_profit), color: grossColor,      bg: '#fafafa' },
            { label: 'Net Profit',   value: fmt(pnl.net_profit),   color: profitColor,     bg: pnl.net_profit >= 0 ? '#f0fdf4' : '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Revenue + COGS */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Revenue</div>
            <ROW label="Sales Received" value={fmt(pnl.revenue)} color="var(--green)" bold />

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '16px 0 10px' }}>Cost of Goods Sold</div>
            <ROW label="Fabric Purchases"   value={fmt(pnl.cogs.fabric)}    indent />
            <ROW label="Payroll (settled)"  value={fmt(pnl.cogs.payroll)}   indent />
            <ROW label="Materials & Accessories" value={fmt(pnl.cogs.materials)} indent />
            <ROW label="Total COGS" value={fmt(pnl.cogs.total)} color="var(--red)" bold />

            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <ROW label="Gross Profit" value={fmt(pnl.gross_profit)} color={grossColor} bold />
          </div>

          {/* OpEx + Net */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Operating Expenses</div>
            <ROW label="Transport & Freight" value={fmt(pnl.opex.transport)}   indent />
            <ROW label="Setup & Shop"        value={fmt(pnl.opex.setup)}        indent />
            <ROW label="Other Expenses"      value={fmt(pnl.opex.other)}        indent />
            <ROW label="Rent"                value={fmt(pnl.opex.rent)}         indent />
            <ROW label="Electricity"         value={fmt(pnl.opex.electricity)}  indent />
            <ROW label="Total OpEx" value={fmt(pnl.opex.total)} color="var(--red)" bold />

            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <ROW
              label="Net Profit"
              sub={pnl.revenue > 0 ? `${Math.round(pnl.net_profit / pnl.revenue * 100)}% margin` : ''}
              value={fmt(pnl.net_profit)}
              color={profitColor}
              bold
            />
          </div>
        </div>
      </div>
    );
  };

  // ── Cash Ledger ──────────────────────────────────────────────────────────────
  const CashLedgerTab = () => {
    if (ledgerLoad) return <div className="spinner">Loading…</div>;

    const totalIn  = ledger.filter(r => r.direction === 'in').reduce((s, r)  => s + r.amount, 0);
    const totalOut = ledger.filter(r => r.direction === 'out').reduce((s, r) => s + r.amount, 0);
    const closing  = ledger.length ? ledger[ledger.length - 1].balance : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Date range */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>From</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 10px', outline: 'none' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>To</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 10px', outline: 'none' }} />
          <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(firstDay); setTo(today); }}>Reset</button>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'Total Cash In',  value: fmt(totalIn),  color: 'var(--green)', bg: '#f0fdf4' },
            { label: 'Total Cash Out', value: fmt(totalOut), color: 'var(--red)',   bg: '#fef2f2' },
            { label: 'Closing Balance',value: fmt(closing),  color: closing >= 0 ? 'var(--green)' : 'var(--red)', bg: closing >= 0 ? '#f0fdf4' : '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Ledger table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {ledger.length === 0
            ? <div className="empty-state" style={{ padding: 32 }}>No transactions in this period.</div>
            : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ minWidth: 680, margin: 0 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Ref / Note</th>
                      <th style={{ textAlign: 'right', color: 'var(--green)' }}>Cash In (+)</th>
                      <th style={{ textAlign: 'right', color: 'var(--red)'   }}>Cash Out (−)</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                <tbody>
                  {ledger.map((r, i) => {
                    const badge = TYPE_BADGE[r.type] || { label: r.type, cls: 'b-gray' };
                    return (
                      <tr key={i} style={{ background: r.direction === 'in' ? '#fafffe' : 'inherit' }}>
                        <td style={{ color: 'var(--muted)', fontSize: 11 }}>{i + 1}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtD(r.date?.slice(0, 10))}</td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{r.description}</td>
                        <td><span className={`badge ${badge.cls}`} style={{ fontSize: 10 }}>{badge.label}</span></td>
                        <td style={{ fontSize: 11, color: 'var(--muted)' }}>{r.ref || ''}{r.note ? ` · ${r.note}` : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>
                          {r.direction === 'in' ? fmt(r.amount) : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>
                          {r.direction === 'out' ? fmt(r.amount) : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13,
                          color: r.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmt(r.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--light)', fontWeight: 800 }}>
                    <td colSpan={5} style={{ fontSize: 13, color: 'var(--muted)' }}>Closing Balance</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)', fontSize: 13 }}>{fmt(totalIn)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)',   fontSize: 13 }}>−{fmt(totalOut)}</td>
                    <td style={{ textAlign: 'right', fontSize: 14,
                      color: closing >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(closing)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button style={TAB(tab === 'pnl')}    onClick={() => setTab('pnl')}>📈 P&amp;L (Testing UI)</button>
        <button style={TAB(tab === 'ledger')} onClick={() => setTab('ledger')}>💵 Cash Ledger</button>
      </div>

      {tab === 'pnl'    && <PnLTab />}
      {tab === 'ledger' && <CashLedgerTab />}
    </>
  );
}
