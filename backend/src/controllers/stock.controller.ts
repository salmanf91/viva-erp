import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

export async function getStockSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const safe = <T>(p: Promise<T>, fallback: any = []): Promise<T> => p.catch((err) => {
    console.warn('getStockSummary subquery error:', err?.message || err);
    return fallback;
  });

  try {
    // 1. Total raw fabric received per category (checks stock_movements + purchase_items fallback)
    const received = await safe(query<any[]>(
      `SELECT 
         category, 
         SUM(quantity) AS qty
       FROM (
         SELECT 
           CASE WHEN category = 'shawl_nighty_lace' THEN 'shawl_nighty' 
                WHEN category = '' OR category IS NULL THEN 'mixed'
                ELSE category END AS category, 
           quantity
         FROM stock_movements WHERE tenant_id=? AND type='in'
         UNION ALL
         SELECT
           CASE WHEN pi.category = 'shawl_nighty_lace' THEN 'shawl_nighty'
                WHEN pi.category = '' OR pi.category IS NULL THEN 'mixed'
                ELSE pi.category END AS category,
           pi.quantity
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         WHERE p.tenant_id = ? AND NOT EXISTS (
           SELECT 1 FROM stock_movements sm WHERE sm.tenant_id = p.tenant_id AND sm.reference = CONCAT('PUR-', p.id)
         )
       ) t
       GROUP BY category`,
      [tenantId, tenantId]
    ));

    // 2. Fabric in active production — query production_batches directly with category normalization
    const allocated = await safe(query<any[]>(
      `SELECT
         CASE WHEN COALESCE(NULLIF(pb.category, ''), 'mixed') = 'shawl_nighty_lace' THEN 'shawl_nighty' 
              ELSE COALESCE(NULLIF(pb.category, ''), 'mixed') END AS category,
         SUM(COALESCE(pb.quantity, 0)) AS qty
       FROM production_batches pb
       WHERE pb.tenant_id=? AND (LOWER(COALESCE(pb.status, 'active')) NOT IN ('finished', 'completed', 'delivered'))
       GROUP BY CASE WHEN COALESCE(NULLIF(pb.category, ''), 'mixed') = 'shawl_nighty_lace' THEN 'shawl_nighty' 
                     ELSE COALESCE(NULLIF(pb.category, ''), 'mixed') END`,
      [tenantId]
    ));

    // 3. Finished goods produced
    const finished = await safe(query<any[]>(
      `SELECT
         CASE WHEN COALESCE(NULLIF(pb.category, ''), 'mixed') = 'shawl_nighty_lace' THEN 'shawl_nighty' 
              ELSE COALESCE(NULLIF(pb.category, ''), 'mixed') END AS category,
         SUM(COALESCE(pb.quantity, 0)) AS qty
       FROM production_batches pb
       WHERE pb.tenant_id=? AND (LOWER(COALESCE(pb.status, '')) IN ('finished', 'completed', 'delivered'))
       GROUP BY CASE WHEN COALESCE(NULLIF(pb.category, ''), 'mixed') = 'shawl_nighty_lace' THEN 'shawl_nighty' 
                     ELSE COALESCE(NULLIF(pb.category, ''), 'mixed') END`,
      [tenantId]
    ));

    // 4. Shawl nighty sub-breakdown: lace vs plain in active production
    const shawlBreakdown = await safe(query<any[]>(
      `SELECT
         COALESCE(NULLIF(pb.category, ''), 'shawl_nighty') AS category,
         SUM(COALESCE(pb.quantity, 0)) AS qty
       FROM production_batches pb
       WHERE pb.tenant_id=? AND (LOWER(COALESCE(pb.status, 'active')) NOT IN ('finished', 'completed', 'delivered')) 
         AND pb.category IN ('shawl_nighty', 'shawl_nighty_lace')
       GROUP BY pb.category`,
      [tenantId]
    ));

    // 5. Finished goods breakdown by product and size
    const finishedBreakdown = await safe(query<any[]>(
      `SELECT
         COALESCE(NULLIF(pbi.category, ''), pb.category) AS category,
         pbi.size,
         SUM(COALESCE(NULLIF(pbi.quantity, 0), pb.quantity, 0)) AS qty
       FROM production_batches pb
       LEFT JOIN production_batch_items pbi ON pbi.batch_id = pb.id
       WHERE pb.tenant_id=? AND (LOWER(COALESCE(pb.status, '')) IN ('finished', 'completed', 'delivered'))
       GROUP BY COALESCE(NULLIF(pbi.category, ''), pb.category), pbi.size`,
      [tenantId]
    ), []);

    // 6. Sold goods
    const sold = await safe(query<any[]>(
      `SELECT
         CASE WHEN i.category = 'shawl_nighty_lace' THEN 'shawl_nighty' ELSE i.category END AS category,
         SUM(i.quantity) AS qty
       FROM sales_order_items i
       JOIN sales_orders o ON o.id = i.order_id
       WHERE o.tenant_id=?
       GROUP BY CASE WHEN i.category = 'shawl_nighty_lace' THEN 'shawl_nighty' ELSE i.category END`,
      [tenantId]
    ));

    res.json({ received, allocated, finished, shawlBreakdown, finishedBreakdown, sold });
  } catch (error) {
    console.error('getStockSummary error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function getStockByVendor(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      `SELECT 
         category,
         vendor_name,
         SUM(quantity) AS received
       FROM (
         SELECT 
           CASE WHEN sm.category = '' OR sm.category IS NULL THEN 'mixed' ELSE sm.category END AS category,
           COALESCE(v.name, 'Direct Vendor') AS vendor_name, 
           sm.quantity
         FROM stock_movements sm
         LEFT JOIN vendors v ON v.id = sm.vendor_id
         WHERE sm.tenant_id=? AND sm.type='in'
         UNION ALL
         SELECT
           CASE WHEN pi.category = '' OR pi.category IS NULL THEN 'mixed' ELSE pi.category END AS category,
           COALESCE(v.name, 'Direct Vendor') AS vendor_name,
           pi.quantity
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         LEFT JOIN vendors v ON v.id = p.vendor_id
         WHERE p.tenant_id = ? AND NOT EXISTS (
           SELECT 1 FROM stock_movements sm WHERE sm.tenant_id = p.tenant_id AND sm.reference = CONCAT('PUR-', p.id)
         )
       ) vt
       GROUP BY category, vendor_name`,
      [tenantId, tenantId]
    ).catch(() => []);
    res.json(rows);
  } catch (error) {
    console.error('getStockByVendor error:', error);
    res.json([]);
  }
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
          (SELECT COALESCE(SUM(quantity),0) FROM (
            SELECT quantity FROM stock_movements WHERE tenant_id=? AND type='in'
            UNION ALL
            SELECT pi.quantity FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id WHERE p.tenant_id=? AND NOT EXISTS (
              SELECT 1 FROM stock_movements sm WHERE sm.tenant_id=p.tenant_id AND sm.reference=CONCAT('PUR-',p.id)
            )
          ) tin) AS total_in,
          (SELECT COALESCE(SUM(COALESCE(pbi.quantity, pb.quantity, 0)),0) FROM production_batches pb LEFT JOIN production_batch_items pbi ON pbi.batch_id=pb.id WHERE pb.tenant_id=? AND (LOWER(COALESCE(pb.status,'active')) NOT IN ('finished','completed'))) AS total_in_production,
          (SELECT COALESCE(SUM(COALESCE(pbi.quantity, pb.quantity, 0)),0) FROM production_batches pb LEFT JOIN production_batch_items pbi ON pbi.batch_id=pb.id WHERE pb.tenant_id=?) AS total_allocated,
          (SELECT COALESCE(SUM(COALESCE(pbi.quantity, pb.quantity, 0)),0) FROM production_batches pb LEFT JOIN production_batch_items pbi ON pbi.batch_id=pb.id WHERE pb.tenant_id=? AND LOWER(COALESCE(pb.status,'')) IN ('finished','completed')) AS total_finished,
          (SELECT COALESCE(SUM(i.quantity),0) FROM sales_order_items i JOIN sales_orders o ON o.id=i.order_id WHERE o.tenant_id=?) AS total_sold`,
        [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId])),
      safe(query<any[]>(`
        SELECT COUNT(*) AS active FROM production_batches
        WHERE tenant_id=? AND (LOWER(COALESCE(status,'active')) NOT IN ('finished','completed'))`, [tenantId])),
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
      stock_allocated:  num(stock[0]?.total_in_production),
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
