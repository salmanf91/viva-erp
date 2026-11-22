import { Response } from 'express';
import pool, { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

// ── GET JOB ORDERS & DASHBOARD METRICS ──────────────────────────────────────────
export async function getJobOrders(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  const { branch, status, search, from_date, to_date } = req.query;

  try {
    const conds: string[] = ['o.tenant_id = ?'];
    const params: any[] = [tenantId];

    if (branch && branch !== 'all') {
      conds.push('LOWER(o.branch) = LOWER(?)');
      params.push(String(branch).trim());
    }

    if (status && status !== 'all') {
      conds.push('LOWER(o.status) = LOWER(?)');
      params.push(String(status).trim());
    }

    if (from_date && to_date) {
      conds.push('o.received_date BETWEEN ? AND ?');
      params.push(from_date, to_date);
    }

    if (search && String(search).trim() !== '') {
      const term = `%${String(search).trim()}%`;
      conds.push('(o.order_no LIKE ? OR o.client_name LIKE ? OR o.client_phone LIKE ?)');
      params.push(term, term, term);
    }

    const whereClause = conds.join(' AND ');

    // 1. Count Total Rows
    const [countRow] = await query<any[]>(
      `SELECT COUNT(*) AS total FROM job_work_orders o WHERE ${whereClause}`,
      params
    );
    const total = Number(countRow?.total || 0);

    // 2. Fetch Orders with staff wage and expense aggregations
    const orders = await query<any[]>(
      `SELECT 
         o.*,
         COALESCE(sa.total_staff_wage, 0) AS total_staff_wage,
         COALESCE(sa.total_pcs_assigned, 0) AS total_pcs_assigned,
         COALESCE(sa.total_pcs_completed, 0) AS total_pcs_completed,
         COALESCE(ex.total_expenses, 0) AS total_expenses,
         (o.client_total_amount - COALESCE(sa.total_staff_wage, 0) - COALESCE(ex.total_expenses, 0)) AS net_profit,
         (o.client_total_amount - o.amount_paid) AS balance_due
       FROM job_work_orders o
       LEFT JOIN (
         SELECT 
           order_id,
           SUM(total_wage) AS total_staff_wage,
           SUM(pcs_assigned) AS total_pcs_assigned,
           SUM(pcs_completed) AS total_pcs_completed
         FROM job_work_staff_assignments
         WHERE tenant_id = ?
         GROUP BY order_id
       ) sa ON sa.order_id = o.id
       LEFT JOIN (
         SELECT 
           order_id,
           SUM(amount) AS total_expenses
         FROM job_work_expenses
         WHERE tenant_id = ?
         GROUP BY order_id
       ) ex ON ex.order_id = o.id
       WHERE ${whereClause}
       ORDER BY o.received_date DESC, o.id DESC
       LIMIT ? OFFSET ?`,
      [tenantId, tenantId, ...params, limit, offset]
    );

    // 3. Compute High-Level Metrics for the current tenant
    const [statsRow] = await query<any[]>(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(total_pcs), 0) AS total_pcs_collected,
         COALESCE(SUM(CASE WHEN status IN ('received', 'in_progress') THEN total_pcs ELSE 0 END), 0) AS active_pcs,
         COALESCE(SUM(CASE WHEN status = 'ready' THEN total_pcs ELSE 0 END), 0) AS ready_pcs,
         COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_pcs ELSE 0 END), 0) AS delivered_pcs,
         COALESCE(SUM(CASE WHEN LOWER(branch) = 'bajpe' THEN total_pcs ELSE 0 END), 0) AS bajpe_pcs,
         COALESCE(SUM(CASE WHEN LOWER(branch) = 'kannur' THEN total_pcs ELSE 0 END), 0) AS kannur_pcs,
         COALESCE(SUM(client_total_amount), 0) AS total_revenue,
         COALESCE(SUM(amount_paid), 0) AS total_collected,
         COALESCE(SUM(client_total_amount - amount_paid), 0) AS total_receivable
       FROM job_work_orders
       WHERE tenant_id = ?`,
      [tenantId]
    );

    const [wageRow] = await query<any[]>(
      `SELECT COALESCE(SUM(total_wage), 0) AS total_staff_wages
       FROM job_work_staff_assignments
       WHERE tenant_id = ?`,
      [tenantId]
    );

    const [expenseRow] = await query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses
       FROM job_work_expenses
       WHERE tenant_id = ?`,
      [tenantId]
    );

    const branchBreakdownRows = await query<any[]>(
      `SELECT COALESCE(NULLIF(TRIM(branch), ''), 'Bajpe') AS branch, SUM(total_pcs) AS pcs
       FROM job_work_orders
       WHERE tenant_id = ?
       GROUP BY COALESCE(NULLIF(TRIM(branch), ''), 'Bajpe')
       ORDER BY pcs DESC`,
      [tenantId]
    ).catch(() => []);

    const totalStaffWages = Number(wageRow?.total_staff_wages || 0);
    const totalExpenses = Number(expenseRow?.total_expenses || 0);
    const totalRevenue = Number(statsRow?.total_revenue || 0);
    const netProfit = totalRevenue - totalStaffWages - totalExpenses;

    res.json({
      data: orders,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
      stats: {
        totalOrders: Number(statsRow?.total_orders || 0),
        totalPcsCollected: Number(statsRow?.total_pcs_collected || 0),
        activePcs: Number(statsRow?.active_pcs || 0),
        readyPcs: Number(statsRow?.ready_pcs || 0),
        deliveredPcs: Number(statsRow?.delivered_pcs || 0),
        bajpePcs: Number(statsRow?.bajpe_pcs || 0),
        kannurPcs: Number(statsRow?.kannur_pcs || 0),
        branchBreakdown: branchBreakdownRows.map(r => ({ branch: r.branch, pcs: Number(r.pcs || 0) })),
        totalRevenue,
        totalCollected: Number(statsRow?.total_collected || 0),
        totalReceivable: Number(statsRow?.total_receivable || 0),
        totalStaffWages,
        totalExpenses,
        netProfit
      }
    });
  } catch (error) {
    console.error('getJobOrders error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── GET SINGLE JOB ORDER DETAIL ────────────────────────────────────────────────
export async function getJobOrderDetail(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    const [order] = await query<any[]>(
      `SELECT o.*,
         (o.client_total_amount - o.amount_paid) AS balance_due
       FROM job_work_orders o
       WHERE o.id = ? AND o.tenant_id = ?`,
      [id, tenantId]
    );

    if (!order) {
      res.status(404).json({ message: 'Job work order not found' });
      return;
    }

    // Staff assignments for this order
    const assignments = await query<any[]>(
      `SELECT sa.*, s.phone AS staff_phone, s.role AS staff_role
       FROM job_work_staff_assignments sa
       LEFT JOIN staff s ON s.id = sa.staff_id
       WHERE sa.order_id = ? AND sa.tenant_id = ?
       ORDER BY sa.id ASC`,
      [id, tenantId]
    );

    // Direct job expenses
    const expenses = await query<any[]>(
      `SELECT * FROM job_work_expenses
       WHERE order_id = ? AND tenant_id = ?
       ORDER BY expense_date DESC, id DESC`,
      [id, tenantId]
    );

    const totalStaffWage = assignments.reduce((sum, a) => sum + Number(a.total_wage || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = Number(order.client_total_amount || 0) - totalStaffWage - totalExpenses;

    res.json({
      order,
      assignments,
      expenses,
      summary: {
        clientTotal: Number(order.client_total_amount || 0),
        amountPaid: Number(order.amount_paid || 0),
        balanceDue: Number(order.client_total_amount || 0) - Number(order.amount_paid || 0),
        totalStaffWage,
        totalExpenses,
        netProfit,
        profitMarginPct: Number(order.client_total_amount || 0) > 0
          ? parseFloat(((netProfit / Number(order.client_total_amount)) * 100).toFixed(1))
          : 0
      }
    });
  } catch (error) {
    console.error('getJobOrderDetail error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── CREATE NEW JOB WORK INTAKE ─────────────────────────────────────────────────
export async function createJobOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const {
    client_name,
    client_phone,
    received_date,
    target_delivery_date,
    branch,
    total_pcs,
    client_rate_per_pc,
    amount_paid,
    notes,
    staff_assignments,
    expenses
  } = req.body;

  if (!client_name || !received_date || !total_pcs || Number(total_pcs) <= 0) {
    res.status(400).json({ message: 'client_name, received_date, and valid total_pcs are required' });
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Generate Order Number: JW-YYYY-NNNN
    const year = new Date(received_date).getFullYear() || new Date().getFullYear();
    const [seqRows] = await conn.execute(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(order_no, '-', -1) AS UNSIGNED)), 0) + 1 AS next_seq
       FROM job_work_orders
       WHERE tenant_id = ? AND YEAR(received_date) = ?`,
      [tenantId, year]
    ) as any[];
    const nextSeq = seqRows[0]?.next_seq || 1;
    const orderNo = `JW-${year}-${String(nextSeq).padStart(4, '0')}`;

    const pcs = parseInt(String(total_pcs), 10) || 0;
    const rate = parseFloat(String(client_rate_per_pc)) || 0;
    const totalAmount = parseFloat((pcs * rate).toFixed(2));
    const paid = Math.min(totalAmount, Math.max(0, parseFloat(String(amount_paid)) || 0));
    const paymentStatus = paid >= totalAmount && totalAmount > 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending');
    const branchVal = (branch && String(branch).trim()) ? String(branch).trim() : 'Bajpe';

    // 2. Insert Job Order
    const [orderResult] = await conn.execute(
      `INSERT INTO job_work_orders (
         tenant_id, order_no, client_name, client_phone, received_date,
         target_delivery_date, branch, total_pcs, client_rate_per_pc,
         client_total_amount, amount_paid, payment_status, status, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)`,
      [
        tenantId,
        orderNo,
        String(client_name).trim(),
        client_phone ? String(client_phone).trim() : null,
        received_date,
        target_delivery_date || null,
        branchVal,
        pcs,
        rate,
        totalAmount,
        paid,
        paymentStatus,
        notes ? String(notes).trim() : null
      ]
    ) as any[];

    const orderId = orderResult.insertId;

    // 3. Optional Initial Staff Assignments
    if (Array.isArray(staff_assignments) && staff_assignments.length > 0) {
      for (const sa of staff_assignments) {
        const assignPcs = parseInt(sa.pcs_assigned, 10) || 0;
        const staffRate = parseFloat(sa.rate_per_pc) || 0;
        const totalWage = parseFloat((assignPcs * staffRate).toFixed(2));
        const sName = sa.staff_name ? String(sa.staff_name).trim() : 'Tailor';
        const sBranch = sa.branch || branchVal;

        if (assignPcs > 0) {
          await conn.execute(
            `INSERT INTO job_work_staff_assignments (
               tenant_id, order_id, staff_id, staff_name, branch,
               pcs_assigned, pcs_completed, rate_per_pc, total_wage,
               status, assigned_date, notes
             ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'assigned', ?, ?)`,
            [
              tenantId,
              orderId,
              sa.staff_id ? Number(sa.staff_id) : null,
              sName,
              sBranch,
              assignPcs,
              staffRate,
              totalWage,
              sa.assigned_date || received_date,
              sa.notes || null
            ]
          );
        }
      }
    }

    // 4. Optional Initial Expenses
    if (Array.isArray(expenses) && expenses.length > 0) {
      for (const ex of expenses) {
        const exAmt = parseFloat(ex.amount) || 0;
        const exTitle = ex.expense_title ? String(ex.expense_title).trim() : 'Material / Trim Expense';

        if (exAmt > 0) {
          await conn.execute(
            `INSERT INTO job_work_expenses (
               tenant_id, order_id, expense_title, amount, expense_date, notes
             ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              tenantId,
              orderId,
              exTitle,
              exAmt,
              ex.expense_date || received_date,
              ex.notes || null
            ]
          );
        }
      }
    }

    await conn.commit();
    res.status(201).json({
      message: 'Job work order created successfully',
      id: orderId,
      order_no: orderNo
    });
  } catch (error) {
    await conn.rollback();
    console.error('createJobOrder error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    conn.release();
  }
}

