import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

// ── Clients ──────────────────────────────────────────────────────────────────

export async function getClients(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const showAll = req.query.all === '1';
  try {
    const rows = await query(
      `SELECT * FROM clients WHERE tenant_id=?${showAll ? '' : ' AND is_active=1'} ORDER BY is_active DESC, name`,
      [tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function addClient(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { name, phone, address, city } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: 'Name required' }); return; }
  try {
    const r = await query<any>(
      'INSERT INTO clients (tenant_id, name, phone, address, city) VALUES (?,?,?,?,?)',
      [tenantId, name.trim(), phone || null, address || null, city || null]
    );
    res.status(201).json({ id: r.insertId, name: name.trim(), phone, address, city });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function updateClient(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { name, phone, address, city } = req.body;
  try {
    await query(
      'UPDATE clients SET name=?, phone=?, address=?, city=? WHERE id=? AND tenant_id=?',
      [name, phone || null, address || null, city || null, id, tenantId]
    );
    res.json({ message: 'Updated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function deactivateClient(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('UPDATE clients SET is_active=0 WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deactivated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function reactivateClient(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('UPDATE clients SET is_active=1 WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Reactivated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// ── Category Rates ───────────────────────────────────────────────────────────

export async function getCategoryRates(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      'SELECT category, rate_per_pc FROM sales_category_rates WHERE tenant_id=?',
      [tenantId]
    );
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function upsertCategoryRate(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { category, rate_per_pc } = req.body;
  if (!category || rate_per_pc === undefined) { res.status(400).json({ message: 'category and rate_per_pc required' }); return; }
  try {
    await query(
      `INSERT INTO sales_category_rates (tenant_id, category, rate_per_pc) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE rate_per_pc=VALUES(rate_per_pc)`,
      [tenantId, category, rate_per_pc]
    );
    res.json({ message: 'Saved' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

// ── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { client_id, status, from, to } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  try {
    const conds: string[] = ['o.tenant_id=?'];
    const vals: any[]     = [tenantId];
    if (client_id) { conds.push('o.client_id=?');                               vals.push(client_id); }
    if (status === 'pending') { conds.push("o.status IN ('pending','partial')"); }
    else if (status) { conds.push('o.status=?');                                vals.push(status); }
    if (from)      { conds.push('o.order_date>=?');      vals.push(from); }
    if (to)        { conds.push('o.order_date<=?');      vals.push(to); }

    // Count query
    const [countRows] = await query<any[]>(
      `SELECT COUNT(DISTINCT o.id) AS total 
       FROM sales_orders o 
       WHERE ${conds.join(' AND ')}`,
      vals
    );
    const total = countRows?.total || 0;

    // Data query with LIMIT & OFFSET
    const orders = await query<any[]>(
      `SELECT o.*, c.name AS client_name, c.city AS client_city,
              COALESCE(SUM(i.quantity * i.rate_per_pc), 0) AS subtotal,
              ((GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100)) AS total,
              COUNT(i.id) AS item_count,
              (
                SELECT COALESCE(SUM(
                  (GREATEST(0, (SELECT COALESCE(SUM(i2.quantity * i2.rate_per_pc), 0) FROM sales_order_items i2 WHERE i2.order_id = o2.id) - o2.discount))
                  * (1 + o2.gst_percent / 100) - o2.amount_paid
                ), 0)
                FROM sales_orders o2
                WHERE o2.tenant_id = ? AND o2.client_id = o.client_id
              ) AS client_total_outstanding
       FROM sales_orders o
       JOIN clients c ON c.id = o.client_id
       LEFT JOIN sales_order_items i ON i.order_id = o.id
       WHERE ${conds.join(' AND ')}
       GROUP BY o.id
       ORDER BY o.order_date DESC, o.created_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, ...vals, limit, offset]
    );

    res.json({
      data: orders,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit
    });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    const orders = await query<any[]>(
      `SELECT o.*, c.name AS client_name, c.phone AS client_phone,
              c.address AS client_address, c.city AS client_city
       FROM sales_orders o
       JOIN clients c ON c.id = o.client_id
       WHERE o.id=? AND o.tenant_id=?`,
      [id, tenantId]
    );
    if (!orders.length) { res.status(404).json({ message: 'Not found' }); return; }
    const order = orders[0];
    const items = await query(
      'SELECT * FROM sales_order_items WHERE order_id=?',
      [id]
    );
    // Other outstanding invoices for the same client (excluding this one)
    const otherOutstanding = await query<any[]>(
      `SELECT o.id, o.invoice_number, o.order_date, o.status, o.amount_paid,
              (GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100) AS total
       FROM sales_orders o
       LEFT JOIN sales_order_items i ON i.order_id = o.id
       WHERE o.tenant_id=? AND o.client_id=? AND o.id != ?
         AND o.status IN ('pending','partial')
       GROUP BY o.id
       ORDER BY o.order_date ASC`,
      [tenantId, order.client_id, id]
    );
    const payments = await query<any[]>(
      'SELECT * FROM sales_payments WHERE order_id=? ORDER BY payment_date ASC, id ASC',
      [id]
    );
    res.json({ ...order, items, other_outstanding: otherOutstanding, payments });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { client_id, order_date, items, notes, include_gst, gst_percent, discount, discount_percent } = req.body;

  if (!client_id || !order_date || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'client_id, order_date and items required' }); return;
  }

  try {
    // Auto-generate invoice number: INV-YYYY-NNNN scoped per tenant per year
    const year = new Date(order_date).getFullYear();
    const seqRows = await query<any[]>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)), 0) + 1 AS next_seq
       FROM sales_orders WHERE tenant_id=? AND YEAR(order_date)=?`,
      [tenantId, year]
    );
    const seq = seqRows[0].next_seq;
    const invoiceNumber = `INV-${year}-${String(seq).padStart(4, '0')}`;

    let subtotal = 0;
    for (const item of items) {
      subtotal += (+item.quantity || 0) * (+item.rate_per_pc || 0);
    }
    const discountPct = parseFloat(discount_percent ?? discount) || 0;
    const discountAmt = parseFloat(((subtotal * discountPct) / 100).toFixed(2));

    const r = await query<any>(
      `INSERT INTO sales_orders (tenant_id, client_id, invoice_number, order_date, notes, include_gst, gst_percent, discount_percent, discount)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [tenantId, client_id, invoiceNumber, order_date, notes || null,
       include_gst ? 1 : 0, include_gst ? (gst_percent || 0) : 0, discountPct, discountAmt]
    );
    const orderId = r.insertId;

    for (const item of items) {
      await query(
        'INSERT INTO sales_order_items (order_id, category, size, quantity, rate_per_pc) VALUES (?,?,?,?,?)',
        [orderId, item.category, item.size || null, item.quantity, item.rate_per_pc]
      );
    }

    // Return full order
    const full = await query<any[]>(
      `SELECT o.*, c.name AS client_name, c.city AS client_city FROM sales_orders o
       JOIN clients c ON c.id = o.client_id WHERE o.id=?`,
      [orderId]
    );
    res.status(201).json(full[0]);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function updateOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { client_id, order_date, items, notes, include_gst, gst_percent, discount, discount_percent } = req.body;

  if (!client_id || !order_date || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'client_id, order_date and items required' }); return;
  }

  try {
    let subtotal = 0;
    for (const item of items) {
      subtotal += (+item.quantity || 0) * (+item.rate_per_pc || 0);
    }
    const discountPct = parseFloat(discount_percent ?? discount) || 0;
    const discountAmt = parseFloat(((subtotal * discountPct) / 100).toFixed(2));

    await query(
      `UPDATE sales_orders 
       SET client_id=?, order_date=?, notes=?, include_gst=?, gst_percent=?, discount_percent=?, discount=?
       WHERE id=? AND tenant_id=?`,
      [client_id, order_date, notes || null, include_gst ? 1 : 0, include_gst ? (gst_percent || 0) : 0, discountPct, discountAmt, id, tenantId]
    );

    await query('DELETE FROM sales_order_items WHERE order_id=?', [id]);

    for (const item of items) {
      await query(
        'INSERT INTO sales_order_items (order_id, category, size, quantity, rate_per_pc) VALUES (?,?,?,?,?)',
        [id, item.category, item.size || null, item.quantity, item.rate_per_pc]
      );
    }

    const full = await query<any[]>(
      `SELECT o.*, c.name AS client_name, c.city AS client_city FROM sales_orders o
       JOIN clients c ON c.id = o.client_id WHERE o.id=?`,
      [id]
    );
    res.json(full[0]);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function markPaid(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    // Compute full total and set amount_paid = total
    const totals = await query<any[]>(
      `SELECT o.amount_paid,
              COALESCE(SUM(i.quantity * i.rate_per_pc), 0) AS sub,
              o.discount, o.gst_percent, o.include_gst
       FROM sales_orders o
       LEFT JOIN sales_order_items i ON i.order_id = o.id
       WHERE o.id=? AND o.tenant_id=?
       GROUP BY o.id`,
      [id, tenantId]
    );
    if (!totals.length) { res.status(404).json({ message: 'Not found' }); return; }
    const { sub, discount, gst_percent, include_gst, amount_paid } = totals[0];
    const taxable = Math.max(0, Number(sub) - Number(discount || 0));
    const total = taxable * (1 + (include_gst ? Number(gst_percent) / 100 : 0));
    const diff = total - Number(amount_paid || 0);

    if (diff > 0) {
      await query(
        'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date) VALUES (?,?,?,CURDATE())',
        [tenantId, id, diff]
      );
    }

    await query(
      `UPDATE sales_orders SET status='paid', paid_at=NOW(), amount_paid=? WHERE id=? AND tenant_id=?`,
      [total, id, tenantId]
    );
    res.json({ message: 'Marked as paid' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function recordPayment(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { amount, payment_date } = req.body;
  if (!amount || Number(amount) <= 0) { res.status(400).json({ message: 'amount required' }); return; }
  try {
    const paymentDate = payment_date || new Date().toISOString().slice(0, 10);
    // Get current amount_paid and order total
    const rows = await query<any[]>(
      `SELECT o.amount_paid,
              COALESCE(SUM(i.quantity * i.rate_per_pc), 0) AS sub,
              o.discount, o.gst_percent, o.include_gst
       FROM sales_orders o
       LEFT JOIN sales_order_items i ON i.order_id = o.id
       WHERE o.id=? AND o.tenant_id=?
       GROUP BY o.id`,
      [id, tenantId]
    );
    if (!rows.length) { res.status(404).json({ message: 'Not found' }); return; }
    const { amount_paid, sub, discount, gst_percent, include_gst } = rows[0];
    const taxable    = Math.max(0, Number(sub) - Number(discount || 0));
    const total      = taxable * (1 + (include_gst ? Number(gst_percent) / 100 : 0));
    const newPaid    = Math.min(Number(amount_paid) + Number(amount), total);
    const newStatus  = newPaid >= total ? 'paid' : 'partial';
    const paidAt     = newStatus === 'paid' ? 'NOW()' : 'NULL';
    await query(
      `UPDATE sales_orders SET amount_paid=?, status=?, paid_at=${paidAt === 'NULL' ? 'NULL' : 'NOW()'}
       WHERE id=? AND tenant_id=?`,
      [newPaid, newStatus, id, tenantId]
    );
    await query(
      'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date) VALUES (?,?,?,?)',
      [tenantId, id, amount, paymentDate]
    );
    res.json({ message: 'Payment recorded', amount_paid: newPaid, status: newStatus, total });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function deleteOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('DELETE FROM sales_order_items WHERE order_id=?', [id]);
    await query('DELETE FROM sales_orders WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deleted' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getSalesSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    // Aggregate at order level first to avoid JOIN fan-out multiplying amount_paid
    const rows = await query<any[]>(
      `SELECT
         COALESCE(SUM(sub.billed), 0)               AS total_billed,
         COALESCE(SUM(sub.amount_paid), 0)           AS total_received,
         COALESCE(SUM(sub.billed - sub.amount_paid), 0) AS total_pending,
         COUNT(*)                                    AS order_count,
         COUNT(CASE WHEN sub.status != 'paid' THEN 1 END) AS pending_count
       FROM (
         SELECT o.id, o.status, o.amount_paid,
                GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount) * (1 + o.gst_percent / 100) AS billed
         FROM sales_orders o
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE o.tenant_id = ?
         GROUP BY o.id
       ) sub`,
      [tenantId]
    );
    res.json(rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}
export async function getNightiesCategorySummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query<any[]>(`
      SELECT
        SUM(CASE WHEN i.category = 'shawl_nighty' THEN i.quantity ELSE 0 END) AS shawl_nighty,
        SUM(CASE WHEN i.category = 'shawl_nighty_lace' THEN i.quantity ELSE 0 END) AS shawl_nighty_lace,
        SUM(CASE WHEN i.category = 'ordinary_nighty' THEN i.quantity ELSE 0 END) AS ordinary_nighty,
        (
          SUM(CASE WHEN i.category = 'shawl_nighty' THEN i.quantity ELSE 0 END) +
          SUM(CASE WHEN i.category = 'shawl_nighty_lace' THEN i.quantity ELSE 0 END) +
          SUM(CASE WHEN i.category = 'ordinary_nighty' THEN i.quantity ELSE 0 END)
        ) AS total
      FROM sales_order_items i
      JOIN sales_orders o ON i.order_id = o.id
      WHERE o.tenant_id = ?
    `, [tenantId]);
    res.json(rows[0] || { shawl_nighty: 0, shawl_nighty_lace: 0, ordinary_nighty: 0, total: 0 });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}
