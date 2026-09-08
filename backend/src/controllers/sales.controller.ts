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
  const { client_id, status, from, to, search } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  try {
    const conds: string[] = ['o.tenant_id=?'];
    const vals: any[]     = [tenantId];
    if (client_id && client_id !== 'all') { conds.push('o.client_id=?');                               vals.push(client_id); }
    if (status === 'pending') { conds.push("o.status IN ('pending','partial')"); }
    else if (status && status !== 'all') { conds.push('o.status=?');                                vals.push(status); }
    if (from)      { conds.push('o.order_date>=?');      vals.push(from); }
    if (to)        { conds.push('o.order_date<=?');      vals.push(to); }
    if (search && String(search).trim()) {
      conds.push('(o.invoice_number LIKE ? OR c.name LIKE ? OR c.city LIKE ?)');
      const term = `%${String(search).trim()}%`;
      vals.push(term, term, term);
    }

    // Count query
    const [countRows] = await query<any[]>(
      `SELECT COUNT(DISTINCT o.id) AS total 
       FROM sales_orders o 
       JOIN clients c ON c.id = o.client_id
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
    const discountAmt = parseFloat(discount) || 0;
    const discountPct = subtotal > 0 ? parseFloat(((discountAmt / subtotal) * 100).toFixed(2)) : 0;

    const taxable = Math.max(0, subtotal - discountAmt);
    const total = taxable * (1 + (include_gst ? (Number(gst_percent) || 0) / 100 : 0));
    const initialPaid = Math.min(Number(req.body.amount_paid || req.body.advance_paid || 0), total);
    const initialStatus = initialPaid >= total && total > 0 ? 'paid' : (initialPaid > 0 ? 'partial' : 'pending');
    const paymentMode = (req.body.payment_mode || 'cash').trim();

    const r = await query<any>(
      `INSERT INTO sales_orders (tenant_id, client_id, invoice_number, order_date, notes, include_gst, gst_percent, discount_percent, discount, amount_paid, status, paid_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [tenantId, client_id, invoiceNumber, order_date, notes || null,
       include_gst ? 1 : 0, include_gst ? (gst_percent || 0) : 0, discountPct, discountAmt, initialPaid, initialStatus, initialStatus === 'paid' ? new Date() : null]
    );
    const orderId = r.insertId;

    for (const item of items) {
      await query(
        'INSERT INTO sales_order_items (order_id, category, size, quantity, rate_per_pc) VALUES (?,?,?,?,?)',
        [orderId, item.category, item.size || null, item.quantity, item.rate_per_pc]
      );
    }

    if (initialPaid > 0) {
      try {
        await query(
          'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date, payment_mode) VALUES (?,?,?,?,?)',
          [tenantId, orderId, initialPaid, order_date, paymentMode]
        );
      } catch {
        await query(
          'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date) VALUES (?,?,?,?)',
          [tenantId, orderId, initialPaid, order_date]
        );
      }
    }

    // Return full order
    const full = await query<any[]>(
      `SELECT o.*, c.name AS client_name, c.client_city FROM sales_orders o
       JOIN clients c ON c.id = o.client_id WHERE o.id=?`,
      [orderId]
    ).catch(async () => {
      return await query<any[]>(
        `SELECT o.*, c.name AS client_name, c.city AS client_city FROM sales_orders o
         JOIN clients c ON c.id = o.client_id WHERE o.id=?`,
        [orderId]
      );
    });
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
    const discountAmt = parseFloat(discount) || 0;
    const discountPct = subtotal > 0 ? parseFloat(((discountAmt / subtotal) * 100).toFixed(2)) : 0;

    const taxable = Math.max(0, subtotal - discountAmt);
    const total = taxable * (1 + (include_gst ? (Number(gst_percent) || 0) / 100 : 0));

    // Handle amount_paid if supplied
    if (req.body.amount_paid !== undefined) {
      const newAmountPaid = Math.min(Math.max(0, Number(req.body.amount_paid || 0)), total);
      const newStatus = newAmountPaid >= total && total > 0 ? 'paid' : (newAmountPaid > 0 ? 'partial' : 'pending');
      const paidAt = newStatus === 'paid' ? new Date() : null;

      await query(
        `UPDATE sales_orders 
         SET client_id=?, order_date=?, notes=?, include_gst=?, gst_percent=?, discount_percent=?, discount=?, amount_paid=?, status=?, paid_at=?
         WHERE id=? AND tenant_id=?`,
        [client_id, order_date, notes || null, include_gst ? 1 : 0, include_gst ? (gst_percent || 0) : 0, discountPct, discountAmt, newAmountPaid, newStatus, paidAt, id, tenantId]
      );

      // Sync sales_payments table
      await query('DELETE FROM sales_payments WHERE order_id=? AND tenant_id=?', [id, tenantId]);
      if (newAmountPaid > 0) {
        const paymentMode = (req.body.payment_mode || 'cash').trim();
        try {
          await query(
            'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date, payment_mode) VALUES (?,?,?,?,?)',
            [tenantId, id, newAmountPaid, order_date, paymentMode]
          );
        } catch {
          await query(
            'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date) VALUES (?,?,?,?)',
            [tenantId, id, newAmountPaid, order_date]
          );
        }
      }
    } else {
      await query(
        `UPDATE sales_orders 
         SET client_id=?, order_date=?, notes=?, include_gst=?, gst_percent=?, discount_percent=?, discount=?
         WHERE id=? AND tenant_id=?`,
        [client_id, order_date, notes || null, include_gst ? 1 : 0, include_gst ? (gst_percent || 0) : 0, discountPct, discountAmt, id, tenantId]
      );
    }

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
      const paymentMode = (req.body.payment_mode || 'cash').trim();
      try {
        await query(
          'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date, payment_mode) VALUES (?,?,?,CURDATE(),?)',
          [tenantId, id, diff, paymentMode]
        );
      } catch {
        await query(
          'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date) VALUES (?,?,?,CURDATE())',
          [tenantId, id, diff]
        );
      }
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
  const { amount, payment_date, payment_mode, notes } = req.body;
  if (!amount || Number(amount) <= 0) { res.status(400).json({ message: 'amount required' }); return; }
  try {
    const paymentDate = payment_date || new Date().toISOString().slice(0, 10);
    const paymentMode = (payment_mode || 'cash').trim();
    const year = new Date(paymentDate).getFullYear();

    // Generate receipt_no
    const seqRows = await query<any[]>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(receipt_no, '-', -1) AS UNSIGNED)), 0) + 1 AS next_seq
       FROM sales_payments 
       WHERE tenant_id=? AND YEAR(payment_date)=? AND receipt_no LIKE 'RCP-%'`,
      [tenantId, year]
    );
    const seq = seqRows[0].next_seq;
    const receiptNo = `RCP-${year}-${String(seq).padStart(4, '0')}`;

    // Insert payment with receipt_no and notes
    await query(
      'INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date, payment_mode, receipt_no, notes) VALUES (?,?,?,?,?,?,?)',
      [tenantId, id, amount, paymentDate, paymentMode, receiptNo, notes || null]
    );

    // Get order total and sum of all payments
    const rows = await query<any[]>(
      `SELECT
         COALESCE(SUM(i.quantity * i.rate_per_pc), 0) AS sub,
         o.discount, o.gst_percent, o.include_gst,
         (SELECT COALESCE(SUM(p.amount), 0) FROM sales_payments p WHERE p.order_id = o.id AND p.tenant_id = o.tenant_id) AS total_paid
       FROM sales_orders o
       LEFT JOIN sales_order_items i ON i.order_id = o.id
       WHERE o.id=? AND o.tenant_id=?
       GROUP BY o.id`,
      [id, tenantId]
    );
    if (!rows.length) { res.status(404).json({ message: 'Not found' }); return; }
    const { sub, discount, gst_percent, include_gst, total_paid } = rows[0];
    const taxable    = Math.max(0, Number(sub) - Number(discount || 0));
    const total      = taxable * (1 + (include_gst ? Number(gst_percent) / 100 : 0));
    const newPaid    = Math.min(Number(total_paid || 0), total);
    const newStatus  = newPaid >= total && total > 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');
    const paidAt     = newStatus === 'paid' ? 'NOW()' : 'NULL';
    await query(
      `UPDATE sales_orders SET amount_paid=?, status=?, paid_at=${paidAt === 'NULL' ? 'NULL' : 'NOW()'}
       WHERE id=? AND tenant_id=?`,
      [newPaid, newStatus, id, tenantId]
    );

    res.json({ message: 'Payment recorded', receipt_no: receiptNo, amount_paid: newPaid, status: newStatus, total, payment_mode: paymentMode });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function deleteOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('DELETE FROM sales_payments WHERE order_id=? AND tenant_id=?', [id, tenantId]);
    await query('DELETE FROM sales_order_items WHERE order_id=?', [id]);
    await query('DELETE FROM sales_orders WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deleted' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getSalesSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { client_id, from, to } = req.query;
  try {
    const conds: string[] = ['o.tenant_id=?'];
    const vals: any[]     = [tenantId];
    if (client_id && client_id !== 'all') { conds.push('o.client_id=?'); vals.push(client_id); }
    if (from) { conds.push('o.order_date>=?'); vals.push(from); }
    if (to)   { conds.push('o.order_date<=?'); vals.push(to); }

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
         WHERE ${conds.join(' AND ')}
         GROUP BY o.id
       ) sub`,
      vals
    );
    res.json(rows[0] || { total_billed: 0, total_received: 0, total_pending: 0, order_count: 0, pending_count: 0 });
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