// ── UPDATE JOB ORDER ───────────────────────────────────────────────────────────
export async function updateJobOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const {
    client_name,
    client_phone,
    received_date,
    target_delivery_date,
    delivered_date,
    branch,
    total_pcs,
    client_rate_per_pc,
    amount_paid,
    status,
    notes
  } = req.body;

  try {
    const [existing] = await query<any[]>(
      `SELECT * FROM job_work_orders WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ message: 'Job work order not found' });
      return;
    }

    const pcs = total_pcs !== undefined ? (parseInt(String(total_pcs), 10) || 0) : existing.total_pcs;
    const rate = client_rate_per_pc !== undefined ? (parseFloat(String(client_rate_per_pc)) || 0) : existing.client_rate_per_pc;
    const totalAmount = parseFloat((pcs * rate).toFixed(2));
    const paid = amount_paid !== undefined ? parseFloat(String(amount_paid)) || 0 : existing.amount_paid;
    const paymentStatus = paid >= totalAmount && totalAmount > 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending');

    let newStatus = status || existing.status;
    let delDate = delivered_date !== undefined ? delivered_date : existing.delivered_date;

    if (newStatus === 'delivered' && !delDate) {
      delDate = new Date().toISOString().slice(0, 10);
    }

    await query(
      `UPDATE job_work_orders SET
         client_name = ?,
         client_phone = ?,
         received_date = ?,
         target_delivery_date = ?,
         delivered_date = ?,
         branch = ?,
         total_pcs = ?,
         client_rate_per_pc = ?,
         client_total_amount = ?,
         amount_paid = ?,
         payment_status = ?,
         status = ?,
         notes = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        client_name ? String(client_name).trim() : existing.client_name,
        client_phone !== undefined ? (client_phone ? String(client_phone).trim() : null) : existing.client_phone,
        received_date || existing.received_date,
        target_delivery_date !== undefined ? (target_delivery_date || null) : existing.target_delivery_date,
        delDate || null,
        branch || existing.branch,
        pcs,
        rate,
        totalAmount,
        paid,
        paymentStatus,
        newStatus,
        notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
        id,
        tenantId
      ]
    );

    res.json({ message: 'Job work order updated successfully' });
  } catch (error) {
    console.error('updateJobOrder error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── QUICK MARK DELIVERED ───────────────────────────────────────────────────────
export async function markJobDelivered(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const deliveredDate = req.body.delivered_date || new Date().toISOString().slice(0, 10);

  try {
    const result = await query<any>(
      `UPDATE job_work_orders
       SET status = 'delivered', delivered_date = ?
       WHERE id = ? AND tenant_id = ?`,
      [deliveredDate, id, tenantId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Job work order not found' });
      return;
    }

    res.json({ message: 'Order marked as delivered successfully', delivered_date: deliveredDate });
  } catch (error) {
    console.error('markJobDelivered error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── DELETE JOB ORDER ───────────────────────────────────────────────────────────
export async function deleteJobOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute('DELETE FROM job_work_staff_assignments WHERE order_id = ? AND tenant_id = ?', [id, tenantId]);
    await conn.execute('DELETE FROM job_work_expenses WHERE order_id = ? AND tenant_id = ?', [id, tenantId]);
    const [delResult] = await conn.execute('DELETE FROM job_work_orders WHERE id = ? AND tenant_id = ?', [id, tenantId]) as any[];

    if (delResult.affectedRows === 0) {
      await conn.rollback();
      res.status(404).json({ message: 'Job work order not found' });
      return;
    }

    await conn.commit();
    res.json({ message: 'Job work order deleted successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('deleteJobOrder error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    conn.release();
  }
}

// ── STAFF ASSIGNMENTS ──────────────────────────────────────────────────────────
export async function addStaffAssignment(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params; // order_id
  const { staff_id, staff_name, branch, pcs_assigned, rate_per_pc, assigned_date, notes } = req.body;

  const pcs = parseInt(String(pcs_assigned), 10) || 0;
  const rate = parseFloat(String(rate_per_pc)) || 0;
  if (!staff_name || pcs <= 0) {
    res.status(400).json({ message: 'staff_name and valid pcs_assigned are required' });
    return;
  }

  try {
    const totalWage = parseFloat((pcs * rate).toFixed(2));
    const r = await query<any>(
      `INSERT INTO job_work_staff_assignments (
         tenant_id, order_id, staff_id, staff_name, branch,
         pcs_assigned, pcs_completed, rate_per_pc, total_wage,
         status, assigned_date, notes
       ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'assigned', ?, ?)`,
      [
        tenantId,
        id,
        staff_id ? Number(staff_id) : null,
        String(staff_name).trim(),
        branch || 'Bajpe',
        pcs,
        rate,
        totalWage,
        assigned_date || new Date().toISOString().slice(0, 10),
        notes ? String(notes).trim() : null
      ]
    );

    // Also update order status to in_progress if currently received
    await query(
      `UPDATE job_work_orders SET status = 'in_progress' WHERE id = ? AND tenant_id = ? AND status = 'received'`,
      [id, tenantId]
    );

    res.status(201).json({ id: r.insertId, message: 'Staff assignment added successfully' });
  } catch (error) {
    console.error('addStaffAssignment error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateStaffAssignment(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { assignmentId } = req.params;
  const { pcs_completed, pcs_assigned, rate_per_pc, status, notes } = req.body;

  try {
    const [existing] = await query<any[]>(
      `SELECT * FROM job_work_staff_assignments WHERE id = ? AND tenant_id = ?`,
      [assignmentId, tenantId]
    );

    if (!existing) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }

    const assigned = pcs_assigned !== undefined ? (parseInt(String(pcs_assigned), 10) || 0) : existing.pcs_assigned;
    const completed = pcs_completed !== undefined ? (parseInt(String(pcs_completed), 10) || 0) : existing.pcs_completed;
    const rate = rate_per_pc !== undefined ? (parseFloat(String(rate_per_pc)) || 0) : existing.rate_per_pc;
    const totalWage = parseFloat((assigned * rate).toFixed(2));
    const newStatus = status || (completed >= assigned && assigned > 0 ? 'completed' : (completed > 0 ? 'in_progress' : existing.status));
    const completedDate = newStatus === 'completed' ? (existing.completed_date || new Date().toISOString().slice(0, 10)) : null;

    await query(
      `UPDATE job_work_staff_assignments SET
         pcs_assigned = ?,
         pcs_completed = ?,
         rate_per_pc = ?,
         total_wage = ?,
         status = ?,
         completed_date = ?,
         notes = ?
       WHERE id = ? AND tenant_id = ?`,
      [assigned, completed, rate, totalWage, newStatus, completedDate, notes !== undefined ? notes : existing.notes, assignmentId, tenantId]
    );

    res.json({ message: 'Staff assignment updated' });
  } catch (error) {
    console.error('updateStaffAssignment error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteStaffAssignment(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { assignmentId } = req.params;

  try {
    const r = await query<any>(
      `DELETE FROM job_work_staff_assignments WHERE id = ? AND tenant_id = ?`,
      [assignmentId, tenantId]
    );
    if (r.affectedRows === 0) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }
    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    console.error('deleteStaffAssignment error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── JOB WORK EXPENSES ─────────────────────────────────────────────────────────
export async function addJobExpense(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params; // order_id
  const { expense_title, amount, expense_date, notes } = req.body;

  const amt = parseFloat(String(amount)) || 0;
  if (!expense_title || amt <= 0) {
    res.status(400).json({ message: 'expense_title and valid amount required' });
    return;
  }

  try {
    const r = await query<any>(
      `INSERT INTO job_work_expenses (tenant_id, order_id, expense_title, amount, expense_date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        id,
        String(expense_title).trim(),
        amt,
        expense_date || new Date().toISOString().slice(0, 10),
        notes ? String(notes).trim() : null
      ]
    );
    res.status(201).json({ id: r.insertId, message: 'Expense added successfully' });
  } catch (error) {
    console.error('addJobExpense error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteJobExpense(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { expenseId } = req.params;

  try {
    const r = await query<any>(
      `DELETE FROM job_work_expenses WHERE id = ? AND tenant_id = ?`,
      [expenseId, tenantId]
    );
    if (r.affectedRows === 0) {
      res.status(404).json({ message: 'Expense not found' });
      return;
    }
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('deleteJobExpense error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── STAFF PAYOUTS & WAGE LEDGER (OPTION A - STANDALONE) ────────────────────────
export async function getStaffPayoutsSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;

  try {
    // 1. Total stitching earned per staff member across all client job work
    const staffEarnings = await query<any[]>(
      `SELECT 
         COALESCE(sa.staff_id, 0) AS staff_id,
         sa.staff_name,
         sa.branch,
         COUNT(DISTINCT sa.order_id) AS total_orders,
         SUM(sa.pcs_assigned) AS total_pcs_assigned,
         SUM(sa.pcs_completed) AS total_pcs_completed,
         SUM(sa.pcs_assigned * sa.rate_per_pc) AS total_wage_allocated,
         SUM(sa.pcs_completed * sa.rate_per_pc) AS total_wage_earned
       FROM job_work_staff_assignments sa
       WHERE sa.tenant_id = ?
       GROUP BY COALESCE(sa.staff_id, 0), sa.staff_name, sa.branch
       ORDER BY sa.branch, sa.staff_name`,
      [tenantId]
    );

    // 2. Total payouts paid to each staff member in job work
    const staffPayouts = await query<any[]>(
      `SELECT 
         COALESCE(staff_id, 0) AS staff_id,
         staff_name,
         SUM(amount) AS total_paid
       FROM job_work_staff_payouts
       WHERE tenant_id = ?
       GROUP BY COALESCE(staff_id, 0), staff_name`,
      [tenantId]
    );

    const payoutMap = new Map<string, number>();
    for (const p of staffPayouts) {
      const key = `${p.staff_id}_${(p.staff_name || '').toLowerCase().trim()}`;
      payoutMap.set(key, Number(p.total_paid || 0));
    }

    const ledger = staffEarnings.map(s => {
      const key = `${s.staff_id}_${(s.staff_name || '').toLowerCase().trim()}`;
      const totalPaid = payoutMap.get(key) || 0;
      const totalEarned = Number(s.total_wage_earned || 0);
      return {
        ...s,
        total_paid: totalPaid,
        pending_balance: Math.max(0, totalEarned - totalPaid)
      };
    });

    // 3. Recent 50 Payout vouchers
    const recentPayouts = await query<any[]>(
      `SELECT p.*, o.order_no
       FROM job_work_staff_payouts p
       LEFT JOIN job_work_orders o ON o.id = p.reference_order_id
       WHERE p.tenant_id = ?
       ORDER BY p.payment_date DESC, p.id DESC
       LIMIT 50`,
      [tenantId]
    );

    res.json({
      ledger,
      payouts: recentPayouts
    });
  } catch (error) {
    console.error('getStaffPayoutsSummary error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function recordStaffPayout(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { staff_id, staff_name, branch, amount, payment_mode, payment_date, reference_order_id, notes } = req.body;

  const amt = parseFloat(String(amount)) || 0;
  if (!staff_name || amt <= 0) {
    res.status(400).json({ message: 'staff_name and valid amount required' });
    return;
  }

  try {
    const r = await query<any>(
      `INSERT INTO job_work_staff_payouts (
         tenant_id, staff_id, staff_name, branch, amount,
         payment_mode, payment_date, reference_order_id, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        staff_id ? Number(staff_id) : null,
        String(staff_name).trim(),
        branch || 'Bajpe',
        amt,
        payment_mode || 'cash',
        payment_date || new Date().toISOString().slice(0, 10),
        reference_order_id ? Number(reference_order_id) : null,
        notes ? String(notes).trim() : null
      ]
    );

    res.status(201).json({ id: r.insertId, message: 'Staff payout recorded successfully' });
  } catch (error) {
    console.error('recordStaffPayout error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteStaffPayout(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { payoutId } = req.params;

  try {
    const r = await query<any>(
      `DELETE FROM job_work_staff_payouts WHERE id = ? AND tenant_id = ?`,
      [payoutId, tenantId]
    );
    if (r.affectedRows === 0) {
      res.status(404).json({ message: 'Payout entry not found' });
      return;
    }
    res.json({ message: 'Staff payout entry deleted' });
  } catch (error) {
    console.error('deleteStaffPayout error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ── DYNAMIC BRANCHES MANAGEMENT ────────────────────────────────────────────────
export async function getBranches(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;

  try {
    // 1. Fetch from job_work_branches
    const branchRows = await query<any[]>(
      `SELECT name FROM job_work_branches WHERE tenant_id = ? AND is_active = 1 ORDER BY name ASC`,
      [tenantId]
    ).catch(() => []);

    // 2. Fetch any branches recorded in orders or assignments
    const usedRows = await query<any[]>(
      `SELECT DISTINCT branch FROM (
         SELECT branch FROM job_work_orders WHERE tenant_id = ?
         UNION
         SELECT branch FROM job_work_staff_assignments WHERE tenant_id = ?
       ) t WHERE branch IS NOT NULL AND TRIM(branch) != ''`,
      [tenantId, tenantId]
    ).catch(() => []);

    const set = new Set<string>();
    // Default initial branches
    set.add('Bajpe');
    set.add('Kannur');

    for (const b of branchRows) {
      if (b.name && String(b.name).trim()) set.add(String(b.name).trim());
    }
    for (const u of usedRows) {
      if (u.branch && String(u.branch).trim()) set.add(String(u.branch).trim());
    }

    const branches = Array.from(set).sort((a, b) => a.localeCompare(b));
    res.json(branches);
  } catch (error) {
    console.error('getBranches error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function addBranch(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const name = req.body.name ? String(req.body.name).trim() : '';

  if (!name) {
    res.status(400).json({ message: 'Branch name is required' });
    return;
  }

  try {
    // Check if branch already exists
    const existing = await query<any[]>(
      `SELECT id FROM job_work_branches WHERE tenant_id = ? AND LOWER(name) = LOWER(?)`,
      [tenantId, name]
    );

    if (existing && existing.length > 0) {
      // Re-activate if was deactivated
      await query(`UPDATE job_work_branches SET is_active = 1 WHERE id = ?`, [existing[0].id]);
      res.json({ message: 'Branch available', name });
      return;
    }

    await query(
      `INSERT INTO job_work_branches (tenant_id, name, is_active) VALUES (?, ?, 1)`,
      [tenantId, name]
    );

    res.status(201).json({ message: 'Branch created successfully', name });
  } catch (error) {
    console.error('addBranch error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}
