import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

export async function getStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      'SELECT * FROM staff WHERE tenant_id=? AND is_active=1 ORDER BY role, name',
      [tenantId]
    );
    res.json(rows);
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function addStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { name, role, phone } = req.body;
  const rate = role === 'cutting_master' ? 5 : 15;
  try {
    const r = await query<any>(
      'INSERT INTO staff (tenant_id,name,role,rate_per_pc,phone) VALUES (?,?,?,?,?)',
      [tenantId, name, role, rate, phone || null]
    );
    res.status(201).json({ id: r.insertId, name, role, rate_per_pc: rate });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function deactivateStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('UPDATE staff SET is_active=0 WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deactivated' });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function getPayrollSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year } = req.query;
  try {
    const rows = await query(
      `SELECT s.id, s.name, s.role, s.rate_per_pc,
         SUM(wl.pieces) AS total_pieces,
         SUM(wl.amount) AS total_due,
         SUM(CASE WHEN wl.is_settled=1 THEN wl.amount ELSE 0 END) AS settled,
         SUM(CASE WHEN wl.is_settled=0 THEN wl.amount ELSE 0 END) AS pending
       FROM staff s
       LEFT JOIN staff_work_logs wl ON wl.staff_id = s.id
         AND wl.tenant_id = ?
         AND MONTH(wl.log_date) = ?
         AND YEAR(wl.log_date)  = ?
       WHERE s.tenant_id = ? AND s.is_active = 1
       GROUP BY s.id`,
      [tenantId, month, year, tenantId]
    );
    res.json(rows);
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function settleStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, month, year } = req.body;
  try {
    await query(
      `UPDATE staff_work_logs SET is_settled=1
       WHERE tenant_id=? AND staff_id=? AND is_settled=0
         AND MONTH(log_date)=? AND YEAR(log_date)=?`,
      [tenantId, staff_id, month, year]
    );
    res.json({ message: 'Settled' });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function getLaborLiability(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query<any[]>(
      `SELECT COALESCE(SUM(amount),0) AS total_liability
       FROM staff_work_logs WHERE tenant_id=? AND is_settled=0`,
      [tenantId]
    );
    res.json({ total_liability: rows[0]?.total_liability || 0 });
  } catch { res.status(500).json({ message: 'Server error' }); }
}
