import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

export async function getReasons(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      'SELECT * FROM expense_reasons WHERE tenant_id = ? AND is_active = 1 ORDER BY category, name',
      [tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function addReason(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { name, category, icon, accessory_type } = req.body;
  try {
    const r = await query<any>(
      'INSERT INTO expense_reasons (tenant_id,name,category,icon,accessory_type) VALUES (?,?,?,?,?)',
      [tenantId, name, category, icon || '💰', accessory_type || null]
    );
    res.status(201).json({ id: r.insertId, name, category, icon, accessory_type });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// Latest accessory cost-per-nighty derived from actual expenses
export async function reimburseExpense(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { reimbursed_by } = req.body;
  try {
    await query(
      `UPDATE expenses SET reimbursed_at=NOW(), reimbursed_by=? WHERE id=? AND tenant_id=?`,
      [reimbursed_by || null, id, tenantId]
    );
    res.json({ message: 'Reimbursed' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getAccessoryPrices(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query<any[]>(
      `SELECT LOWER(er.accessory_type) AS accessory_type,
              e.amount, e.qty_purchased, e.expense_date,
              ROUND(e.amount / e.qty_purchased, 4) AS cost_per_unit
       FROM expenses e
       JOIN expense_reasons er ON er.id = e.reason_id
       WHERE e.tenant_id = ?
         AND er.accessory_type IS NOT NULL
         AND e.qty_purchased IS NOT NULL
         AND e.qty_purchased > 0
       ORDER BY er.accessory_type, e.expense_date DESC`,
      [tenantId]
    );
    // Return only the latest entry per accessory type
    const latest: Record<string, any> = {};
    for (const row of rows) {
      if (!latest[row.accessory_type]) latest[row.accessory_type] = row;
    }
    res.json(Object.values(latest));
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getExpenses(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year, from, to } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || (month && year && !from && !to ? 1000 : 20);
  const offset = (page - 1) * limit;

  try {
    let sqlCond = 'e.tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (from && to) {
      sqlCond += ' AND e.expense_date BETWEEN ? AND ?';
      params.push(from, to);
    } else if (month && year) {
      sqlCond += ' AND MONTH(e.expense_date) = ? AND YEAR(e.expense_date) = ?';
      params.push(month, year);
    }

    // 1. Count query
    const [countRows] = await query<any[]>(
      `SELECT COUNT(*) AS total 
       FROM expenses e
       JOIN expense_reasons er ON er.id = e.reason_id
       WHERE ${sqlCond}`,
      params
    );
    const total = countRows?.total || 0;

    // 2. Data query
    const expenses = await query<any[]>(
      `SELECT e.*, er.name AS reason_name, er.category, er.icon, er.accessory_type
       FROM expenses e
       JOIN expense_reasons er ON er.id = e.reason_id
       WHERE ${sqlCond}
       ORDER BY e.expense_date DESC, e.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // 3. Stats query
    const statsRows = await query<any[]>(
      `SELECT 
         COALESCE(SUM(e.amount), 0) AS total_spent,
         COALESCE(SUM(CASE WHEN e.paid_by IS NOT NULL AND e.reimbursed_at IS NULL THEN e.amount ELSE 0 END), 0) AS total_pending,
         COALESCE(SUM(CASE WHEN e.paid_by IS NOT NULL AND e.reimbursed_at IS NOT NULL THEN e.amount ELSE 0 END), 0) AS total_repaid
       FROM expenses e
       JOIN expense_reasons er ON er.id = e.reason_id
       WHERE ${sqlCond}`,
      params
    );
    const stats = statsRows[0] || { total_spent: 0, total_pending: 0, total_repaid: 0 };

    // Outstanding by person
    const personRows = await query<any[]>(
      `SELECT e.paid_by, COALESCE(SUM(e.amount), 0) AS amt
       FROM expenses e
       JOIN expense_reasons er ON er.id = e.reason_id
       WHERE ${sqlCond} AND e.paid_by IS NOT NULL AND e.reimbursed_at IS NULL
       GROUP BY e.paid_by`,
      params
    );

    // determine if this month is archived
    let is_archived = false;
    if (month && year && !from && !to) {
      const check = await query<any[]>(
        'SELECT 1 FROM expenses WHERE tenant_id=? AND MONTH(expense_date)=? AND YEAR(expense_date)=? AND is_archived=1 LIMIT 1',
        [tenantId, month, year]
      );
      is_archived = check.length > 0;
    }

    res.json({
      data: expenses,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
      is_archived,
      stats: {
        totalSpent: Number(stats.total_spent),
        totalPending: Number(stats.total_pending),
        totalRepaid: Number(stats.total_repaid),
        outstanding: personRows.map(r => ({ name: r.paid_by, amt: Number(r.amt) }))
      }
    });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function addExpense(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { reason_id, amount, expense_date, note, notes, paid_by, qty_purchased } = req.body;
  try {
    const r = await query<any>(
      'INSERT INTO expenses (tenant_id,reason_id,amount,expense_date,note,paid_by,qty_purchased) VALUES (?,?,?,?,?,?,?)',
      [tenantId, reason_id, amount, expense_date, note || notes || null, paid_by || null, qty_purchased || null]
    );
    res.status(201).json({ id: r.insertId });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function updateExpense(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { amount, note, notes, expense_date, paid_by, qty_purchased } = req.body;
  const paidByVal = paid_by || null;
  // if paid_by is cleared, the expense is now company-paid — void any reimbursement record
  const clearReimburse = !paidByVal;
  try {
    await query(
      `UPDATE expenses
       SET amount=?, note=?, expense_date=?, paid_by=?, qty_purchased=?
         ${clearReimburse ? ', reimbursed_at=NULL, reimbursed_by=NULL' : ''}
       WHERE id=? AND tenant_id=? AND is_archived=0`,
      [amount, note || notes || null, expense_date, paidByVal, qty_purchased || null, id, tenantId]
    );
    res.json({ message: 'Updated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function deleteExpense(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('DELETE FROM expenses WHERE id=? AND tenant_id=? AND is_archived=0', [id, tenantId]);
    res.json({ message: 'Deleted' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function archiveMonth(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year } = req.body;
  try {
    await query(
      'UPDATE expenses SET is_archived=1 WHERE tenant_id=? AND MONTH(expense_date)=? AND YEAR(expense_date)=?',
      [tenantId, month, year]
    );
    res.json({ message: `Archived ${month}/${year}` });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getOverhead(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year } = req.query;
  try {
    const rows = await query<any[]>(
      'SELECT * FROM monthly_overhead WHERE tenant_id=? AND month=? AND year=?',
      [tenantId, month, year]
    );
    res.json(rows[0] || { rent: 0, electricity: 0 });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function upsertOverhead(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year, rent, electricity } = req.body;
  try {
    await query(
      `INSERT INTO monthly_overhead (tenant_id,month,year,rent,electricity)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE rent=VALUES(rent), electricity=VALUES(electricity)`,
      [tenantId, month, year, rent ?? 0, electricity ?? 0]
    );
    res.json({ message: 'Saved' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getExpenseSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { month, year } = req.query;
  try {
    let sql = `SELECT er.category, SUM(e.amount) AS total
               FROM expenses e JOIN expense_reasons er ON er.id = e.reason_id
               WHERE e.tenant_id=?`;
    const params: unknown[] = [tenantId];
    if (month && year) {
      sql += ' AND MONTH(e.expense_date)=? AND YEAR(e.expense_date)=?';
      params.push(month, year);
    }
    sql += ' GROUP BY er.category';
    const rows = await query<any[]>(sql, params);
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}
