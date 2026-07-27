import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

// All accessory purchases (full log)
export async function getAccessoryCosts(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query<any[]>(
      `SELECT * FROM accessory_costs WHERE tenant_id=? ORDER BY purchase_date DESC, id DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// Latest price per accessory type (used by cost calculator)
export async function getLatestAccessoryCosts(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query<any[]>(
      `SELECT a.*,
              ROUND(a.total_cost / a.qty_purchased, 4)           AS cost_per_unit,
              ROUND(a.total_cost / a.qty_purchased / a.yield_pcs, 4) AS cost_per_nighty
       FROM accessory_costs a
       INNER JOIN (
         SELECT accessory, MAX(purchase_date) AS latest_date
         FROM accessory_costs
         WHERE tenant_id=?
         GROUP BY accessory
       ) latest ON a.accessory = latest.accessory AND a.purchase_date = latest.latest_date
       WHERE a.tenant_id=?
       ORDER BY a.accessory`,
      [tenantId, tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function addAccessoryCost(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { accessory, qty_purchased, unit, total_cost, yield_pcs, purchase_date, note } = req.body;
  if (!accessory || !qty_purchased || !total_cost || !purchase_date) {
    res.status(400).json({ message: 'accessory, qty_purchased, total_cost and purchase_date required' }); return;
  }
  try {
    const r = await query<any>(
      `INSERT INTO accessory_costs (tenant_id, accessory, qty_purchased, unit, total_cost, yield_pcs, purchase_date, note)
       VALUES (?,?,?,?,?,?,?,?)`,
      [tenantId, accessory, qty_purchased, unit || 'pcs', total_cost, yield_pcs || 1, purchase_date, note || null]
    );
    res.status(201).json({ id: r.insertId });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function deleteAccessoryCost(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('DELETE FROM accessory_costs WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deleted' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}
