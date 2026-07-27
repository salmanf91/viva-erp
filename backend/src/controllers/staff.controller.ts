import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

// Rates come from product_config per category; fall back to staff.rate_per_pc / 15 if not configured
const earningExpr = `e.completed_pcs * CASE
  WHEN e.work_type='stitching' THEN COALESCE((SELECT pc.stitch_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), 0)
  ELSE                              COALESCE((SELECT pc.cut_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), s.rate_per_pc, 0)
END`;

// ── Staff CRUD ──────────────────────────────────────────────────────────────

export async function getStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      'SELECT * FROM staff WHERE tenant_id=? ORDER BY is_active DESC, role, name',
      [tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function addStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { name, role, phone, can_stitch } = req.body;
  const rate      = 0; // initial placeholder — admin sets actual rate via Staff page edit
  const canStitch = role === 'cutting_master' && can_stitch ? 1 : 0;
  try {
    const r = await query<any>(
      'INSERT INTO staff (tenant_id,name,role,rate_per_pc,phone,can_stitch) VALUES (?,?,?,?,?,?)',
      [tenantId, name, role, rate, phone || null, canStitch]
    );
    res.status(201).json({ id: r.insertId, name, role, rate_per_pc: rate, can_stitch: canStitch });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function updateStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { can_stitch, phone } = req.body;
  try {
    const sets: string[] = [];
    const vals: any[]    = [];
    if (can_stitch !== undefined) { sets.push('can_stitch=?'); vals.push(can_stitch ? 1 : 0); }
    if (phone      !== undefined) { sets.push('phone=?');      vals.push(phone || null); }
    if (!sets.length) { res.status(400).json({ message: 'Nothing to update' }); return; }
    vals.push(id, tenantId);
    await query(`UPDATE staff SET ${sets.join(',')} WHERE id=? AND tenant_id=?`, vals);
    res.json({ message: 'Updated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function deactivateStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('UPDATE staff SET is_active=0 WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deactivated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function reactivateStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId, role } = req.user!;
  const { id } = req.params;
  if (!['owner', 'manager'].includes(role)) {
    res.status(403).json({ message: 'Only owners/managers can reactivate staff' }); return;
  }
  try {
    await query('UPDATE staff SET is_active=1 WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Reactivated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// ── Staff Admin user management ─────────────────────────────────────────────

export async function getStaffAdmins(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      "SELECT id, name, email, created_at FROM users WHERE tenant_id=? AND role='staff_admin' ORDER BY name",
      [tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function createStaffAdmin(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId, role } = req.user!;
  if (!['owner', 'manager'].includes(role)) {
    res.status(403).json({ message: 'Forbidden' }); return;
  }
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ message: 'name, email and password required' }); return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await query<any>(
      'INSERT INTO users (tenant_id,name,email,password_hash,role) VALUES (?,?,?,?,?)',
      [tenantId, name, email, hash, 'staff_admin']
    );
    res.status(201).json({ id: r.insertId, name, email, role: 'staff_admin' });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') res.status(409).json({ message: 'Email already in use' });
    else res.status(500).json({ message: 'Server error' });
  }
}

export async function removeStaffAdmin(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId, role } = req.user!;
  const { id } = req.params;
  if (!['owner', 'manager'].includes(role)) {
    res.status(403).json({ message: 'Forbidden' }); return;
  }
  try {
    await query("DELETE FROM users WHERE id=? AND tenant_id=? AND role='staff_admin'", [id, tenantId]);
    res.json({ message: 'Removed' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// ── Work Entries ────────────────────────────────────────────────────────────

export async function getWorkEntries(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  try {
    const [staff, entries, carryover] = await Promise.all([
      query<any[]>(
        'SELECT id, name, role, can_stitch, rate_per_pc FROM staff WHERE tenant_id=? AND is_active=1 ORDER BY role, name',
        [tenantId]
      ),
      query<any[]>(
        'SELECT * FROM staff_work_entries WHERE tenant_id=? AND entry_date=? ORDER BY work_type, category',
        [tenantId, date]
      ),
      query<any[]>(
        `SELECT staff_id,
                SUM(allocated_pcs - completed_pcs) AS pending_pcs
         FROM staff_work_entries
         WHERE tenant_id=? AND entry_date < ? AND is_settled=0 AND allocated_pcs > completed_pcs
         GROUP BY staff_id`,
        [tenantId, date]
      ),
    ]);
    const byStaff: Record<number, any[]> = {};
    for (const e of entries as any[]) {
      if (!byStaff[e.staff_id]) byStaff[e.staff_id] = [];
      byStaff[e.staff_id].push(e);
    }
    const carryoverMap: Record<number, number> = {};
    for (const c of carryover as any[]) carryoverMap[c.staff_id] = Number(c.pending_pcs);
    res.json((staff as any[]).map(s => ({ ...s, entries: byStaff[s.id] || [], carryover_pcs: carryoverMap[s.id] || 0 })));
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getStaffHistory(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, month, year } = req.query;
  try {
    const conditions: string[] = ['e.tenant_id=?'];
    const vals: any[] = [tenantId];
    if (staff_id) { conditions.push('e.staff_id=?'); vals.push(staff_id); }
    if (month)    { conditions.push('MONTH(e.entry_date)=?'); vals.push(month); }
    if (year)     { conditions.push('YEAR(e.entry_date)=?'); vals.push(year); }
    const rows = await query<any[]>(
      `SELECT e.id, e.entry_date, e.staff_id, s.name AS staff_name, s.role AS staff_role,
              e.category, e.work_type, e.allocated_pcs, e.completed_pcs,
              (e.allocated_pcs - e.completed_pcs) AS remaining_pcs, e.is_settled
       FROM staff_work_entries e
       JOIN staff s ON s.id = e.staff_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.entry_date DESC, s.name, e.work_type, e.category`,
      vals
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function upsertWorkEntry(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, entry_date, category, work_type, allocated_pcs, completed_pcs } = req.body;
  try {
    await query(
      `INSERT INTO staff_work_entries (tenant_id,staff_id,entry_date,category,work_type,allocated_pcs,completed_pcs)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE allocated_pcs=VALUES(allocated_pcs), completed_pcs=VALUES(completed_pcs)`,
      [tenantId, staff_id, entry_date, category, work_type, allocated_pcs || 0, completed_pcs || 0]
    );
    const rows = await query<any[]>(
      'SELECT * FROM staff_work_entries WHERE tenant_id=? AND staff_id=? AND entry_date=? AND category=? AND work_type=?',
      [tenantId, staff_id, entry_date, category, work_type]
    );
    res.json(rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function deleteWorkEntry(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('DELETE FROM staff_work_entries WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deleted' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// ── Payroll ─────────────────────────────────────────────────────────────────

export async function getPayrollSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year } = req.query;
  try {
    const rows = await query(
      `SELECT s.id, s.name, s.role, s.can_stitch, s.rate_per_pc,
         COALESCE(SUM(e.completed_pcs), 0)                                                                            AS total_pieces,
         COALESCE(SUM(CASE WHEN e.work_type='cutting'   THEN e.completed_pcs ELSE 0 END), 0)                          AS cut_pieces,
         COALESCE(SUM(CASE WHEN e.work_type='stitching' THEN e.completed_pcs ELSE 0 END), 0)                          AS stitch_pieces,
         COALESCE(SUM(CASE WHEN e.work_type='cutting'   THEN e.completed_pcs * COALESCE((SELECT pc.cut_rate    FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), s.rate_per_pc) ELSE 0 END), 0) AS cut_due,
         COALESCE(SUM(CASE WHEN e.work_type='stitching' THEN e.completed_pcs * COALESCE((SELECT pc.stitch_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), 0)             ELSE 0 END), 0) AS stitch_due,
         COALESCE(SUM(${earningExpr}), 0)                                                                             AS total_due,
         COALESCE(SUM(CASE WHEN e.is_settled=1 THEN ${earningExpr} ELSE 0 END), 0)                                    AS settled,
         COALESCE(SUM(CASE WHEN e.is_settled=0 AND e.completed_pcs>0 THEN ${earningExpr} ELSE 0 END),0)               AS pending
       FROM staff s
       LEFT JOIN staff_work_entries e ON e.staff_id=s.id
         AND e.tenant_id=? AND MONTH(e.entry_date)=? AND YEAR(e.entry_date)=?
       WHERE s.tenant_id=? AND s.is_active=1
       GROUP BY s.id ORDER BY s.role, s.name`,
      [tenantId, month, year, tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function settleStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, month, year } = req.body;
  try {
    await query(
      `UPDATE staff_work_entries SET is_settled=1
       WHERE tenant_id=? AND staff_id=? AND is_settled=0
         AND MONTH(entry_date)=? AND YEAR(entry_date)=?`,
      [tenantId, staff_id, month, year]
    );
    res.json({ message: 'Settled' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getLaborLiability(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query<any[]>(
      `SELECT COALESCE(SUM(${earningExpr}), 0) AS total_liability
       FROM staff_work_entries e
       JOIN staff s ON s.id=e.staff_id
       WHERE e.tenant_id=? AND e.is_settled=0 AND e.completed_pcs>0`,
      [tenantId]
    );
    res.json({ total_liability: rows[0]?.total_liability || 0 });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}
