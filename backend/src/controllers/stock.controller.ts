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
    // 1. Total raw fabric received per category (canonical purchase_items + direct manual stock_movements)
    const received = await safe(query<any[]>(
      `SELECT 
         category, 
         SUM(quantity) AS qty
       FROM (
         SELECT
           CASE 
             WHEN LOWER(pi.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(pi.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN pi.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN pi.category = '' OR pi.category IS NULL THEN 'Mixed Fabric'
             ELSE TRIM(pi.category)
           END AS category,
           pi.quantity
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         WHERE (p.tenant_id = ? OR p.tenant_id IS NULL)
         UNION ALL
         SELECT 
           CASE 
             WHEN LOWER(sm.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(sm.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN sm.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN sm.category = '' OR sm.category IS NULL THEN 'Mixed Fabric'
             ELSE TRIM(sm.category)
           END AS category, 
           sm.quantity
         FROM stock_movements sm
         WHERE (sm.tenant_id = ? OR sm.tenant_id IS NULL) AND sm.type='in' AND (sm.reference IS NULL OR sm.reference NOT LIKE 'PUR-%')
       ) t
       GROUP BY category`,
      [tenantId, tenantId]
    ));

    // 2. Fabric in active production (tracked from active stock_movements allocations + active production_batches)
    let allocated: any[] = [];
    try {
      allocated = await query<any[]>(
        `SELECT 
           category,
           SUM(qty) AS qty
         FROM (
           SELECT 
             CASE 
               WHEN LOWER(sm.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
               WHEN LOWER(sm.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
               WHEN sm.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
               WHEN sm.category = '' OR sm.category IS NULL THEN 'Mixed Fabric'
               ELSE TRIM(sm.category)
             END AS category,
             sm.quantity AS qty
           FROM stock_movements sm
           WHERE (sm.tenant_id = ? OR sm.tenant_id IS NULL) AND sm.type = 'allocated'
           UNION ALL
           SELECT
             CASE 
               WHEN pb.raw_material_name IS NOT NULL AND TRIM(pb.raw_material_name) != '' THEN TRIM(pb.raw_material_name)
               WHEN LOWER(pb.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
               WHEN LOWER(pb.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
               WHEN pb.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
               WHEN pb.category = '' OR pb.category IS NULL THEN 'Mixed Fabric'
               ELSE TRIM(pb.category)
             END AS category,
             COALESCE(NULLIF(pb.raw_quantity_used, 0), pb.quantity, 0) AS qty
           FROM production_batches pb
           WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
             AND (LOWER(COALESCE(pb.status, 'active')) NOT IN ('finished', 'completed', 'delivered'))
             AND NOT EXISTS (
               SELECT 1 FROM stock_movements sm 
               WHERE (sm.tenant_id = pb.tenant_id OR sm.tenant_id IS NULL)
                 AND sm.type = 'allocated'
                 AND (sm.reference = pb.batch_number OR sm.reference LIKE CONCAT(pb.batch_number, '%'))
             )
         ) a
         GROUP BY category`,
        [tenantId, tenantId]
      );
    } catch {
      allocated = await safe(query<any[]>(
        `SELECT 
           category,
           SUM(qty) AS qty
         FROM (
           SELECT 
             CASE 
               WHEN LOWER(sm.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
               WHEN LOWER(sm.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
               WHEN sm.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
               WHEN sm.category = '' OR sm.category IS NULL THEN 'Mixed Fabric'
               ELSE TRIM(sm.category)
             END AS category,
             sm.quantity AS qty
           FROM stock_movements sm
           WHERE (sm.tenant_id = ? OR sm.tenant_id IS NULL) AND sm.type = 'allocated'
           UNION ALL
           SELECT
             CASE 
               WHEN LOWER(pb.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
               WHEN LOWER(pb.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
               WHEN pb.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
               WHEN pb.category = '' OR pb.category IS NULL THEN 'Mixed Fabric'
               ELSE TRIM(pb.category)
             END AS category,
             COALESCE(pb.quantity, 0) AS qty
           FROM production_batches pb
           WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
             AND (LOWER(COALESCE(pb.status, 'active')) NOT IN ('finished', 'completed', 'delivered'))
             AND NOT EXISTS (
               SELECT 1 FROM stock_movements sm 
               WHERE (sm.tenant_id = pb.tenant_id OR sm.tenant_id IS NULL)
                 AND sm.type = 'allocated'
                 AND (sm.reference = pb.batch_number OR sm.reference LIKE CONCAT(pb.batch_number, '%'))
             )
         ) a
         GROUP BY category`,
        [tenantId, tenantId]
      ), []);
    }

    // 3. Finished goods produced per raw material category
    const finished = await safe(query<any[]>(
      `SELECT
         CASE 
           WHEN pb.raw_material_name IS NOT NULL AND TRIM(pb.raw_material_name) != '' THEN TRIM(pb.raw_material_name)
           WHEN LOWER(pb.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
           WHEN LOWER(pb.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
           WHEN pb.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
           WHEN pb.category = '' OR pb.category IS NULL THEN 'Mixed Fabric'
           ELSE TRIM(pb.category)
         END AS category,
         SUM(COALESCE(pb.quantity, 0)) AS qty
       FROM production_batches pb
       WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
         AND (LOWER(COALESCE(pb.status, '')) IN ('finished', 'completed', 'delivered'))
       GROUP BY CASE 
         WHEN pb.raw_material_name IS NOT NULL AND TRIM(pb.raw_material_name) != '' THEN TRIM(pb.raw_material_name)
         WHEN LOWER(pb.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
         WHEN LOWER(pb.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
         WHEN pb.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
         WHEN pb.category = '' OR pb.category IS NULL THEN 'Mixed Fabric'
         ELSE TRIM(pb.category)
       END`,
      [tenantId]
    ));

    // 4. Shawl nighty sub-breakdown: lace vs plain in active production
    const shawlBreakdown = await safe(query<any[]>(
      `SELECT
         COALESCE(NULLIF(pb.category, ''), 'shawl_nighty') AS category,
         SUM(COALESCE(pb.quantity, 0)) AS qty
       FROM production_batches pb
       WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
         AND (LOWER(COALESCE(pb.status, 'active')) NOT IN ('finished', 'completed', 'delivered')) 
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
       WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
         AND (LOWER(COALESCE(pb.status, '')) IN ('finished', 'completed', 'delivered'))
       GROUP BY COALESCE(NULLIF(pbi.category, ''), pb.category), pbi.size`,
      [tenantId]
    ), []);

    // 6. Sold goods mapped to raw material category
    const sold = await safe(query<any[]>(
      `SELECT
         CASE 
           WHEN LOWER(i.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
           WHEN LOWER(i.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
           WHEN i.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
           WHEN i.category = '' OR i.category IS NULL THEN 'Mixed Fabric'
           ELSE TRIM(i.category)
         END AS category,
         SUM(i.quantity) AS qty
       FROM sales_order_items i
       JOIN sales_orders o ON o.id = i.order_id
       WHERE (o.tenant_id = ? OR o.tenant_id IS NULL)
       GROUP BY CASE 
         WHEN LOWER(i.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
         WHEN LOWER(i.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
         WHEN i.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
         WHEN i.category = '' OR i.category IS NULL THEN 'Mixed Fabric'
         ELSE TRIM(i.category)
       END`,
      [tenantId]
    ));

    // 7. Active raw materials master list
    const rawMaterials = await safe(query<any[]>(
      `SELECT id, name, code, uom, default_rate FROM raw_materials WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_active=1 ORDER BY id ASC`,
      [tenantId]
    ), []);

    res.json({ received, allocated, finished, shawlBreakdown, finishedBreakdown, sold, rawMaterials });
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
           CASE 
             WHEN LOWER(pi.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(pi.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN pi.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN pi.category = '' OR pi.category IS NULL THEN 'Mixed Fabric'
             ELSE TRIM(pi.category)
           END AS category,
           COALESCE(v.name, 'Direct Vendor') AS vendor_name,
           pi.quantity
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         LEFT JOIN vendors v ON v.id = p.vendor_id
         WHERE (p.tenant_id = ? OR p.tenant_id IS NULL)
         UNION ALL
         SELECT 
           CASE 
             WHEN LOWER(sm.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(sm.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN sm.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN sm.category = '' OR sm.category IS NULL THEN 'Mixed Fabric'
             ELSE TRIM(sm.category)
           END AS category, 
           COALESCE(v.name, 'Direct Vendor') AS vendor_name,
           sm.quantity
         FROM stock_movements sm
         LEFT JOIN vendors v ON v.id = sm.vendor_id
         WHERE (sm.tenant_id = ? OR sm.tenant_id IS NULL) AND sm.type='in' AND (sm.reference IS NULL OR sm.reference NOT LIKE 'PUR-%')
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
    const [capitalRow, salesRow, purchasesRow, expCompanyRow, expReimbRow, payrollRow, laborRow, advancesRow, stock, batches] = await Promise.all([
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
          COALESCE(SUM(amount), 0) AS total_advances,
          COALESCE(SUM(CASE WHEN is_deducted=0 THEN amount ELSE 0 END), 0) AS pending_advances,
          COALESCE(SUM(CASE WHEN is_deducted=1 THEN amount ELSE 0 END), 0) AS deducted_advances
        FROM staff_advances
        WHERE tenant_id=?`, [tenantId])),
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
    const laborUnsettled  = num(laborRow[0]?.total);
    const pendingAdvances = num(advancesRow[0]?.pending_advances);
    const totalPaidToStaff= payrollSettled + pendingAdvances;
    const laborLiability  = Math.max(0, laborUnsettled - pendingAdvances);

    const cashInHand = totalInvested + salesReceived
                     - totalDrawn - fabricPurchases - otherExpenses
                     - reimbursements - totalPaidToStaff;

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
