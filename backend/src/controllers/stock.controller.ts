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

    res.json({ received, allocated, finished, shawlBreakdown });
  } catch { res.status(500).json({ message: 'Server error' }); }
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
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const [partners, expenses, purchases, labor, stock, batches] = await Promise.all([
      query<any[]>('SELECT SUM(paid_capital) AS total_capital, SUM(committed_capital) AS committed FROM partners WHERE tenant_id=?', [tenantId]),
      query<any[]>('SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE tenant_id=?', [tenantId]),
      query<any[]>('SELECT COALESCE(SUM(total),0) AS total FROM purchases WHERE tenant_id=?', [tenantId]),
      query<any[]>('SELECT COALESCE(SUM(amount),0) AS total FROM staff_work_logs WHERE tenant_id=? AND is_settled=0', [tenantId]),
      query<any[]>(`SELECT
        (SELECT COALESCE(SUM(quantity),0) FROM stock_movements WHERE tenant_id=? AND type='in') AS total_in,
        (SELECT COALESCE(SUM(quantity),0) FROM production_batches WHERE tenant_id=?) AS total_allocated`,
        [tenantId, tenantId]),
      query<any[]>('SELECT COUNT(*) AS active FROM production_batches WHERE tenant_id=? AND status != "finished"', [tenantId]),
    ]);

    const capital        = Number(partners[0]?.total_capital || 0);
    const fabricPurchases= Number(purchases[0]?.total       || 0);
    const otherExpenses  = Number(expenses[0]?.total        || 0);
    const totalExpenses  = fabricPurchases + otherExpenses;
    const cashInHand     = capital - totalExpenses;

    res.json({
      capital,
      cash_in_hand:      cashInHand,
      fabric_purchases:  fabricPurchases,
      other_expenses:    otherExpenses,
      total_expenses:    totalExpenses,
      labor_liability:   Number(labor[0]?.total || 0),
      stock_in: stock[0]?.total_in || 0,
      stock_allocated: stock[0]?.total_allocated || 0,
      stock_available: (stock[0]?.total_in || 0) - (stock[0]?.total_allocated || 0), // allocated merges lace→shawl in batch queries
      active_batches: batches[0]?.active || 0,
    });
  } catch { res.status(500).json({ message: 'Server error' }); }
}
