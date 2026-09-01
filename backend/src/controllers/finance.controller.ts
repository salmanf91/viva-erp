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

    // Fabric purchases (paid or advance paid)
    const [fabric] = await query<any[]>(
      `SELECT COALESCE(SUM(
        CASE
          WHEN status='paid' THEN (CASE WHEN total > 0 THEN total ELSE advance_paid END)
          ELSE COALESCE(advance_paid, 0)
        END
      ), 0) AS total
       FROM purchases
       WHERE tenant_id=?
         AND MONTH(invoice_date)=? AND YEAR(invoice_date)=?`,
      [tenantId, month, year]
    );

    // Payroll (settled work done in the salary cycle ending 20th of this month)
    const prevM = Number(month) === 1 ? 12 : Number(month) - 1;
    const prevY = Number(month) === 1 ? Number(year) - 1 : Number(year);
    const salaryCycleStart = `${prevY}-${String(prevM).padStart(2, '0')}-21`;
    const salaryCycleEnd   = `${year}-${String(month).padStart(2, '0')}-20`;

    const [payroll] = await query<any[]>(
      `SELECT COALESCE(SUM(${earningExpr}), 0) AS total
       FROM staff_work_entries e
       JOIN staff s ON s.id = e.staff_id
       WHERE e.tenant_id=? AND e.is_settled=1
         AND COALESCE(e.completion_date, e.entry_date) BETWEEN ? AND ?`,
      [tenantId, salaryCycleStart, salaryCycleEnd]
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
  } catch (err: any) {
    console.error('getPnL error:', err);
    res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
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

    // 3. Sales payments received — each payment on its actual payment date
    const clientPayments = await query<any[]>(
      `SELECT sp.payment_date AS date, 'sale' AS type,
              CONCAT('💵 Payment — ', c.name) AS description,
              sp.amount AS amount, 'in' AS direction,
              o.invoice_number AS ref, NULL AS note, c.name AS party
       FROM sales_payments sp
       JOIN sales_orders o ON o.id = sp.order_id
       JOIN clients c ON c.id = o.client_id
       WHERE sp.tenant_id=?
         AND sp.payment_date BETWEEN ? AND ?`,
      [tenantId, from, to]
    );

    // Fallback for any legacy orders with amount_paid but no sales_payments entry
    const legacyPayments = await query<any[]>(
      `SELECT o.order_date AS date, 'sale' AS type,
              CONCAT('💵 Payment — ', c.name) AS description,
              o.amount_paid AS amount, 'in' AS direction,
              o.invoice_number AS ref, NULL AS note, c.name AS party
       FROM sales_orders o
       JOIN clients c ON c.id = o.client_id
       WHERE o.tenant_id=? AND o.amount_paid > 0
         AND NOT EXISTS (SELECT 1 FROM sales_payments sp WHERE sp.order_id = o.id)
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

    // 6. Purchases paid & advance payments
    const purchases = await query<any[]>(
      `SELECT p.invoice_date AS date, 'purchase' AS type,
              CONCAT('📦 Purchase ', CASE WHEN p.status = 'partial' THEN 'Advance ' ELSE '' END, '— ', v.name) AS description,
              CASE
                WHEN p.status = 'paid' THEN (CASE WHEN p.total > 0 THEN p.total ELSE p.advance_paid END)
                ELSE COALESCE(p.advance_paid, 0)
              END AS amount, 'out' AS direction,
              p.id AS ref, p.note, v.name AS party
       FROM purchases p
       JOIN vendors v ON v.id = p.vendor_id
       WHERE p.tenant_id=?
         AND (
           (p.status = 'paid' AND (p.total > 0 OR p.advance_paid > 0))
           OR (COALESCE(p.advance_paid, 0) > 0)
         )
         AND p.invoice_date BETWEEN ? AND ?`,
      [tenantId, from, to]
    );

    // 7. Payroll settled — group by staff+month, date = last day of that month
    const payrollRows = await query<any[]>(
      `SELECT MAX(LAST_DAY(e.entry_date)) AS date, 'payroll' AS type,
              CONCAT('👷 Payroll — ', MAX(s.name)) AS description,
              SUM(${earningExpr}) AS amount, 'out' AS direction,
              CONCAT(MAX(MONTHNAME(e.entry_date)), ' ', MAX(YEAR(e.entry_date))) AS ref,
              NULL AS note, MAX(s.name) AS party
       FROM staff_work_entries e
       JOIN staff s ON s.id = e.staff_id
       WHERE e.tenant_id=? AND e.is_settled=1
         AND e.entry_date BETWEEN ? AND ?
       GROUP BY s.id, YEAR(e.entry_date), MONTH(e.entry_date)`,
      [tenantId, from, to]
    );

    // Merge and sort chronologically
    const all = [
      ...investments, ...drawings, ...clientPayments, ...legacyPayments,
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
  } catch (err: any) {
    console.error('getCashLedger error:', err);
    res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
  }
}

export async function getPartyLedgerParties(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const clients = await query<any[]>('SELECT id, name, phone, city FROM clients WHERE tenant_id=? ORDER BY name ASC', [tenantId]);
    const vendors = await query<any[]>('SELECT id, name, phone FROM vendors WHERE tenant_id=? ORDER BY name ASC', [tenantId]);
    res.json({ clients, vendors });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

export async function getClientLedger(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { from, to } = req.query;

  try {
    let openingBalance = 0;
    
    // Calculate opening balance if 'from' date is provided
    if (from) {
      const [billedRows] = await query<any[]>(
        `SELECT COALESCE(SUM(item_total), 0) AS total_billed FROM (
          SELECT (GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100) AS item_total
          FROM sales_orders o
          LEFT JOIN sales_order_items i ON i.order_id = o.id
          WHERE o.tenant_id = ? AND o.client_id = ? AND o.order_date < ?
          GROUP BY o.id
        ) t`,
        [tenantId, id, from]
      );
      const totalBilled = billedRows?.total_billed || 0;

      const [paidRows] = await query<any[]>(
        `SELECT COALESCE(SUM(p.amount), 0) AS total_paid
         FROM sales_payments p
         JOIN sales_orders o ON o.id = p.order_id
         WHERE p.tenant_id = ? AND o.client_id = ? AND p.payment_date < ?`,
        [tenantId, id, from]
      );
      const totalPaid = paidRows?.total_paid || 0;
      
      openingBalance = Number(totalBilled) - Number(totalPaid);
    }

    let orderCond = 'o.tenant_id = ? AND o.client_id = ?';
    const orderParams: any[] = [tenantId, id];
    if (from) { orderCond += ' AND o.order_date >= ?'; orderParams.push(from); }
    if (to)   { orderCond += ' AND o.order_date <= ?'; orderParams.push(to); }

    const invoices = await query<any[]>(
      `SELECT o.id, o.invoice_number AS ref, o.order_date AS date, 'invoice' AS type, 
              (GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100) AS amount,
              o.notes AS description,
              GROUP_CONCAT(
                CONCAT(
                  i.category, 
                  IF(i.size IS NOT NULL AND i.size != '', CONCAT(' (', i.size, ')'), ''), 
                  ' × ', i.quantity, ' @ ₹', i.rate_per_pc
                ) SEPARATOR ', '
              ) AS items_detail
       FROM sales_orders o
       LEFT JOIN sales_order_items i ON i.order_id = o.id
       WHERE ${orderCond}
       GROUP BY o.id`,
      orderParams
    );

    let payCond = 'p.tenant_id = ? AND o.client_id = ?';
    const payParams: any[] = [tenantId, id];
    if (from) { payCond += ' AND p.payment_date >= ?'; payParams.push(from); }
    if (to)   { payCond += ' AND p.payment_date <= ?'; payParams.push(to); }

    const payments = await query<any[]>(
      `SELECT p.id, o.invoice_number AS ref, p.payment_date AS date, 'payment' AS type, 
              p.amount, 'Payment received' AS description, NULL AS items_detail
       FROM sales_payments p
       JOIN sales_orders o ON o.id = p.order_id
       WHERE ${payCond}`,
      payParams
    );

    const all = [
      ...invoices.map(inv => ({ ...inv, debit: Number(inv.amount), credit: 0 })),
      ...payments.map(p => ({ ...p, debit: 0, credit: Number(p.amount) }))
    ].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      return a.type === 'invoice' ? -1 : 1;
    });

    let balance = openingBalance;
    const ledger = all.map(r => {
      balance += r.debit - r.credit;
      return { ...r, balance };
    });

    res.json({
      openingBalance,
      transactions: ledger
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

export async function getVendorLedger(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { from, to } = req.query;

  try {
    let openingBalance = 0;

    // Calculate opening balance if 'from' date is provided
    if (from) {
      const [billedRows] = await query<any[]>(
        `SELECT COALESCE(SUM(total), 0) AS total_billed
         FROM purchases
         WHERE tenant_id = ? AND vendor_id = ? AND invoice_date < ?`,
        [tenantId, id, from]
      );
      const totalBilled = billedRows?.total_billed || 0;

      const [paidRows] = await query<any[]>(
        `SELECT COALESCE(SUM(
           CASE
             WHEN status = 'paid' THEN (CASE WHEN total > 0 THEN total ELSE advance_paid END)
             ELSE COALESCE(advance_paid, 0)
           END
         ), 0) AS total_paid
         FROM purchases
         WHERE tenant_id = ? AND vendor_id = ? AND invoice_date < ?`,
        [tenantId, id, from]
      );
      const totalPaid = paidRows?.total_paid || 0;

      openingBalance = Number(totalBilled) - Number(totalPaid);
    }

    let pCond = 'p.tenant_id = ? AND p.vendor_id = ?';
    const pParams: any[] = [tenantId, id];
    if (from) { pCond += ' AND p.invoice_date >= ?'; pParams.push(from); }
    if (to)   { pCond += ' AND p.invoice_date <= ?'; pParams.push(to); }

    const purchases = await query<any[]>(
      `SELECT p.id, CONCAT('PUR-', p.id) AS ref, p.invoice_date AS date, 'bill' AS type, 
              p.total AS amount, p.note AS description,
              GROUP_CONCAT(
                CONCAT(pi.category, ' × ', pi.quantity, ' @ ₹', pi.rate_per_pc)
                SEPARATOR ', '
              ) AS items_detail
       FROM purchases p
       LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
       WHERE ${pCond}
       GROUP BY p.id`,
      pParams
    );

    let payCond = 'p.tenant_id = ? AND p.vendor_id = ? AND ((p.status = "paid" AND (p.total > 0 OR p.advance_paid > 0)) OR (COALESCE(p.advance_paid, 0) > 0))';
    const payParams: any[] = [tenantId, id];
    if (from) { payCond += ' AND p.invoice_date >= ?'; payParams.push(from); }
    if (to)   { payCond += ' AND p.invoice_date <= ?'; payParams.push(to); }

    const payments = await query<any[]>(
      `SELECT p.id, CONCAT('PUR-', p.id) AS ref, p.invoice_date AS date, 'payment' AS type, 
              CASE
                WHEN p.status = 'paid' THEN (CASE WHEN p.total > 0 THEN p.total ELSE p.advance_paid END)
                ELSE COALESCE(p.advance_paid, 0)
              END AS amount,
              CASE
                WHEN p.status = 'partial' THEN 'Advance payment'
                ELSE 'Bill payment'
              END AS description,
              NULL AS items_detail
       FROM purchases p
       WHERE ${payCond}`,
      payParams
    );

    const all = [
      ...purchases.map(b => ({ ...b, debit: Number(b.amount), credit: 0 })),
      ...payments.map(p => ({ ...p, debit: 0, credit: Number(p.amount) }))
    ].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      return a.type === 'bill' ? -1 : 1;
    });

    let balance = openingBalance;
    const ledger = all.map(r => {
      balance += r.debit - r.credit;
      return { ...r, balance };
    });

    res.json({
      openingBalance,
      transactions: ledger
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}
