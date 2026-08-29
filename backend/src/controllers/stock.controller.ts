import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

export async function getStockSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    // total received per category
    const received = await query<any[]>(
      `SELECT category, SUM(quantity) AS qty
       FROM stock_movements WHERE tenant_id=? AND type='in'
       GROUP BY category`,
      [tenantId]
    );
    // fabric in active production — merge shawl_nighty_lace → shawl_nighty (same raw material)
    const allocated = await query<any[]>(
      `SELECT
         CASE WHEN category = 'shawl_nighty_lace' THEN 'shawl_nighty' ELSE category END AS category,
         SUM(quantity) AS qty
       FROM production_batches
       WHERE tenant_id=? AND status != 'finished'
       GROUP BY CASE WHEN category = 'shawl_nighty_lace' THEN 'shawl_nighty' ELSE category END`,
      [tenantId]
    );
    // finished goods — same merge
    const finished = await query<any[]>(
      `SELECT
         CASE WHEN category = 'shawl_nighty_lace' THEN 'shawl_nighty' ELSE category END AS category,
         SUM(quantity) AS qty
       FROM production_batches
       WHERE tenant_id=? AND status='finished'
       GROUP BY CASE WHEN category = 'shawl_nighty_lace' THEN 'shawl_nighty' ELSE category END`,
      [tenantId]
    );
    // shawl nighty sub-breakdown: how many going to lace vs plain (active batches only)
    const shawlBreakdown = await query<any[]>(
      `SELECT category, SUM(quantity) AS qty
       FROM production_batches
       WHERE tenant_id=? AND status != 'finished' AND category IN ('shawl_nighty','shawl_nighty_lace')
       GROUP BY category`,
      [tenantId]
    );

    // sold goods — merge shawl_nighty_lace → shawl_nighty
    const sold = await query<any[]>(
      `SELECT
         CASE WHEN i.category = 'shawl_nighty_lace' THEN 'shawl_nighty' ELSE i.category END AS category,
         SUM(i.quantity) AS qty
       FROM sales_order_items i
       JOIN sales_orders o ON o.id = i.order_id
       WHERE o.tenant_id=?
       GROUP BY CASE WHEN i.category = 'shawl_nighty_lace' THEN 'shawl_nighty' ELSE i.category END`,
      [tenantId]
    );

    res.json({ received, allocated, finished, shawlBreakdown, sold });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getStockByVendor(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      `SELECT sm.category, v.name AS vendor_name, SUM(sm.quantity) AS received
       FROM stock_movements sm
       LEFT JOIN vendors v ON v.id = sm.vendor_id
       WHERE sm.tenant_id=? AND sm.type='in'
       GROUP BY sm.category, sm.vendor_id`,
      [tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const safe = (p: Promise<any[]>) => p.catch(() => [{}]);
  const num  = (v: any) => Number(v || 0);
  const earningExpr = `e.completed_pcs * CASE
    WHEN e.work_type='stitching' THEN COALESCE((SELECT pc.stitch_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), 0)
    ELSE                              COALESCE((SELECT pc.cut_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), s.rate_per_pc, 0)
  END`;

  try {
    const [capitalRow, salesRow, purchasesRow, expCompanyRow, expReimbRow, payrollRow, laborRow, stock, batches] = await Promise.all([
      safe(query<any[]>(`
        SELECT
          COALESCE(SUM(CASE WHEN type='investment' THEN amount ELSE 0 END),0) AS total_invested,
          COALESCE(SUM(CASE WHEN type='drawing'    THEN amount ELSE 0 END),0) AS total_drawn
        FROM capital_payments WHERE tenant_id=?`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(amount_paid),0) AS total
        FROM sales_orders WHERE tenant_id=?`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(
          CASE
            WHEN status='paid' THEN (CASE WHEN total > 0 THEN total ELSE advance_paid END)
            ELSE COALESCE(advance_paid, 0)
          END
        ), 0) AS total FROM purchases
        WHERE tenant_id=?`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE tenant_id=? AND (paid_by IS NULL OR paid_by='')`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE tenant_id=? AND reimbursed_at IS NOT NULL`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(${earningExpr}),0) AS total
        FROM staff_work_entries e JOIN staff s ON s.id=e.staff_id
        WHERE e.tenant_id=? AND e.is_settled=1`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(${earningExpr}),0) AS total
        FROM staff_work_entries e JOIN staff s ON s.id=e.staff_id
        WHERE e.tenant_id=? AND e.is_settled=0 AND e.completed_pcs>0`, [tenantId])),
      safe(query<any[]>(`
        SELECT
          (SELECT COALESCE(SUM(quantity),0) FROM stock_movements   WHERE tenant_id=? AND type='in') AS total_in,
          (SELECT COALESCE(SUM(quantity),0) FROM production_batches WHERE tenant_id=?)               AS total_allocated,
          (SELECT COALESCE(SUM(quantity),0) FROM production_batches WHERE tenant_id=? AND status='finished') AS total_finished,
          (SELECT COALESCE(SUM(i.quantity),0) FROM sales_order_items i JOIN sales_orders o ON o.id=i.order_id WHERE o.tenant_id=?) AS total_sold`,
        [tenantId, tenantId, tenantId, tenantId])),
      safe(query<any[]>(`
        SELECT COUNT(*) AS active FROM production_batches
        WHERE tenant_id=? AND status != 'finished'`, [tenantId])),
    ]);

    const totalInvested   = num(capitalRow[0]?.total_invested);
    const totalDrawn      = num(capitalRow[0]?.total_drawn);
    const capital         = totalInvested - totalDrawn;
    const salesReceived   = num(salesRow[0]?.total);
    const fabricPurchases = num(purchasesRow[0]?.total);
    const otherExpenses   = num(expCompanyRow[0]?.total);
    const reimbursements  = num(expReimbRow[0]?.total);
    const payrollSettled  = num(payrollRow[0]?.total);
    const laborLiability  = num(laborRow[0]?.total);

    const cashInHand = totalInvested + salesReceived
                     - totalDrawn - fabricPurchases - otherExpenses
                     - reimbursements - payrollSettled;

    res.json({
      capital,
      cash_in_hand:     cashInHand,
      fabric_purchases: fabricPurchases,
      other_expenses:   otherExpenses,
      labor_liability:  laborLiability,
      stock_in:         num(stock[0]?.total_in),
      stock_allocated:  num(stock[0]?.total_allocated),
      stock_available:  num(stock[0]?.total_in) - num(stock[0]?.total_allocated),
      stock_finished:   num(stock[0]?.total_finished),
      stock_sold:       num(stock[0]?.total_sold),
      stock_remaining:  Math.max(0, num(stock[0]?.total_finished) - num(stock[0]?.total_sold)),
      active_batches:   num(batches[0]?.active),
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}
