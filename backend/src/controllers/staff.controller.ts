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
  const { name, role, phone, rate_per_pc, can_stitch } = req.body;
  const rate      = Number(rate_per_pc) || 0;
  const canStitch = role === 'cutting_master' && can_stitch ? 1 : 0;
  try {
    const r = await query<any>(
      'INSERT INTO staff (tenant_id,name,role,rate_per_pc,phone,can_stitch) VALUES (?,?,?,?,?,?)',
      [tenantId, name, role, rate, phone || null, canStitch]
    );
    res.status(201).json({ id: r.insertId, name, role, rate_per_pc: rate, can_stitch: canStitch, phone });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function updateStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { name, role, rate_per_pc, can_stitch, phone } = req.body;
  try {
    const sets: string[] = [];
    const vals: any[]    = [];
    if (name !== undefined)        { sets.push('name=?');        vals.push(name.trim()); }
    if (role !== undefined)        { sets.push('role=?');        vals.push(role); }
    if (rate_per_pc !== undefined) { sets.push('rate_per_pc=?'); vals.push(Number(rate_per_pc) || 0); }
    if (can_stitch !== undefined)  { sets.push('can_stitch=?');  vals.push(can_stitch ? 1 : 0); }
    if (phone !== undefined)       { sets.push('phone=?');       vals.push(phone || null); }
    if (!sets.length) { res.status(400).json({ message: 'Nothing to update' }); return; }
    vals.push(id, tenantId);
    await query(`UPDATE staff SET ${sets.join(',')} WHERE id=? AND tenant_id=?`, vals);
    const updated = await query<any[]>('SELECT * FROM staff WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json(updated[0] || { message: 'Updated' });
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
    // Try querying with completion_date support safely
    const [staff, entries, carryoverList] = await Promise.all([
      query<any[]>(
        'SELECT id, name, role, can_stitch, rate_per_pc, phone FROM staff WHERE tenant_id=? AND is_active=1 ORDER BY role, name',
        [tenantId]
      ),
      query<any[]>(
        `SELECT * FROM staff_work_entries 
         WHERE tenant_id=? AND (entry_date=? OR completion_date=?) 
         ORDER BY work_type, category`,
        [tenantId, date, date]
      ).catch(async () => {
        // Fallback if completion_date column doesn't exist yet
        return query<any[]>(
          'SELECT * FROM staff_work_entries WHERE tenant_id=? AND entry_date=? ORDER BY work_type, category',
          [tenantId, date]
        );
      }),
      query<any[]>(
        `SELECT id, staff_id, entry_date, category, work_type, allocated_pcs, completed_pcs,
                (allocated_pcs - completed_pcs) AS pending_pcs
         FROM staff_work_entries
         WHERE tenant_id=? AND entry_date < ? AND is_settled=0 AND allocated_pcs > completed_pcs
         ORDER BY entry_date ASC`,
        [tenantId, date]
      ),
    ]);

    const byStaff: Record<number, any[]> = {};
    for (const e of entries as any[]) {
      if (!byStaff[e.staff_id]) byStaff[e.staff_id] = [];
      byStaff[e.staff_id].push(e);
    }

    const carryoverMap: Record<number, { total_pcs: number, items: any[] }> = {};
    for (const c of carryoverList as any[]) {
      if (!carryoverMap[c.staff_id]) {
        carryoverMap[c.staff_id] = { total_pcs: 0, items: [] };
      }
      carryoverMap[c.staff_id].total_pcs += Number(c.pending_pcs);
      carryoverMap[c.staff_id].items.push(c);
    }

    res.json((staff as any[]).map(s => ({
      ...s,
      entries: byStaff[s.id] || [],
      carryover_pcs: carryoverMap[s.id]?.total_pcs || 0,
      carryover_items: carryoverMap[s.id]?.items || [],
    })));
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// Helper to calculate 21st of prev month to 20th of current month salary cycle
export function getSalaryCycleDates(month: number, year: number) {
  const m = Number(month);
  const y = Number(year);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-21`;
  const endDate = `${y}-${String(m).padStart(2, '0')}-20`;
  return { startDate, endDate, prevMonth, prevYear, month: m, year: y };
}

export async function getStaffHistory(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, month, year, from_date, to_date } = req.query;
  try {
    const conditions: string[] = ['e.tenant_id=?'];
    const vals: any[] = [tenantId];
    if (staff_id) { conditions.push('e.staff_id=?'); vals.push(staff_id); }

    if (from_date && to_date) {
      conditions.push('COALESCE(e.completion_date, e.entry_date) BETWEEN ? AND ?');
      vals.push(from_date, to_date);
    } else if (month && year) {
      const cycle = getSalaryCycleDates(Number(month), Number(year));
      conditions.push('COALESCE(e.completion_date, e.entry_date) BETWEEN ? AND ?');
      vals.push(cycle.startDate, cycle.endDate);
    }

    const rows = await query<any[]>(
      `SELECT e.id, e.entry_date, e.completion_date, e.staff_id, s.name AS staff_name, s.role AS staff_role,
              e.category, e.size, e.work_type, e.allocated_pcs, e.completed_pcs,
              (e.allocated_pcs - e.completed_pcs) AS remaining_pcs,
              e.is_settled,
              ${earningExpr} AS earned_amount
       FROM staff_work_entries e
       JOIN staff s ON s.id=e.staff_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY COALESCE(e.completion_date, e.entry_date) DESC, e.id DESC`,
      vals
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function upsertWorkEntry(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;

  // Support array of entries, object with items[], or single entry object
  let rawList: any[] = [];
  if (Array.isArray(req.body)) {
    rawList = req.body;
  } else if (Array.isArray(req.body.items) && req.body.items.length > 0) {
    rawList = req.body.items.map((item: any) => ({
      staff_id: item.staff_id || req.body.staff_id,
      entry_date: item.entry_date || req.body.entry_date,
      completion_date: item.completion_date || req.body.completion_date,
      work_type: item.work_type || req.body.work_type,
      category: item.category || req.body.category,
      size: item.size !== undefined ? item.size : req.body.size,
      allocated_pcs: item.allocated_pcs !== undefined ? item.allocated_pcs : req.body.allocated_pcs,
      completed_pcs: item.completed_pcs !== undefined ? item.completed_pcs : req.body.completed_pcs,
    }));
  } else {
    rawList = [req.body];
  }

  if (!rawList.length) {
    res.status(400).json({ message: 'No entries provided' });
    return;
  }

  const results: any[] = [];

  try {
    for (const entry of rawList) {
      const { staff_id, entry_date, completion_date, category, size, work_type, allocated_pcs, completed_pcs } = entry;
      if (!staff_id || !category || !work_type) continue;

      const date      = entry_date || new Date().toISOString().slice(0, 10);
      const compDate  = completion_date || (Number(completed_pcs) > 0 ? date : null);
      const allocated = Number(allocated_pcs) || 0;
      const completed = Number(completed_pcs) || 0;
      const itemSize  = size ? String(size).trim() : null;

      try {
        const r = await query<any>(
          `INSERT INTO staff_work_entries (tenant_id,staff_id,entry_date,completion_date,category,size,work_type,allocated_pcs,completed_pcs)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [tenantId, staff_id, date, compDate, category, itemSize, work_type, allocated, completed]
        );
        results.push({ id: r.insertId, staff_id, entry_date: date, completion_date: compDate, category, size: itemSize, work_type, allocated_pcs: allocated, completed_pcs: completed });
      } catch {
        // Fallback for missing completion_date or size columns
        const r = await query<any>(
          `INSERT INTO staff_work_entries (tenant_id,staff_id,entry_date,category,work_type,allocated_pcs,completed_pcs)
           VALUES (?,?,?,?,?,?,?)`,
          [tenantId, staff_id, date, category, work_type, allocated, completed]
        );
        results.push({ id: r.insertId, staff_id, entry_date: date, category, work_type, allocated_pcs: allocated, completed_pcs: completed });
      }
    }

    if (Array.isArray(req.body) || Array.isArray(req.body?.items)) {
      res.status(201).json(results);
    } else {
      res.status(201).json(results[0] || { message: 'Created' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateWorkEntry(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { entry_date, completion_date, category, size, work_type, allocated_pcs, completed_pcs, is_settled } = req.body;
  try {
    const sets: string[] = [];
    const vals: any[]    = [];
    if (entry_date !== undefined)      { sets.push('entry_date=?');      vals.push(entry_date); }
    if (category !== undefined)        { sets.push('category=?');        vals.push(category); }
    if (size !== undefined)            { sets.push('size=?');            vals.push(size ? String(size).trim() : null); }
    if (work_type !== undefined)       { sets.push('work_type=?');       vals.push(work_type); }
    if (allocated_pcs !== undefined)   { sets.push('allocated_pcs=?');   vals.push(Number(allocated_pcs) || 0); }
    if (completed_pcs !== undefined)   { sets.push('completed_pcs=?');   vals.push(Number(completed_pcs) || 0); }
    if (is_settled !== undefined)      { sets.push('is_settled=?');      vals.push(is_settled ? 1 : 0); }
    
    if (completion_date !== undefined) {
      sets.push('completion_date=?');
      vals.push(completion_date || null);
    } else if (completed_pcs !== undefined && Number(completed_pcs) > 0) {
      sets.push('completion_date=COALESCE(completion_date, entry_date)');
    }

    if (!sets.length) { res.status(400).json({ message: 'Nothing to update' }); return; }
    vals.push(id, tenantId);
    
    try {
      await query(`UPDATE staff_work_entries SET ${sets.join(',')} WHERE id=? AND tenant_id=?`, vals);
    } catch {
      // Filter out columns if missing
      const fallbackSets = sets.filter(s => !s.includes('completion_date') && !s.includes('size'));
      await query(`UPDATE staff_work_entries SET ${fallbackSets.join(',')} WHERE id=? AND tenant_id=?`, vals.filter((_, idx) => idx < fallbackSets.length).concat([id, tenantId]));
    }

    const rows = await query<any[]>('SELECT * FROM staff_work_entries WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json(rows[0] || { message: 'Updated' });
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

// ── Payroll (21st of previous month to 20th of current month salary cycle) ───

export async function getPayrollSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year, from_date, to_date } = req.query;

  let startDate: string;
  let endDate: string;

  if (from_date && to_date) {
    startDate = String(from_date);
    endDate = String(to_date);
  } else {
    const cycle = getSalaryCycleDates(Number(month || (new Date().getMonth() + 1)), Number(year || new Date().getFullYear()));
    startDate = cycle.startDate;
    endDate = cycle.endDate;
  }

  try {
    const rows = await query(
      `SELECT s.id, s.name, s.role, s.can_stitch, s.rate_per_pc, s.phone,
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
         AND e.tenant_id=? 
         AND COALESCE(e.completion_date, e.entry_date) BETWEEN ? AND ?
       WHERE s.tenant_id=? AND s.is_active=1
       GROUP BY s.id ORDER BY s.role, s.name`,
      [tenantId, startDate, endDate, tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function settleStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, month, year, from_date, to_date } = req.body;

  let startDate: string;
  let endDate: string;

  if (from_date && to_date) {
    startDate = String(from_date);
    endDate = String(to_date);
  } else {
    const cycle = getSalaryCycleDates(Number(month || (new Date().getMonth() + 1)), Number(year || new Date().getFullYear()));
    startDate = cycle.startDate;
    endDate = cycle.endDate;
  }

  try {
    await query(
      `UPDATE staff_work_entries SET is_settled=1
       WHERE tenant_id=? AND staff_id=? AND is_settled=0
         AND COALESCE(completion_date, entry_date) BETWEEN ? AND ?`,
      [tenantId, staff_id, startDate, endDate]
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