export async function recordMultiInvoicePayment(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { client_id, payment_date, payment_mode, notes, allocations } = req.body;

  if (!client_id || !Array.isArray(allocations) || allocations.length === 0) {
    res.status(400).json({ message: 'Client and at least one invoice allocation are required' });
    return;
  }

  const validAllocs = allocations.filter(a => a && a.order_id && Number(a.amount) > 0);
  if (validAllocs.length === 0) {
    res.status(400).json({ message: 'At least one allocation must have amount greater than 0' });
    return;
  }

  const paymentDate = payment_date || new Date().toISOString().slice(0, 10);
  const paymentMode = (payment_mode || 'cash').trim();
  const year = new Date(paymentDate).getFullYear();

  try {
    // Generate sequential receipt number: RCP-YYYY-NNNN scoped per tenant per year
    const seqRows = await query<any[]>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(receipt_no, '-', -1) AS UNSIGNED)), 0) + 1 AS next_seq
       FROM sales_payments 
       WHERE tenant_id=? AND YEAR(payment_date)=? AND receipt_no LIKE 'RCP-%'`,
      [tenantId, year]
    );
    const seq = seqRows[0].next_seq;
    const receiptNo = `RCP-${year}-${String(seq).padStart(4, '0')}`;

    let totalAllocated = 0;

    for (const alloc of validAllocs) {
      const allocAmt = Number(alloc.amount);
      if (allocAmt <= 0) continue;

      // Insert payment record
      await query(
        `INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date, payment_mode, receipt_no, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, alloc.order_id, allocAmt, paymentDate, paymentMode, receiptNo, notes || null]
      );

      totalAllocated += allocAmt;

      // Recalculate order total, amount_paid and status
      const rows = await query<any[]>(
        `SELECT
           COALESCE(SUM(i.quantity * i.rate_per_pc), 0) AS sub,
           o.discount, o.gst_percent, o.include_gst,
           (SELECT COALESCE(SUM(p.amount), 0) FROM sales_payments p WHERE p.order_id = o.id AND p.tenant_id = o.tenant_id) AS total_paid
         FROM sales_orders o
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE o.id=? AND o.tenant_id=?
         GROUP BY o.id`,
        [alloc.order_id, tenantId]
      );

      if (rows.length > 0) {
        const { sub, discount, gst_percent, include_gst, total_paid } = rows[0];
        const taxable = Math.max(0, Number(sub) - Number(discount || 0));
        const orderTotal = taxable * (1 + (include_gst ? Number(gst_percent) / 100 : 0));
        const newPaid = Math.min(Number(total_paid || 0), orderTotal);
        const newStatus = newPaid >= orderTotal && orderTotal > 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');
        const paidAt = newStatus === 'paid' ? 'NOW()' : 'NULL';

        await query(
          `UPDATE sales_orders SET amount_paid=?, status=?, paid_at=${paidAt === 'NULL' ? 'NULL' : 'NOW()'}
           WHERE id=? AND tenant_id=?`,
          [newPaid, newStatus, alloc.order_id, tenantId]
        );
      }
    }

    res.status(201).json({
      message: 'Payment receipt created successfully',
      receipt_no: receiptNo,
      total_amount: totalAllocated,
    });
  } catch (error) {
    console.error('recordMultiInvoicePayment error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function getReceiptDetails(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { receiptNo } = req.params;

  try {
    let payments: any[] = [];
    const cleanKey = String(receiptNo || '').trim();

    // 1. Direct match on receipt_no
    payments = await query<any[]>(
      `SELECT p.*, o.invoice_number, o.order_date, o.amount_paid AS order_amount_paid, o.status AS order_status,
              c.id AS client_id, c.name AS client_name, c.city AS client_city, c.phone AS client_phone, c.address AS client_address,
              ((GREATEST(0, (SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) FROM sales_order_items i WHERE i.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)) AS order_total
       FROM sales_payments p
       JOIN sales_orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id
       JOIN clients c ON c.id = o.client_id
       WHERE p.receipt_no = ? AND p.tenant_id = ?
       ORDER BY p.id ASC`,
      [cleanKey, tenantId]
    );

    // 2. If not found and cleanKey looks like an invoice number or RCP-<invoiceNumber>
    if (!payments.length) {
      const possibleInv = cleanKey.replace(/^RCP-/, '');
      payments = await query<any[]>(
        `SELECT p.*, o.invoice_number, o.order_date, o.amount_paid AS order_amount_paid, o.status AS order_status,
                c.id AS client_id, c.name AS client_name, c.city AS client_city, c.phone AS client_phone, c.address AS client_address,
                ((GREATEST(0, (SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) FROM sales_order_items i WHERE i.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)) AS order_total
         FROM sales_payments p
         JOIN sales_orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id
         JOIN clients c ON c.id = o.client_id
         WHERE (o.invoice_number = ? OR o.invoice_number = ?) AND p.tenant_id = ?
         ORDER BY p.id ASC`,
        [cleanKey, possibleInv, tenantId]
      );
    }

    // 3. If still not found and cleanKey is a numeric order ID
    if (!payments.length && /^\d+$/.test(cleanKey)) {
      const numId = Number(cleanKey);
      payments = await query<any[]>(
        `SELECT p.*, o.invoice_number, o.order_date, o.amount_paid AS order_amount_paid, o.status AS order_status,
                c.id AS client_id, c.name AS client_name, c.city AS client_city, c.phone AS client_phone, c.address AS client_address,
                ((GREATEST(0, (SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) FROM sales_order_items i WHERE i.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)) AS order_total
         FROM sales_payments p
         JOIN sales_orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id
         JOIN clients c ON c.id = o.client_id
         WHERE p.order_id = ? AND p.tenant_id = ?
         ORDER BY p.id ASC`,
        [numId, tenantId]
      );
    }

    // 4. If still no payments found, check if it's an existing sales_order (e.g. legacy order with amount_paid)
    if (!payments.length) {
      let orderRows: any[] = [];
      if (/^\d+$/.test(cleanKey)) {
        orderRows = await query<any[]>(
          `SELECT o.*, c.id AS client_id, c.name AS client_name, c.city AS client_city, c.phone AS client_phone, c.address AS client_address,
                  ((GREATEST(0, (SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) FROM sales_order_items i WHERE i.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)) AS order_total
           FROM sales_orders o
           JOIN clients c ON c.id = o.client_id
           WHERE o.id = ? AND o.tenant_id = ?`,
          [Number(cleanKey), tenantId]
        );
      } else {
        const possibleInv = cleanKey.replace(/^RCP-/, '');
        orderRows = await query<any[]>(
          `SELECT o.*, c.id AS client_id, c.name AS client_name, c.city AS client_city, c.phone AS client_phone, c.address AS client_address,
                  ((GREATEST(0, (SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) FROM sales_order_items i WHERE i.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)) AS order_total
           FROM sales_orders o
           JOIN clients c ON c.id = o.client_id
           WHERE (o.invoice_number = ? OR o.invoice_number = ?) AND o.tenant_id = ?`,
          [cleanKey, possibleInv, tenantId]
        );
      }

      if (!orderRows.length) {
        res.status(404).json({ message: 'Receipt not found' });
        return;
      }

      const ord = orderRows[0];
      const ordTotal = Number(ord.order_total || 0);
      const ordPaid = Number(ord.amount_paid || 0);

      // Other outstanding invoices for this client
      const otherOutstanding = await query<any[]>(
        `SELECT o.id, o.invoice_number, o.order_date, o.status, o.amount_paid,
                ((GREATEST(0, (SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) FROM sales_order_items i WHERE i.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)) AS total
         FROM sales_orders o
         WHERE o.tenant_id = ? AND o.client_id = ? AND o.id != ? AND o.status IN ('pending', 'partial')
         ORDER BY o.order_date ASC`,
        [tenantId, ord.client_id, ord.id]
      );

      const clientTotalOutstanding = otherOutstanding.reduce(
        (s, o) => s + Math.max(0, Number(o.total || 0) - Number(o.amount_paid || 0)),
        Math.max(0, ordTotal - ordPaid)
      );

      res.json({
        receipt_no: `RCP-${ord.invoice_number || ord.id}`,
        payment_date: ord.order_date,
        payment_mode: 'cash',
        notes: ord.notes || '',
        client: {
          id: ord.client_id,
          name: ord.client_name,
          city: ord.client_city,
          phone: ord.client_phone,
          address: ord.client_address,
        },
        total_amount: ordPaid,
        allocations: [{
          order_id: ord.id,
          invoice_number: ord.invoice_number,
          order_date: ord.order_date,
          amount_paid_in_receipt: ordPaid,
          order_total: ordTotal,
          order_amount_paid: ordPaid,
          balance_remaining: Math.max(0, ordTotal - ordPaid),
          status: ord.status,
        }],
        client_total_outstanding: clientTotalOutstanding,
        other_outstanding: otherOutstanding.map(o => ({
          ...o,
          total: Number(o.total || 0),
          amount_paid: Number(o.amount_paid || 0),
          balance: Math.max(0, Number(o.total || 0) - Number(o.amount_paid || 0)),
        })),
      });
      return;
    }

    const first = payments[0];
    const clientId = first.client_id;
    const totalReceived = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const coveredOrderIds = payments.map(p => p.order_id);

    // Other outstanding invoices for this client (excluding orders covered in this receipt)
    const otherOutstanding = await query<any[]>(
      `SELECT o.id, o.invoice_number, o.order_date, o.status, o.amount_paid,
              ((GREATEST(0, (SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) FROM sales_order_items i WHERE i.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)) AS total
       FROM sales_orders o
       WHERE o.tenant_id = ? AND o.client_id = ? AND o.status IN ('pending', 'partial')
         ${coveredOrderIds.length ? `AND o.id NOT IN (${coveredOrderIds.map(() => '?').join(',')})` : ''}
       ORDER BY o.order_date ASC`,
      [tenantId, clientId, ...coveredOrderIds]
    );

    const clientTotalOutstanding = otherOutstanding.reduce(
      (s, o) => s + Math.max(0, Number(o.total || 0) - Number(o.amount_paid || 0)),
      0
    ) + payments.reduce((s, p) => s + Math.max(0, Number(p.order_total || 0) - Number(p.order_amount_paid || 0)), 0);

    res.json({
      receipt_no: first.receipt_no || `RCP-${first.invoice_number || first.id}`,
      payment_date: first.payment_date,
      payment_mode: first.payment_mode || 'cash',
      notes: first.notes || '',
      client: {
        id: first.client_id,
        name: first.client_name,
        city: first.client_city,
        phone: first.client_phone,
        address: first.client_address,
      },
      total_amount: totalReceived,
      allocations: payments.map(p => {
        const orderTotal = Number(p.order_total || 0);
        const orderPaid = Number(p.order_amount_paid || 0);
        return {
          payment_id: p.id,
          order_id: p.order_id,
          invoice_number: p.invoice_number,
          order_date: p.order_date,
          amount_paid_in_receipt: Number(p.amount || 0),
          order_total: orderTotal,
          order_amount_paid: orderPaid,
          balance_remaining: Math.max(0, orderTotal - orderPaid),
          status: p.order_status,
        };
      }),
      client_total_outstanding: clientTotalOutstanding,
      other_outstanding: otherOutstanding.map(o => ({
        ...o,
        total: Number(o.total || 0),
        amount_paid: Number(o.amount_paid || 0),
        balance: Math.max(0, Number(o.total || 0) - Number(o.amount_paid || 0)),
      })),
    });
  } catch (error) {
    console.error('getReceiptDetails error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function getSalesPayments(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { client_id, from, to, payment_mode, search, page: pageStr, limit: limitStr } = req.query as Record<string, string>;

  const page = Math.max(1, parseInt(pageStr) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr) || 50));
  const offset = (page - 1) * limit;

  try {
    const conds: string[] = ['p.tenant_id = ?'];
    const vals: any[] = [tenantId];

    if (client_id && client_id !== 'all') {
      conds.push('o.client_id = ?');
      vals.push(Number(client_id));
    }

    if (payment_mode && payment_mode !== 'all') {
      conds.push('p.payment_mode = ?');
      vals.push(payment_mode);
    }

    if (from) {
      conds.push('p.payment_date >= ?');
      vals.push(from);
    }

    if (to) {
      conds.push('p.payment_date <= ?');
      vals.push(to);
    }

    if (search && search.trim()) {
      conds.push('(o.invoice_number LIKE ? OR c.name LIKE ? OR c.city LIKE ? OR p.receipt_no LIKE ?)');
      const q = `%${search.trim()}%`;
      vals.push(q, q, q, q);
    }

    const whereClause = conds.join(' AND ');

    // Summary calculation across all matching rows
    const summaryRows = await query<any[]>(
      `SELECT
         COALESCE(SUM(p.amount), 0) AS total_collected,
         COALESCE(SUM(CASE WHEN p.payment_mode = 'cash' THEN p.amount ELSE 0 END), 0) AS cash_collected,
         COALESCE(SUM(CASE WHEN p.payment_mode = 'upi' THEN p.amount ELSE 0 END), 0) AS upi_collected,
         COALESCE(SUM(CASE WHEN p.payment_mode = 'bank_transfer' THEN p.amount ELSE 0 END), 0) AS bank_collected,
         COALESCE(SUM(CASE WHEN p.payment_mode = 'cheque' THEN p.amount ELSE 0 END), 0) AS cheque_collected,
         COUNT(DISTINCT COALESCE(p.receipt_no, CONCAT('ID-', p.id))) AS total_count
       FROM sales_payments p
       JOIN sales_orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id
       JOIN clients c ON c.id = o.client_id
       WHERE ${whereClause}`,
      vals
    );

    const summary = summaryRows[0] || {
      total_collected: 0,
      cash_collected: 0,
      upi_collected: 0,
      bank_collected: 0,
      cheque_collected: 0,
      total_count: 0,
    };

    const total = Number(summary.total_count || 0);

    // Fetch raw payment entries matching filters
    const rawPayments = await query<any[]>(
      `SELECT 
         p.id, p.tenant_id, p.order_id, p.amount, p.payment_date, p.payment_mode, p.receipt_no, p.notes, p.created_at,
         o.invoice_number, o.order_date, o.amount_paid AS order_amount_paid, o.status AS order_status,
         c.id AS client_id, c.name AS client_name, c.city AS client_city, c.phone AS client_phone,
         ((GREATEST(0, (SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) FROM sales_order_items i WHERE i.order_id = o.id) - o.discount)) * (1 + o.gst_percent / 100)) AS order_total
       FROM sales_payments p
       JOIN sales_orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id
       JOIN clients c ON c.id = o.client_id
       WHERE ${whereClause}
       ORDER BY p.payment_date DESC, p.id DESC`,
      vals
    );

    // Group raw payments by receipt_no (or by id if receipt_no is null)
    const groupedMap = new Map<string, any>();
    for (const p of rawPayments) {
      const key = p.receipt_no || `RCP-${p.invoice_number || p.id}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          receipt_key: key,
          receipt_no: p.receipt_no || key,
          payment_date: p.payment_date,
          payment_mode: p.payment_mode || 'cash',
          notes: p.notes || '',
          client_id: p.client_id,
          client_name: p.client_name,
          client_city: p.client_city,
          client_phone: p.client_phone,
          total_amount: 0,
          invoices: [],
        });
      }
      const group = groupedMap.get(key);
      const amt = Number(p.amount || 0);
      group.total_amount += amt;
      group.invoices.push({
        payment_id: p.id,
        order_id: p.order_id,
        invoice_number: p.invoice_number,
        order_date: p.order_date,
        amount: amt,
        order_total: Number(p.order_total || 0),
        order_amount_paid: Number(p.order_amount_paid || 0),
        order_status: p.order_status,
      });
    }

    const groupedList = Array.from(groupedMap.values());
    const paginatedList = groupedList.slice(offset, offset + limit);

    res.json({
      data: paginatedList,
      summary,
      total: groupedList.length,
      page,
      pages: Math.max(1, Math.ceil(groupedList.length / limit)),
      limit
    });
  } catch (error) {
    console.error('getSalesPayments error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deletePayment(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { paymentId } = req.params;

  try {
    // Find all payment rows matching receipt_no OR id
    let paymentRows: any[] = [];
    if (paymentId.startsWith('RCP-')) {
      paymentRows = await query<any[]>(
        'SELECT * FROM sales_payments WHERE receipt_no=? AND tenant_id=?',
        [paymentId, tenantId]
      );
    }
    if (!paymentRows.length) {
      paymentRows = await query<any[]>(
        'SELECT * FROM sales_payments WHERE (id=? OR receipt_no=?) AND tenant_id=?',
        [paymentId, paymentId, tenantId]
      );
    }

    if (!paymentRows.length) {
      res.status(404).json({ message: 'Payment receipt not found' });
      return;
    }

    const affectedOrderIds = Array.from(new Set(paymentRows.map(p => p.order_id)));

    // Delete matching payments
    const paymentIds = paymentRows.map(p => p.id);
    await query(
      `DELETE FROM sales_payments WHERE id IN (${paymentIds.map(() => '?').join(',')}) AND tenant_id=?`,
      [...paymentIds, tenantId]
    );

    // Recalculate amount_paid and status for all affected orders
    for (const orderId of affectedOrderIds) {
      const remainingRows = await query<any[]>(
        'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM sales_payments WHERE order_id=? AND tenant_id=?',
        [orderId, tenantId]
      );
      const newPaid = Number(remainingRows[0]?.total_paid || 0);

      const orderTotals = await query<any[]>(
        `SELECT (GREATEST(0, COALESCE(SUM(i.quantity * i.rate_per_pc), 0) - o.discount)) * (1 + o.gst_percent / 100) AS total
         FROM sales_orders o
         LEFT JOIN sales_order_items i ON i.order_id = o.id
         WHERE o.id=? AND o.tenant_id=?
         GROUP BY o.id`,
        [orderId, tenantId]
      );
      const orderTotal = Number(orderTotals[0]?.total || 0);
      const newStatus = newPaid >= orderTotal && orderTotal > 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');
      const paidAt = newStatus === 'paid' ? 'NOW()' : 'NULL';

      await query(
        `UPDATE sales_orders SET amount_paid=?, status=?, paid_at=${paidAt === 'NULL' ? 'NULL' : 'NOW()'} WHERE id=? AND tenant_id=?`,
        [newPaid, newStatus, orderId, tenantId]
      );
    }

    res.json({ message: 'Receipt deleted successfully and invoice balances recalculated' });
  } catch (error) {
    console.error('deletePayment error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}
