import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

const earningExpr = `e.completed_pcs * CASE
  WHEN e.work_type='stitching' THEN COALESCE((SELECT pc.stitch_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), 0)
  ELSE                              COALESCE((SELECT pc.cut_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), s.rate_per_pc, 0)
END`;

const num = (v: any) => Number(v || 0);

// Helper for date filter conditions
function getDateRange(req: AuthRequest) {
  const { from, to, month, year } = req.query as { from?: string; to?: string; month?: string; year?: string };
  const now = new Date();
  
  if (from && to) {
    return { from, to };
  }
  if (month && year) {
    const m = String(month).padStart(2, '0');
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    return {
      from: `${year}-${m}-01`,
      to: `${year}-${m}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (year) {
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    };
  }
  
  // Default: current month
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

// ── 1. OVERVIEW EXECUTIVE REPORT ─────────────────────────────────────────────
export async function getOverviewReport(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { from, to } = getDateRange(req);

  try {
    const [
      salesOrders,
      purchaseSummary,
      expenseSummary,
      payrollRows,
      productionSummary,
      stockSummary,
      allSalesOrders,
      payablesSummary,
    ] = await Promise.all([
      // Sales orders in date range with computed totals
      query<any[]>(
        `SELECT o.id, o.gst_percent, o.amount_paid, o.status,
                COALESCE(SUM(i.quantity * i.rate_per_pc), 0) AS subtotal,
                ((GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100)) AS total
         FROM sales_orders o
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE o.tenant_id=? AND o.order_date BETWEEN ? AND ?
         GROUP BY o.id`,
        [tenantId, from, to]
      ),
      // Purchases in date range
      query<any[]>(
        `SELECT 
           COUNT(*) AS total_purchases,
           COALESCE(SUM(total), 0) AS total_purchased,
           COALESCE(SUM(advance_paid), 0) AS total_advance_paid,
           COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE advance_paid END), 0) AS total_purchase_paid
         FROM purchases
         WHERE tenant_id=? AND invoice_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
      // Expenses in date range
      query<any[]>(
        `SELECT 
           COUNT(*) AS total_expenses_count,
           COALESCE(SUM(amount), 0) AS total_expenses,
           COALESCE(SUM(CASE WHEN paid_by IS NULL OR paid_by='' THEN amount ELSE 0 END), 0) AS company_expenses,
           COALESCE(SUM(CASE WHEN paid_by IS NOT NULL AND paid_by != '' THEN amount ELSE 0 END), 0) AS partner_expenses
         FROM expenses
         WHERE tenant_id=? AND expense_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
      // Payroll / Staff labor in range (safe query)
      query<any[]>(
        `SELECT 
           COALESCE(SUM(e.completed_pcs), 0) AS completed_pieces,
           COALESCE(SUM(${earningExpr}), 0) AS total_labor_cost,
           COALESCE(SUM(CASE WHEN e.is_settled=1 THEN ${earningExpr} ELSE 0 END), 0) AS settled_labor,
           COALESCE(SUM(CASE WHEN e.is_settled=0 THEN ${earningExpr} ELSE 0 END), 0) AS pending_labor
         FROM staff_work_entries e
         JOIN staff s ON s.id = e.staff_id
         WHERE e.tenant_id=? AND e.entry_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
      // Production batches in range
      query<any[]>(
        `SELECT 
           COUNT(*) AS total_batches,
           COALESCE(SUM(quantity), 0) AS total_pieces_planned,
           COALESCE(SUM(CASE WHEN status='finished' THEN quantity ELSE 0 END), 0) AS finished_pieces
         FROM production_batches
         WHERE tenant_id=? AND batch_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
      // Total units sold in range
      query<any[]>(
        `SELECT COALESCE(SUM(i.quantity), 0) AS units_sold
         FROM sales_order_items i
         JOIN sales_orders o ON o.id = i.order_id
         WHERE o.tenant_id=? AND o.order_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
      // All sales orders to compute all-time outstanding receivables
      query<any[]>(
        `SELECT o.id, o.gst_percent, o.amount_paid,
                ((GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100)) AS total
         FROM sales_orders o
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE o.tenant_id=?
         GROUP BY o.id`,
        [tenantId]
      ),
      // All-time unpaid purchases (payables)
      query<any[]>(
        `SELECT COALESCE(SUM(total - advance_paid), 0) AS outstanding_payables
         FROM purchases WHERE tenant_id=? AND status != 'paid'`,
        [tenantId]
      ),
    ]);

    // Aggregate sales
    const totalOrders = salesOrders.length;
    let totalSales = 0;
    let totalCollected = 0;
    let totalSalesBalance = 0;

    for (const o of salesOrders) {
      const tot = num(o.total);
      const paid = num(o.amount_paid);
      totalSales += tot;
      totalCollected += paid;
      totalSalesBalance += Math.max(0, tot - paid);
    }

    // All-time receivables
    let totalReceivables = 0;
    for (const o of allSalesOrders) {
      const tot = num(o.total);
      const paid = num(o.amount_paid);
      if (tot > paid) {
        totalReceivables += (tot - paid);
      }
    }

    const purchases = purchaseSummary[0] || {};
    const expenses = expenseSummary[0] || {};
    const payroll = payrollRows[0] || {};
    const production = productionSummary[0] || {};
    const stock = stockSummary[0] || {};

    const fabricCost = num(purchases.total_purchased);
    const laborCost = num(payroll.total_labor_cost);
    const operatingExpenses = num(expenses.total_expenses);
    
    const grossProfit = totalSales - (fabricCost + laborCost);
    const netProfit = grossProfit - operatingExpenses;
    const netMarginPct = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0';

    res.json({
      date_range: { from, to },
      sales: {
        total_orders: totalOrders,
        total_sales: totalSales,
        total_collected: totalCollected,
        total_balance: totalSalesBalance,
        units_sold: num(stock.units_sold),
      },
      purchases: {
        total_purchases: num(purchases.total_purchases),
        total_purchased: fabricCost,
        total_paid: num(purchases.total_purchase_paid),
        advance_paid: num(purchases.total_advance_paid),
      },
      expenses: {
        total_count: num(expenses.total_expenses_count),
        total_amount: operatingExpenses,
        company_amount: num(expenses.company_expenses),
        partner_amount: num(expenses.partner_expenses),
      },
      labor: {
        completed_pieces: num(payroll.completed_pieces),
        total_labor_cost: laborCost,
        settled_labor: num(payroll.settled_labor),
        pending_labor: num(payroll.pending_labor),
      },
      production: {
        total_batches: num(production.total_batches),
        planned_pieces: num(production.total_pieces_planned),
        finished_pieces: num(production.finished_pieces),
      },
      profitability: {
        gross_profit: grossProfit,
        net_profit: netProfit,
        margin_pct: Number(netMarginPct),
      },
      outstanding: {
        receivables: totalReceivables,
        payables: num(payablesSummary[0]?.outstanding_payables),
      }
    });
  } catch (error) {
    console.error('getOverviewReport Error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── 2. SALES REPORTS ────────────────────────────────────────────────────────
export async function getSalesReport(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { from, to } = getDateRange(req);
  const { client_id, status } = req.query as { client_id?: string; status?: string };

  try {
    const conditions: string[] = ['o.tenant_id=?', 'o.order_date BETWEEN ? AND ?'];
    const vals: any[] = [tenantId, from, to];

    if (client_id) { conditions.push('o.client_id=?'); vals.push(client_id); }
    if (status)    { conditions.push('o.status=?');    vals.push(status); }

    const [ordersRaw, clientSummary, productSummary, dailyTrend] = await Promise.all([
      // 1. Detailed orders list
      query<any[]>(
        `SELECT o.id, o.tenant_id, o.client_id, o.invoice_number, o.order_date, o.status,
                o.include_gst, o.gst_percent, o.discount_percent, o.discount, o.amount_paid, o.created_at,
                c.name AS client_name, c.phone AS client_phone, c.city AS client_city,
                COUNT(i.id) AS item_lines,
                COALESCE(SUM(i.quantity), 0) AS total_pieces,
                COALESCE(SUM(i.quantity * i.rate_per_pc), 0) AS subtotal,
                ((GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100)) AS total
         FROM sales_orders o
         JOIN clients c ON c.id = o.client_id
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE ${conditions.join(' AND ')}
         GROUP BY o.id
         ORDER BY o.order_date DESC, o.id DESC`,
        vals
      ),
      // 2. Client-wise breakdown
      query<any[]>(
        `SELECT c.id AS client_id, c.name AS client_name, c.city AS client_city, c.phone AS client_phone,
                COUNT(DISTINCT o.id) AS order_count,
                COALESCE(SUM(i.quantity), 0) AS total_quantity,
                COALESCE(SUM((GREATEST(0, (SELECT COALESCE(SUM(i2.quantity * i2.rate_per_pc), 0) FROM sales_order_items i2 WHERE i2.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)), 0) AS total_billed,
                COALESCE(SUM(o.amount_paid), 0) AS total_paid
         FROM clients c
         JOIN sales_orders o ON o.client_id = c.id
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE o.tenant_id=? AND o.order_date BETWEEN ? AND ?
         GROUP BY c.id
         ORDER BY total_billed DESC`,
        [tenantId, from, to]
      ),
      // 3. Product / Category breakdown
      query<any[]>(
        `SELECT i.category,
                COALESCE(SUM(i.quantity), 0) AS total_quantity,
                COALESCE(SUM(i.quantity * i.rate_per_pc), 0) AS total_amount,
                COALESCE(AVG(i.rate_per_pc), 0) AS avg_rate
         FROM sales_order_items i
         JOIN sales_orders o ON o.id = i.order_id
         WHERE o.tenant_id=? AND o.order_date BETWEEN ? AND ?
         GROUP BY i.category
         ORDER BY total_amount DESC`,
        [tenantId, from, to]
      ),
      // 4. Daily sales trend
      query<any[]>(
        `SELECT o.order_date,
                COUNT(DISTINCT o.id) AS order_count,
                COALESCE(SUM((GREATEST(0, (SELECT COALESCE(SUM(i2.quantity * i2.rate_per_pc), 0) FROM sales_order_items i2 WHERE i2.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)), 0) AS daily_total,
                COALESCE(SUM(o.amount_paid), 0) AS daily_paid
         FROM sales_orders o
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE o.tenant_id=? AND o.order_date BETWEEN ? AND ?
         GROUP BY o.order_date
         ORDER BY o.order_date ASC`,
        [tenantId, from, to]
      ),
    ]);

    const orders = ordersRaw.map(o => {
      const tot = num(o.total);
      const paid = num(o.amount_paid);
      return {
        ...o,
        total: tot,
        amount_paid: paid,
        balance_due: Math.max(0, tot - paid),
      };
    });

    const clientRows = clientSummary.map(c => {
      const billed = num(c.total_billed);
      const paid = num(c.total_paid);
      return {
        ...c,
        total_billed: billed,
        total_paid: paid,
        total_balance: Math.max(0, billed - paid),
      };
    });

    const totalOrders = orders.length;
    const totalBilled = orders.reduce((s, o) => s + o.total, 0);
    const totalPaid = orders.reduce((s, o) => s + o.amount_paid, 0);
    const totalBalance = orders.reduce((s, o) => s + o.balance_due, 0);
    const totalPieces = orders.reduce((s, o) => s + num(o.total_pieces), 0);

    res.json({
      date_range: { from, to },
      summary: { totalOrders, totalBilled, totalPaid, totalBalance, totalPieces },
      orders,
      client_summary: clientRows,
      product_summary: productSummary,
      daily_trend: dailyTrend,
    });
  } catch (error) {
    console.error('getSalesReport Error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── 3. PURCHASE REPORTS ─────────────────────────────────────────────────────
export async function getPurchaseReport(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { from, to } = getDateRange(req);
  const { vendor_id, status } = req.query as { vendor_id?: string; status?: string };

  try {
    const conditions: string[] = ['p.tenant_id=?', 'p.invoice_date BETWEEN ? AND ?'];
    const vals: any[] = [tenantId, from, to];

    if (vendor_id) { conditions.push('p.vendor_id=?'); vals.push(vendor_id); }
    if (status)    { conditions.push('p.status=?'); vals.push(status); }

    const [purchases, vendorSummary, itemSummary] = await Promise.all([
      // 1. Detailed purchase bills
      query<any[]>(
        `SELECT p.*, v.name AS vendor_name, v.phone AS vendor_phone,
                pt.freight, pt.coolie, pt.total AS transport_total,
                (SELECT COALESCE(SUM(quantity), 0) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS total_quantity
         FROM purchases p
         JOIN vendors v ON v.id = p.vendor_id
         LEFT JOIN purchase_transport pt ON pt.purchase_id = p.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY p.invoice_date DESC, p.id DESC`,
        vals
      ),
      // 2. Vendor-wise summary
      query<any[]>(
        `SELECT v.id AS vendor_id, v.name AS vendor_name, v.phone AS vendor_phone,
                COUNT(p.id) AS bills_count,
                COALESCE(SUM(p.total), 0) AS total_purchased,
                COALESCE(SUM(p.advance_paid), 0) AS total_advance,
                COALESCE(SUM(CASE WHEN p.status='paid' THEN p.total ELSE p.advance_paid END), 0) AS total_paid,
                COALESCE(SUM(CASE WHEN p.status!='paid' THEN (p.total - p.advance_paid) ELSE 0 END), 0) AS balance_payable
         FROM vendors v
         JOIN purchases p ON p.vendor_id = v.id
         WHERE p.tenant_id=? AND p.invoice_date BETWEEN ? AND ?
         GROUP BY v.id
         ORDER BY total_purchased DESC`,
        [tenantId, from, to]
      ),
      // 3. Purchase items by category
      query<any[]>(
        `SELECT pi.category,
                COALESCE(SUM(pi.quantity), 0) AS total_quantity,
                COALESCE(SUM(pi.amount), 0) AS total_amount,
                COALESCE(AVG(pi.rate_per_pc), 0) AS avg_rate
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         WHERE p.tenant_id=? AND p.invoice_date BETWEEN ? AND ?
         GROUP BY pi.category
         ORDER BY total_amount DESC`,
        [tenantId, from, to]
      ),
    ]);

    const totalBills = purchases.length;
    const totalAmount = purchases.reduce((s, p) => s + num(p.total), 0);
    const totalTax = purchases.reduce((s, p) => s + num(p.tax_amount), 0);
    const totalTransport = purchases.reduce((s, p) => s + num(p.transport_total), 0);
    const totalAdvance = purchases.reduce((s, p) => s + num(p.advance_paid), 0);
    const totalQuantity = purchases.reduce((s, p) => s + num(p.total_quantity), 0);

    res.json({
      date_range: { from, to },
      summary: { totalBills, totalAmount, totalTax, totalTransport, totalAdvance, totalQuantity },
      purchases,
      vendor_summary: vendorSummary,
      item_summary: itemSummary,
    });
  } catch (error) {
    console.error('getPurchaseReport Error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── 4. PRODUCTION REPORTS ───────────────────────────────────────────────────
export async function getProductionReport(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { from, to } = getDateRange(req);
  const { category, status } = req.query as { category?: string; status?: string };

  try {
    const conditions: string[] = ['pb.tenant_id=?', 'COALESCE(pb.batch_date, DATE(pb.created_at)) BETWEEN ? AND ?'];
    const vals: any[] = [tenantId, from, to];

    if (category) { conditions.push('pb.category=?'); vals.push(category); }
    if (status)   { conditions.push('pb.status=?');   vals.push(status); }

    const [batches, categorySummary, statusSummary] = await Promise.all([
      // 1. Detailed batch list
      query<any[]>(
        `SELECT pb.*
         FROM production_batches pb
         WHERE ${conditions.join(' AND ')}
         ORDER BY COALESCE(pb.batch_date, pb.created_at) DESC, pb.id DESC`,
        vals
      ),
      // 2. Category totals
      query<any[]>(
        `SELECT category,
                COUNT(*) AS batch_count,
                COALESCE(SUM(quantity), 0) AS total_quantity,
                COALESCE(SUM(CASE WHEN status='finished' THEN quantity ELSE 0 END), 0) AS finished_quantity,
                COALESCE(SUM(CASE WHEN status!='finished' THEN quantity ELSE 0 END), 0) AS in_progress_quantity
         FROM production_batches
         WHERE tenant_id=? AND COALESCE(batch_date, DATE(created_at)) BETWEEN ? AND ?
         GROUP BY category`,
        [tenantId, from, to]
      ),
      // 3. Status breakdown
      query<any[]>(
        `SELECT status,
                COUNT(*) AS count,
                COALESCE(SUM(quantity), 0) AS quantity
         FROM production_batches
         WHERE tenant_id=? AND COALESCE(batch_date, DATE(created_at)) BETWEEN ? AND ?
         GROUP BY status`,
        [tenantId, from, to]
      ),
    ]);

    const totalBatches = batches.length;
    const totalPieces = batches.reduce((s, b) => s + num(b.quantity), 0);
    const finishedPieces = batches.filter(b => b.status === 'finished').reduce((s, b) => s + num(b.quantity), 0);
    const activePieces = totalPieces - finishedPieces;

    res.json({
      date_range: { from, to },
      summary: { totalBatches, totalPieces, finishedPieces, activePieces },
      batches,
      category_summary: categorySummary,
      status_summary: statusSummary,
    });
  } catch (error) {
    console.error('getProductionReport Error:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
  }
}

// ── 5. STAFF & LABOR PAYROLL REPORTS ─────────────────────────────────────────
export async function getStaffReport(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { from, to } = getDateRange(req);
  const { staff_id, role } = req.query as { staff_id?: string; role?: string };

  try {
    const conditions: string[] = ['e.tenant_id=?', 'e.entry_date BETWEEN ? AND ?'];
    const vals: any[] = [tenantId, from, to];

    if (staff_id) { conditions.push('e.staff_id=?'); vals.push(staff_id); }
    if (role)     { conditions.push('s.role=?'); vals.push(role); }

    const [staffSummary, entries] = await Promise.all([
      // 1. Staff summary aggregated
      query<any[]>(
        `SELECT s.id AS staff_id, s.name AS staff_name, s.role AS staff_role, s.phone, s.can_stitch, s.rate_per_pc,
                COALESCE(SUM(e.allocated_pcs), 0) AS total_allocated,
                COALESCE(SUM(e.completed_pcs), 0) AS total_completed,
                COALESCE(SUM(CASE WHEN e.work_type='cutting' THEN e.completed_pcs ELSE 0 END), 0) AS cut_pieces,
                COALESCE(SUM(CASE WHEN e.work_type='stitching' THEN e.completed_pcs ELSE 0 END), 0) AS stitch_pieces,
                COALESCE(SUM(${earningExpr}), 0) AS total_earned,
                COALESCE(SUM(CASE WHEN e.is_settled=1 THEN ${earningExpr} ELSE 0 END), 0) AS settled_amount,
                COALESCE(SUM(CASE WHEN e.is_settled=0 AND e.completed_pcs>0 THEN ${earningExpr} ELSE 0 END), 0) AS pending_amount
         FROM staff s
         LEFT JOIN staff_work_entries e ON e.staff_id = s.id 
           AND e.tenant_id=? 
           AND e.entry_date BETWEEN ? AND ?
         WHERE s.tenant_id=? ${role ? 'AND s.role=?' : ''} ${staff_id ? 'AND s.id=?' : ''}
         GROUP BY s.id
         ORDER BY s.role, s.name`,
        role && staff_id 
          ? [tenantId, from, to, tenantId, role, staff_id] 
          : role 
            ? [tenantId, from, to, tenantId, role] 
            : staff_id 
              ? [tenantId, from, to, tenantId, staff_id] 
              : [tenantId, from, to, tenantId]
      ),
      // 2. Detailed work entries in date range
      query<any[]>(
        `SELECT e.id, e.entry_date, e.staff_id, s.name AS staff_name, s.role AS staff_role,
                e.category, e.work_type, e.allocated_pcs, e.completed_pcs,
                (e.allocated_pcs - e.completed_pcs) AS remaining_pcs, e.is_settled,
                ${earningExpr} AS earned_amount
         FROM staff_work_entries e
         JOIN staff s ON s.id = e.staff_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY e.entry_date DESC, e.id DESC`,
        vals
      ),
    ]);

    const totalPieces = entries.reduce((s, e) => s + num(e.completed_pcs), 0);
    const totalEarned = entries.reduce((s, e) => s + num(e.earned_amount), 0);
    const totalSettled = staffSummary.reduce((s, st) => s + num(st.settled_amount), 0);
    const totalPending = staffSummary.reduce((s, st) => s + num(st.pending_amount), 0);

    res.json({
      date_range: { from, to },
      summary: { totalPieces, totalEarned, totalSettled, totalPending },
      staff_summary: staffSummary,
      entries,
    });
  } catch (error) {
    console.error('getStaffReport Error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── 6. EXPENSE REPORTS ──────────────────────────────────────────────────────
export async function getExpenseReport(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { from, to } = getDateRange(req);
  const { category, paid_by } = req.query as { category?: string; paid_by?: string };

  try {
    const conditions: string[] = ['e.tenant_id=?', 'e.expense_date BETWEEN ? AND ?'];
    const vals: any[] = [tenantId, from, to];

    if (category) { conditions.push('er.category=?'); vals.push(category); }
    if (paid_by === 'company') {
      conditions.push("(e.paid_by IS NULL OR e.paid_by='')");
    } else if (paid_by === 'partner') {
      conditions.push("(e.paid_by IS NOT NULL AND e.paid_by != '')");
    }

    const [expenses, categorySummary, partnerSummary] = await Promise.all([
      // 1. Detailed expense list
      query<any[]>(
        `SELECT e.*, er.name AS reason_name, er.category AS reason_category, er.icon
         FROM expenses e
         JOIN expense_reasons er ON er.id = e.reason_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY e.expense_date DESC, e.id DESC`,
        vals
      ),
      // 2. Category totals
      query<any[]>(
        `SELECT er.category,
                COUNT(e.id) AS count,
                COALESCE(SUM(e.amount), 0) AS total_amount
         FROM expenses e
         JOIN expense_reasons er ON er.id = e.reason_id
         WHERE e.tenant_id=? AND e.expense_date BETWEEN ? AND ?
         GROUP BY er.category
         ORDER BY total_amount DESC`,
        [tenantId, from, to]
      ),
      // 3. Paid by partner breakdown
      query<any[]>(
        `SELECT COALESCE(e.paid_by, 'Company') AS paid_by,
                COUNT(e.id) AS count,
                COALESCE(SUM(e.amount), 0) AS total_amount,
                COALESCE(SUM(CASE WHEN e.reimbursed_at IS NOT NULL THEN e.amount ELSE 0 END), 0) AS reimbursed_amount,
                COALESCE(SUM(CASE WHEN e.reimbursed_at IS NULL AND e.paid_by IS NOT NULL AND e.paid_by != '' THEN e.amount ELSE 0 END), 0) AS pending_reimbursement
         FROM expenses e
         WHERE e.tenant_id=? AND e.expense_date BETWEEN ? AND ?
         GROUP BY e.paid_by`,
        [tenantId, from, to]
      ),
    ]);

    const totalCount = expenses.length;
    const totalAmount = expenses.reduce((s, e) => s + num(e.amount), 0);
    const companyAmount = expenses.filter(e => !e.paid_by).reduce((s, e) => s + num(e.amount), 0);
    const partnerAmount = totalAmount - companyAmount;

    res.json({
      date_range: { from, to },
      summary: { totalCount, totalAmount, companyAmount, partnerAmount },
      expenses,
      category_summary: categorySummary,
      partner_summary: partnerSummary,
    });
  } catch (error) {
    console.error('getExpenseReport Error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── 7. P&L FINANCIAL STATEMENT REPORT ───────────────────────────────────────
export async function getPnLReport(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { from, to } = getDateRange(req);

  try {
    const [salesOrders, fabricRow, laborRow, expenses, accessoryRow] = await Promise.all([
      // Sales orders in date range with computed totals
      query<any[]>(
        `SELECT o.id, o.amount_paid,
                ((GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100)) AS total
         FROM sales_orders o
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE o.tenant_id=? AND o.order_date BETWEEN ? AND ?
         GROUP BY o.id`,
        [tenantId, from, to]
      ),
      // Fabric purchases in range
      query<any[]>(
        `SELECT COALESCE(SUM(total), 0) AS total_fabric
         FROM purchases
         WHERE tenant_id=? AND invoice_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
      // Labor completed in range
      query<any[]>(
        `SELECT 
           COALESCE(SUM(${earningExpr}), 0) AS total_labor,
           COALESCE(SUM(CASE WHEN e.work_type='cutting' THEN ${earningExpr} ELSE 0 END), 0) AS cutting_labor,
           COALESCE(SUM(CASE WHEN e.work_type='stitching' THEN ${earningExpr} ELSE 0 END), 0) AS stitching_labor
         FROM staff_work_entries e
         JOIN staff s ON s.id = e.staff_id
         WHERE e.tenant_id=? AND e.entry_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
      // Operating expenses in range categorized
      query<any[]>(
        `SELECT e.amount, er.category, er.name AS reason_name
         FROM expenses e
         JOIN expense_reasons er ON er.id = e.reason_id
         WHERE e.tenant_id=? AND e.expense_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
      // Accessory costs (materials)
      query<any[]>(
        `SELECT COALESCE(SUM(amount), 0) AS total_accessories
         FROM expenses e
         JOIN expense_reasons er ON er.id = e.reason_id
         WHERE e.tenant_id=? AND er.category='materials' AND e.expense_date BETWEEN ? AND ?`,
        [tenantId, from, to]
      ),
    ]);

    let salesTotal = 0;
    let salesCollected = 0;
    for (const o of salesOrders) {
      salesTotal += num(o.total);
      salesCollected += num(o.amount_paid);
    }

    const fabricCost = num(fabricRow[0]?.total_fabric);
    const laborCost = num(laborRow[0]?.total_labor);
    const cuttingLabor = num(laborRow[0]?.cutting_labor);
    const stitchingLabor = num(laborRow[0]?.stitching_labor);
    const materialAccessories = num(accessoryRow[0]?.total_accessories);

    // Direct COGS
    const cogs = fabricCost + laborCost + materialAccessories;
    const grossProfit = salesTotal - cogs;
    const grossMarginPct = salesTotal > 0 ? ((grossProfit / salesTotal) * 100).toFixed(1) : '0.0';

    // Operating expenses breakdown
    let rent = 0;
    let electricity = 0;
    let transport = 0;
    let setup = 0;
    let other = 0;

    for (const exp of expenses) {
      const amt = num(exp.amount);
      const cat = exp.category;
      const name = (exp.reason_name || '').toLowerCase();

      if (cat === 'setup') {
        if (name.includes('rent')) rent += amt;
        else if (name.includes('electric')) electricity += amt;
        else setup += amt;
      } else if (cat === 'transport') {
        transport += amt;
      } else if (cat === 'materials') {
        // counted in cogs
      } else {
        other += amt;
      }
    }

    const totalOperatingExpenses = rent + electricity + transport + setup + other;
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPct = salesTotal > 0 ? ((netProfit / salesTotal) * 100).toFixed(1) : '0.0';

    res.json({
      date_range: { from, to },
      revenue: {
        total_sales: salesTotal,
        sales_collected: salesCollected,
        uncollected_sales: Math.max(0, salesTotal - salesCollected),
      },
      cogs: {
        fabric: fabricCost,
        labor: {
          total: laborCost,
          cutting: cuttingLabor,
          stitching: stitchingLabor,
        },
        materials_accessories: materialAccessories,
        total_cogs: cogs,
      },
      gross_profit: grossProfit,
      gross_margin_pct: Number(grossMarginPct),
      operating_expenses: {
        rent,
        electricity,
        transport,
        setup,
        other,
        total: totalOperatingExpenses,
      },
      net_profit: netProfit,
      net_margin_pct: Number(netMarginPct),
    });
  } catch (error) {
    console.error('getPnLReport Error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── 8. INVENTORY & STOCK REPORTS ────────────────────────────────────────────
export async function getInventoryReport(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;

  try {
    const [fabricIn, batchesProduced, itemsSold, configs] = await Promise.all([
      // Purchased Fabric stock movements
      query<any[]>(
        `SELECT category, COALESCE(SUM(quantity), 0) AS total_purchased
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         WHERE p.tenant_id=?
         GROUP BY category`,
        [tenantId]
      ),
      // Production finished & active
      query<any[]>(
        `SELECT category,
                COALESCE(SUM(quantity), 0) AS total_allocated,
                COALESCE(SUM(CASE WHEN status='finished' THEN quantity ELSE 0 END), 0) AS total_finished,
                COALESCE(SUM(CASE WHEN status!='finished' THEN quantity ELSE 0 END), 0) AS total_in_progress
         FROM production_batches
         WHERE tenant_id=?
         GROUP BY category`,
        [tenantId]
      ),
      // Sold items
      query<any[]>(
        `SELECT i.category, COALESCE(SUM(i.quantity), 0) AS total_sold
         FROM sales_order_items i
         JOIN sales_orders o ON o.id = i.order_id
         WHERE o.tenant_id=?
         GROUP BY i.category`,
        [tenantId]
      ),
      // Product configs for valuation
      query<any[]>(
        'SELECT * FROM product_config WHERE tenant_id=?',
        [tenantId]
      ),
    ]);

    const configMap: Record<string, any> = {};
    for (const c of configs) configMap[c.category] = c;

    const categories = ['shawl_nighty', 'ordinary_nighty', 'shawl_nighty_lace'];
    const stockReport = categories.map(cat => {
      const purchased = num(fabricIn.find(f => f.category === cat)?.total_purchased);
      const prod = batchesProduced.find(b => b.category === cat) || {};
      const allocated = num(prod.total_allocated);
      const finished = num(prod.total_finished);
      const inProgress = num(prod.total_in_progress);
      const sold = num(itemsSold.find(s => s.category === cat)?.total_sold);
      
      const finishedStockOnHand = Math.max(0, finished - sold);
      const fabricRemaining = Math.max(0, purchased - allocated);
      const cfg = configMap[cat] || {};
      const unitSellingRate = num(cfg.selling_rate);
      const unitCostRate = num(cfg.fabric_cost) + num(cfg.cut_rate) + num(cfg.stitch_rate) + num(cfg.lace_cost) + num(cfg.zip_cost) + num(cfg.thread_cost);

      return {
        category: cat,
        fabric_purchased: purchased,
        fabric_allocated: allocated,
        fabric_remaining: fabricRemaining,
        in_progress_pieces: inProgress,
        finished_pieces: finished,
        sold_pieces: sold,
        stock_on_hand: finishedStockOnHand,
        unit_cost: unitCostRate,
        unit_selling_price: unitSellingRate,
        stock_cost_valuation: finishedStockOnHand * unitCostRate,
        stock_sales_valuation: finishedStockOnHand * unitSellingRate,
      };
    });

    const totalStockOnHand = stockReport.reduce((s, r) => s + r.stock_on_hand, 0);
    const totalCostValuation = stockReport.reduce((s, r) => s + r.stock_cost_valuation, 0);
    const totalSalesValuation = stockReport.reduce((s, r) => s + r.stock_sales_valuation, 0);

    res.json({
      summary: {
        total_stock_on_hand: totalStockOnHand,
        total_cost_valuation: totalCostValuation,
        total_sales_valuation: totalSalesValuation,
      },
      stock_by_category: stockReport,
    });
  } catch (error) {
    console.error('getInventoryReport Error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}
