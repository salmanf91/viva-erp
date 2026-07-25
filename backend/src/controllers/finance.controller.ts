import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

const earningExpr = `e.completed_pcs * CASE
  WHEN e.work_type='stitching' THEN COALESCE((SELECT pc.stitch_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), 0)
  ELSE                              COALESCE((SELECT pc.cut_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), s.rate_per_pc, 0)
END`;

// ── P&L for a given month ────────────────────────────────────────────────────
export async function getPnL(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year } = req.query;
  if (!month || !year) { res.status(400).json({ message: 'month and year required' }); return; }

  try {
    // Revenue: actual cash received (amount_paid) on orders in this month
    const [revenue] = await query<any[]>(
      `SELECT COALESCE(SUM(amount_paid), 0) AS total
       FROM sales_orders
       WHERE tenant_id=? AND MONTH(order_date)=? AND YEAR(order_date)=?`,
      [tenantId, month, year]
    );

    // Fabric purchases (paid)
    const [fabric] = await query<any[]>(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM purchases
       WHERE tenant_id=? AND status='paid'
         AND MONTH(invoice_date)=? AND YEAR(invoice_date)=?`,
      [tenantId, month, year]
    );

    // Payroll (settled work done this month)
    const [payroll] = await query<any[]>(
      `SELECT COALESCE(SUM(${earningExpr}), 0) AS total
       FROM staff_work_entries e
       JOIN staff s ON s.id = e.staff_id
       WHERE e.tenant_id=? AND e.is_settled=1
         AND MONTH(e.entry_date)=? AND YEAR(e.entry_date)=?`,
      [tenantId, month, year]
    );

    // Expenses
    const expRows = await query<any[]>(
      `SELECT e.amount, er.category, er.name AS reason_name
       FROM expenses e
       JOIN expense_reasons er ON er.id = e.reason_id
       WHERE e.tenant_id=? AND MONTH(e.expense_date)=? AND YEAR(e.expense_date)=?`,
      [tenantId, month, year]
    );

    let transportExp = 0;
    let setupExp = 0;
    let otherExp = 0;
    let materialsExp = 0;
    let actualRent = 0;
    let actualElectricity = 0;
    let hasActualRent = false;
    let hasActualElectricity = false;

    for (const r of expRows) {
      const amt = Number(r.amount || 0);
      const cat = r.category;
      const name = (r.reason_name || '').toLowerCase();

      if (cat === 'setup') {
        if (name.includes('rent')) {
          actualRent += amt;
          hasActualRent = true;
        } else if (name.includes('electricity') || name.includes('electric bill')) {
          actualElectricity += amt;
          hasActualElectricity = true;
        } else {
          setupExp += amt;
        }
      } else if (cat === 'transport') {
        transportExp += amt;
      } else if (cat === 'materials') {
        materialsExp += amt;
      } else {
        otherExp += amt;
      }
    }

    // Overhead (rent + electricity) fallback if not logged in expenses
    const [overhead] = await query<any[]>(
      `SELECT COALESCE(rent, 0) AS rent, COALESCE(electricity, 0) AS electricity
       FROM monthly_overhead WHERE tenant_id=? AND month=? AND year=?`,
      [tenantId, month, year]
    );
    const rent        = hasActualRent ? actualRent : (overhead ? Number(overhead.rent) : 0);
    const electricity = hasActualElectricity ? actualElectricity : (overhead ? Number(overhead.electricity) : 0);

    const revenueTotal  = Number(revenue.total);
    const fabricTotal   = Number(fabric.total);
    const payrollTotal  = Number(payroll.total);
    const overheadTotal = rent + electricity;

    const cogs        = fabricTotal + payrollTotal + materialsExp;
    const opex        = transportExp + setupExp + otherExp + overheadTotal;
    const grossProfit = revenueTotal - cogs;
    const netProfit   = grossProfit - opex;

    res.json({
      month: Number(month), year: Number(year),
      revenue: revenueTotal,
      cogs: {
        total: cogs,
        fabric:    fabricTotal,
        payroll:   payrollTotal,
        materials: materialsExp,
      },
      opex: {
        total:       opex,
        transport:   transportExp,
        setup:       setupExp,
        other:       otherExp,
        rent,
        electricity,
      },
      gross_profit: grossProfit,
      net_profit:   netProfit,
    });
  } catch (err) {
    console.error('getPnL error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

// ── Cash Ledger ──────────────────────────────────────────────────────────────
export async function getCashLedger(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { from, to } = req.query;
  if (!from || !to) { res.status(400).json({ message: 'from and to dates required' }); return; }

  try {
    // 1. Partner investments
    const investments = await query<any[]>(
      `SELECT cp.payment_date AS date, 'investment' AS type,
              CONCAT('💰 Investment — ', p.name) AS description,
              cp.amount, 'in' AS direction,
              cp.source AS ref, cp.note, p.name AS party
       FROM capital_payments cp
       JOIN partners p ON p.id = cp.partner_id
       WHERE cp.tenant_id=? AND cp.type='investment'
         AND cp.payment_date BETWEEN ? AND ?`,
      [tenantId, from, to]
    );

    // 2. Partner drawings
    const drawings = await query<any[]>(
      `SELECT cp.payment_date AS date, 'drawing' AS type,
              CONCAT('🏧 Drawing — ', p.name) AS description,
              cp.amount, 'out' AS direction,
              cp.source AS ref, cp.note, p.name AS party
       FROM capital_payments cp
       JOIN partners p ON p.id = cp.partner_id
       WHERE cp.tenant_id=? AND cp.type='drawing'
         AND cp.payment_date BETWEEN ? AND ?`,
      [tenantId, from, to]
    );

    // 3. Sales received — use amount_paid (handles partial payments)
    const sales = await query<any[]>(
      `SELECT o.order_date AS date, 'sale' AS type,
              CONCAT('🚚 Sale — ', c.name,
                CASE WHEN o.status='partial' THEN ' (partial)' ELSE '' END) AS description,
              o.amount_paid AS amount, 'in' AS direction,
              o.invoice_number AS ref, NULL AS note, c.name AS party
       FROM sales_orders o
       JOIN clients c ON c.id = o.client_id
       WHERE o.tenant_id=? AND o.amount_paid > 0
         AND o.order_date BETWEEN ? AND ?`,
      [tenantId, from, to]
    );

    // 4. Company-paid expenses (no paid_by = company paid directly)
    const companyExpenses = await query<any[]>(
      `SELECT e.expense_date AS date, 'expense' AS type,
              CONCAT(er.icon, ' ', er.name) AS description,
              e.amount, 'out' AS direction,
              er.category AS ref, e.note, NULL AS party
       FROM expenses e
       JOIN expense_reasons er ON er.id = e.reason_id
       WHERE e.tenant_id=? AND (e.paid_by IS NULL OR e.paid_by='')
         AND e.expense_date BETWEEN ? AND ?`,
      [tenantId, from, to]
    );

    // 5. Expense reimbursements paid out
    const reimbursements = await query<any[]>(
      `SELECT DATE(e.reimbursed_at) AS date, 'reimbursement' AS type,
              CONCAT('💸 Reimbursement — ', e.paid_by) AS description,
              e.amount, 'out' AS direction,
              er.name AS ref, e.note, e.paid_by AS party
       FROM expenses e
       JOIN expense_reasons er ON er.id = e.reason_id
       WHERE e.tenant_id=? AND e.reimbursed_at IS NOT NULL
         AND DATE(e.reimbursed_at) BETWEEN ? AND ?`,
      [tenantId, from, to]
    );

    // 6. Purchases paid
    const purchases = await query<any[]>(
      `SELECT p.invoice_date AS date, 'purchase' AS type,
              CONCAT('📦 Purchase — ', v.name) AS description,
              p.total AS amount, 'out' AS direction,
              p.id AS ref, NULL AS note, v.name AS party
       FROM purchases p
       JOIN vendors v ON v.id = p.vendor_id
       WHERE p.tenant_id=? AND p.status='paid'
         AND p.invoice_date BETWEEN ? AND ?`,
      [tenantId, from, to]
    );

    // 7. Payroll settled — group by staff+month, date = last day of that month
    const payrollRows = await query<any[]>(
      `SELECT LAST_DAY(e.entry_date) AS date, 'payroll' AS type,
              CONCAT('👷 Payroll — ', s.name) AS description,
              SUM(${earningExpr}) AS amount, 'out' AS direction,
              CONCAT(MONTHNAME(e.entry_date), ' ', YEAR(e.entry_date)) AS ref,
              NULL AS note, s.name AS party
       FROM staff_work_entries e
       JOIN staff s ON s.id = e.staff_id
       WHERE e.tenant_id=? AND e.is_settled=1
         AND e.entry_date BETWEEN ? AND ?
       GROUP BY s.id, YEAR(e.entry_date), MONTH(e.entry_date)`,
      [tenantId, from, to]
    );

    // Merge and sort chronologically
    const all = [
      ...investments, ...drawings, ...sales,
      ...companyExpenses, ...reimbursements, ...purchases, ...payrollRows,
    ].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da !== db ? da - db : (a.direction === 'in' ? -1 : 1); // investments before expenses on same day
    });

    // Compute running balance
    let balance = 0;
    const ledger = all.map(r => {
      const amt = Number(r.amount || 0);
      balance += r.direction === 'in' ? amt : -amt;
      return { ...r, amount: amt, balance };
    });

    res.json(ledger);
  } catch (err) {
    console.error('getCashLedger error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}
