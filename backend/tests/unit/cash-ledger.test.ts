import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Cash Ledger & Financial Math Tests', () => {
  type LedgerEntry = {
    date: string;
    type: string;
    amount: number;
    direction: 'in' | 'out';
    description: string;
  };

  function computeRunningLedger(entries: LedgerEntry[]) {
    // Sort chronologically; inflows before outflows on the same day
    const sorted = [...entries].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da !== db ? da - db : (a.direction === 'in' ? -1 : 1);
    });

    let balance = 0;
    return sorted.map(r => {
      const amt = Number(r.amount || 0);
      balance += r.direction === 'in' ? amt : -amt;
      return { ...r, amount: amt, balance };
    });
  }

  function getFinancialYearStart(date: Date): string {
    const fyYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
    return `${fyYear}-04-01`;
  }

  it('correctly calculates running balance with inflows and outflows', () => {
    const rawEntries: LedgerEntry[] = [
      { date: '2026-05-01', type: 'investment', amount: 50000, direction: 'in', description: 'Capital' },
      { date: '2026-05-02', type: 'purchase',   amount: 20000, direction: 'out', description: 'Fabric purchase' },
      { date: '2026-05-05', type: 'sale',       amount: 15000, direction: 'in', description: 'Client payment' },
      { date: '2026-05-10', type: 'expense',    amount: 5000,  direction: 'out', description: 'Factory rent' },
    ];

    const ledger = computeRunningLedger(rawEntries);

    assert.strictEqual(ledger[0].balance, 50000); // 50,000
    assert.strictEqual(ledger[1].balance, 30000); // 50,000 - 20,000
    assert.strictEqual(ledger[2].balance, 45000); // 30,000 + 15,000
    assert.strictEqual(ledger[3].balance, 40000); // 45,000 - 5,000
  });

  it('sorts inflows before outflows when occurring on the exact same date', () => {
    const rawEntries: LedgerEntry[] = [
      { date: '2026-06-01', type: 'expense', amount: 5000, direction: 'out', description: 'Tea & Snacks' },
      { date: '2026-06-01', type: 'sale',    amount: 8000, direction: 'in',  description: 'Customer payment' },
    ];

    const ledger = computeRunningLedger(rawEntries);

    // The inflow of 8,000 must come first (+8,000), then outflow of 5,000 (balance = 3,000)
    assert.strictEqual(ledger[0].direction, 'in');
    assert.strictEqual(ledger[0].balance, 8000);
    assert.strictEqual(ledger[1].direction, 'out');
    assert.strictEqual(ledger[1].balance, 3000);
  });

  it('calculates Indian fiscal year boundary correctly for any month', () => {
    // In May 2026 (month index 4, >= 3), FY started 2026-04-01
    const mayDate = new Date(2026, 4, 15);
    assert.strictEqual(getFinancialYearStart(mayDate), '2026-04-01');

    // In February 2026 (month index 1, < 3), FY started 2025-04-01 (prev year)
    const febDate = new Date(2026, 1, 15);
    assert.strictEqual(getFinancialYearStart(febDate), '2025-04-01');

    // On April 1st 2026 (month index 3, >= 3), FY starts on 2026-04-01
    const aprDate = new Date(2026, 3, 1);
    assert.strictEqual(getFinancialYearStart(aprDate), '2026-04-01');
  });

  it('normalizes inverted date ranges cleanly', () => {
    const from = '2026-11-15';
    const to   = '2026-04-01';

    const startDate = String(from) <= String(to) ? String(from) : String(to);
    const endDate   = String(from) <= String(to) ? String(to) : String(from);

    assert.strictEqual(startDate, '2026-04-01');
    assert.strictEqual(endDate, '2026-11-15');
  });
});
