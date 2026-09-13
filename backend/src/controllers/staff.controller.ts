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
        `SELECT e.*, pb.batch_number 
         FROM staff_work_entries e
         LEFT JOIN production_batches pb ON pb.id = e.batch_id
         WHERE e.tenant_id=? AND (e.entry_date=? OR e.completion_date=?) 
         ORDER BY e.work_type, e.category`,
        [tenantId, date, date]
      ).catch(async () => {
        // Fallback if completion_date column doesn't exist yet
        return query<any[]>(
          'SELECT e.*, pb.batch_number FROM staff_work_entries e LEFT JOIN production_batches pb ON pb.id = e.batch_id WHERE e.tenant_id=? AND e.entry_date=? ORDER BY e.work_type, e.category',
          [tenantId, date]
        );
      }),
      query<any[]>(
        `SELECT e.id, e.staff_id, e.batch_id, pb.batch_number, e.entry_date, e.category, e.work_type, e.allocated_pcs, e.completed_pcs,
                (e.allocated_pcs - e.completed_pcs) AS pending_pcs
         FROM staff_work_entries e
         LEFT JOIN production_batches pb ON pb.id = e.batch_id
         WHERE e.tenant_id=? AND e.entry_date < ? AND e.is_settled=0 AND e.allocated_pcs > e.completed_pcs
         ORDER BY e.entry_date ASC`,
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
      const d1 = String(from_date);
      const d2 = String(to_date);
      conditions.push('COALESCE(e.completion_date, e.entry_date) BETWEEN ? AND ?');
      vals.push(d1 <= d2 ? d1 : d2, d1 <= d2 ? d2 : d1);
    } else if (month && year) {
      const cycle = getSalaryCycleDates(Number(month), Number(year));
      conditions.push('COALESCE(e.completion_date, e.entry_date) BETWEEN ? AND ?');
      vals.push(cycle.startDate, cycle.endDate);
    }

    const rows = await query<any[]>(
      `SELECT e.id, e.entry_date, e.completion_date, e.staff_id, s.name AS staff_name, s.role AS staff_role,
              e.batch_id, pb.batch_number,
              e.category, e.size, e.work_type, e.allocated_pcs, e.completed_pcs,
              (e.allocated_pcs - e.completed_pcs) AS remaining_pcs,
              e.is_settled,
              ${earningExpr} AS earned_amount
       FROM staff_work_entries e
       JOIN staff s ON s.id=e.staff_id
       LEFT JOIN production_batches pb ON pb.id = e.batch_id
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
      batch_id: item.batch_id !== undefined ? item.batch_id : req.body.batch_id,
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
      const { staff_id, batch_id, entry_date, completion_date, category, size, work_type, allocated_pcs, completed_pcs } = entry;
      if (!staff_id || !category || !work_type) continue;

      const date      = entry_date || new Date().toISOString().slice(0, 10);
      const compDate  = completion_date || (Number(completed_pcs) > 0 ? date : null);
      const allocated = Number(allocated_pcs) || 0;
      const completed = Number(completed_pcs) || 0;
      const itemSize  = size ? String(size).trim() : null;
      const batchId   = batch_id ? Number(batch_id) : null;

      try {
        const r = await query<any>(
          `INSERT INTO staff_work_entries (tenant_id,staff_id,batch_id,entry_date,completion_date,category,size,work_type,allocated_pcs,completed_pcs)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [tenantId, staff_id, batchId, date, compDate, category, itemSize, work_type, allocated, completed]
        );
        results.push({ id: r.insertId, staff_id, batch_id: batchId, entry_date: date, completion_date: compDate, category, size: itemSize, work_type, allocated_pcs: allocated, completed_pcs: completed });
      } catch {
        // Fallback for missing columns
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
  const { batch_id, entry_date, completion_date, category, size, work_type, allocated_pcs, completed_pcs, is_settled } = req.body;
  try {
    const sets: string[] = [];
    const vals: any[]    = [];
    if (batch_id !== undefined)        { sets.push('batch_id=?');        vals.push(batch_id ? Number(batch_id) : null); }
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
      const fallbackSets = sets.filter(s => !s.includes('completion_date') && !s.includes('size') && !s.includes('batch_id'));
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
    const d1 = String(from_date);
    const d2 = String(to_date);
    startDate = d1 <= d2 ? d1 : d2;
    endDate = d1 <= d2 ? d2 : d1;
  } else {
    const cycle = getSalaryCycleDates(Number(month || (new Date().getMonth() + 1)), Number(year || new Date().getFullYear()));
    startDate = cycle.startDate;
    endDate = cycle.endDate;
  }

  try {
    const rows = await query<any[]>(
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

    // Fetch advances in this salary cycle
    let advanceRows: any[] = [];
    try {
      advanceRows = await query<any[]>(
        `SELECT staff_id,
           COALESCE(SUM(amount), 0)                                            AS total_advances,
           COALESCE(SUM(CASE WHEN is_deducted=1 THEN amount ELSE 0 END), 0)    AS advance_deducted,
           COALESCE(SUM(CASE WHEN is_deducted=0 THEN amount ELSE 0 END), 0)    AS advance_pending
         FROM staff_advances
         WHERE tenant_id=? AND advance_date BETWEEN ? AND ?
         GROUP BY staff_id`,
        [tenantId, startDate, endDate]
      );
    } catch {
      // If table not created yet, return empty
    }

    const advanceMap = new Map<number, any>();
    advanceRows.forEach(a => advanceMap.set(Number(a.staff_id), a));

    const enriched = rows.map(r => {
      const adv = advanceMap.get(Number(r.id)) || { total_advances: 0, advance_deducted: 0, advance_pending: 0 };
      const pendingGross = Number(r.pending || 0);
      const advPending   = Number(adv.advance_pending || 0);
      const netPayable   = Math.max(0, pendingGross - advPending);

      return {
        ...r,
        total_advances: Number(adv.total_advances || 0),
        advance_deducted: Number(adv.advance_deducted || 0),
        advance_pending: advPending,
        net_payable: netPayable,
      };
    });

    res.json(enriched);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function settleStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, month, year, from_date, to_date } = req.body;

  let startDate: string;
  let endDate: string;

  if (from_date && to_date) {
    const d1 = String(from_date);
    const d2 = String(to_date);
    startDate = d1 <= d2 ? d1 : d2;
    endDate = d1 <= d2 ? d2 : d1;
  } else {
    const cycle = getSalaryCycleDates(Number(month || (new Date().getMonth() + 1)), Number(year || new Date().getFullYear()));
    startDate = cycle.startDate;
    endDate = cycle.endDate;
  }

  try {
    // Settle work entries
    await query(
      `UPDATE staff_work_entries SET is_settled=1
       WHERE tenant_id=? AND staff_id=? AND is_settled=0
         AND COALESCE(completion_date, entry_date) BETWEEN ? AND ?`,
      [tenantId, staff_id, startDate, endDate]
    );

    // Mark advances as deducted in this cycle
    try {
      await query(
        `UPDATE staff_advances SET is_deducted=1, deducted_at=NOW()
         WHERE tenant_id=? AND staff_id=? AND is_deducted=0
           AND advance_date BETWEEN ? AND ?`,
        [tenantId, staff_id, startDate, endDate]
      );
    } catch {}

    // Record settlement
    try {
      const targetDate = from_date ? new Date(String(from_date)) : new Date();
      const targetMonth = Number(month || (targetDate.getMonth() + 1));
      const targetYear  = Number(year || targetDate.getFullYear());
      await query(
        `INSERT INTO payroll_settlements (tenant_id, staff_id, month, year, amount, settled_at)
         VALUES (?, ?, ?, ?, 0, NOW())
         ON DUPLICATE KEY UPDATE settled_at=NOW()`,
        [tenantId, staff_id, targetMonth, targetYear]
      );
    } catch {}

    res.json({ message: 'Settled successfully' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function undoSettleStaff(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, month, year, from_date, to_date } = req.body;

  let startDate: string;
  let endDate: string;

  if (from_date && to_date) {
    const d1 = String(from_date);
    const d2 = String(to_date);
    startDate = d1 <= d2 ? d1 : d2;
    endDate = d1 <= d2 ? d2 : d1;
  } else {
    const cycle = getSalaryCycleDates(Number(month || (new Date().getMonth() + 1)), Number(year || new Date().getFullYear()));
    startDate = cycle.startDate;
    endDate = cycle.endDate;
  }

  try {
    // Revert work entries to unsettled
    await query(
      `UPDATE staff_work_entries SET is_settled=0
       WHERE tenant_id=? AND staff_id=? AND is_settled=1
         AND COALESCE(completion_date, entry_date) BETWEEN ? AND ?`,
      [tenantId, staff_id, startDate, endDate]
    );

    // Revert advances to un-deducted
    try {
      await query(
        `UPDATE staff_advances SET is_deducted=0, deducted_at=NULL
         WHERE tenant_id=? AND staff_id=? AND is_deducted=1
           AND advance_date BETWEEN ? AND ?`,
        [tenantId, staff_id, startDate, endDate]
      );
    } catch {}

    // Remove settlement record if present
    try {
      const targetDate = from_date ? new Date(String(from_date)) : new Date();
      const targetMonth = Number(month || (targetDate.getMonth() + 1));
      const targetYear  = Number(year || targetDate.getFullYear());
      await query(
        `DELETE FROM payroll_settlements WHERE tenant_id=? AND staff_id=? AND month=? AND year=?`,
        [tenantId, staff_id, targetMonth, targetYear]
      );
    } catch {}

    res.json({ message: 'Settlement undone successfully' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// ── Staff Advances (Mid-Month Advances) ──────────────────────────────────────

export async function getStaffAdvances(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, month, year, from_date, to_date } = req.query;

  try {
    let whereClause = 'WHERE a.tenant_id=?';
    const params: any[] = [tenantId];

    if (staff_id) {
      whereClause += ' AND a.staff_id=?';
      params.push(staff_id);
    }

    if (from_date && to_date) {
      const d1 = String(from_date);
      const d2 = String(to_date);
      whereClause += ' AND a.advance_date BETWEEN ? AND ?';
      params.push(d1 <= d2 ? d1 : d2, d1 <= d2 ? d2 : d1);
    } else if (month && year) {
      const cycle = getSalaryCycleDates(Number(month), Number(year));
      whereClause += ' AND a.advance_date BETWEEN ? AND ?';
      params.push(cycle.startDate, cycle.endDate);
    }

    const rows = await query(
      `SELECT a.*, s.name AS staff_name, s.role AS staff_role
       FROM staff_advances a
       JOIN staff s ON s.id = a.staff_id
       ${whereClause}
       ORDER BY a.advance_date DESC, a.id DESC`,
      params
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function addStaffAdvance(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, amount, advance_date, payment_mode, notes } = req.body;

  if (!staff_id || !amount || Number(amount) <= 0) {
    res.status(400).json({ message: 'Staff and valid amount are required' });
    return;
  }

  const advDate = advance_date || new Date().toISOString().slice(0, 10);
  const payMode = payment_mode || 'cash';

  try {
    const result = await query<any>(
      `INSERT INTO staff_advances (tenant_id, staff_id, amount, advance_date, payment_mode, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, staff_id, Number(amount), advDate, payMode, notes || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Advance payment recorded' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateStaffAdvance(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { amount, advance_date, payment_mode, notes } = req.body;

  try {
    const sets: string[] = [];
    const vals: any[] = [];

    if (amount !== undefined)       { sets.push('amount=?');       vals.push(Number(amount)); }
    if (advance_date !== undefined) { sets.push('advance_date=?'); vals.push(advance_date); }
    if (payment_mode !== undefined) { sets.push('payment_mode=?'); vals.push(payment_mode); }
    if (notes !== undefined)        { sets.push('notes=?');        vals.push(notes || null); }

    if (!sets.length) {
      res.status(400).json({ message: 'Nothing to update' });
      return;
    }

    vals.push(id, tenantId);
    await query(`UPDATE staff_advances SET ${sets.join(', ')} WHERE id=? AND tenant_id=?`, vals);
    res.json({ message: 'Advance updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteStaffAdvance(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    await query('DELETE FROM staff_advances WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Advance deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
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

