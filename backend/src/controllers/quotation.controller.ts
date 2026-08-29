import { Response } from 'express';
import { query } from '../config/db';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';

/**
 * Auto-generate next Quotation Number: QTN-YYYY-0001
 */
async function generateNextQuotationNumber(tenantId: number, dateStr: string): Promise<string> {
  const year = new Date(dateStr || Date.now()).getFullYear();
  const rows = await query<any[]>(
    `SELECT quotation_number 
     FROM quotations 
     WHERE tenant_id = ? AND quotation_number LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [tenantId, `QTN-${year}-%`]
  );

  let nextSeq = 1;
  if (rows && rows.length > 0) {
    const lastNum = rows[0].quotation_number;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `QTN-${year}-${String(nextSeq).padStart(4, '0')}`;
}

export async function getQuotations(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const search = (req.query.search as string || '').trim();
  const status = (req.query.status as string || '').trim();
  const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;
  const from = (req.query.from as string || '').trim();
  const to = (req.query.to as string || '').trim();

  try {
    const conditions: string[] = ['q.tenant_id = ?'];
    const params: any[] = [tenantId];

    if (search) {
      conditions.push('(q.quotation_number LIKE ? OR c.name LIKE ? OR q.notes LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') {
      conditions.push('q.status = ?');
      params.push(status);
    }
    if (clientId) {
      conditions.push('q.client_id = ?');
      params.push(clientId);
    }
    if (from) {
      conditions.push('q.quote_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('q.quote_date <= ?');
      params.push(to);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows, quotations] = await Promise.all([
      query<any[]>(
        `SELECT COUNT(*) AS total 
         FROM quotations q 
         JOIN clients c ON c.id = q.client_id 
         WHERE ${whereClause}`,
        params
      ),
      query<any[]>(
        `SELECT q.*, c.name AS client_name, c.phone AS client_phone, c.city AS client_city,
                COALESCE((SELECT SUM(qi.quantity) FROM quotation_items qi WHERE qi.quotation_id = q.id), 0) AS total_quantity,
                COALESCE((SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id), 0) AS items_count
         FROM quotations q
         JOIN clients c ON c.id = q.client_id
         WHERE ${whereClause}
         ORDER BY q.quote_date DESC, q.id DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    const total = countRows[0]?.total || 0;
    res.json({
      data: quotations,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit
    });
  } catch (error) {
    console.error('getQuotations Error:', error);
    res.status(500).json({ message: 'Failed to load quotations', error: String(error) });
  }
}

export async function getQuotationDetail(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    const [quotes, items] = await Promise.all([
      query<any[]>(
        `SELECT q.*, c.name AS client_name, c.phone AS client_phone, c.city AS client_city, 
                c.address AS client_address, c.vat_number AS client_vat
         FROM quotations q
         JOIN clients c ON c.id = q.client_id
         WHERE q.id = ? AND q.tenant_id = ? LIMIT 1`,
        [id, tenantId]
      ),
      query<any[]>(
        `SELECT * FROM quotation_items WHERE quotation_id = ? AND tenant_id = ? ORDER BY id ASC`,
        [id, tenantId]
      )
    ]);

    if (!quotes || quotes.length === 0) {
      res.status(404).json({ message: 'Quotation not found' });
      return;
    }

    res.json({
      quotation: quotes[0],
      items: items || []
    });
  } catch (error) {
    console.error('getQuotationDetail Error:', error);
    res.status(500).json({ message: 'Failed to load quotation details', error: String(error) });
  }
}

export async function createQuotation(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const {
    client_id, quote_date, expiry_date, items,
    discount_percent = 0, discount = 0, gst_percent = 0,
    notes, terms_conditions, status = 'draft'
  } = req.body;

  if (!client_id) {
    res.status(400).json({ message: 'Client is required.' });
    return;
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'At least one line item is required.' });
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const dateVal = quote_date || new Date().toISOString().slice(0, 10);
    const quotationNumber = await generateNextQuotationNumber(tenantId, dateVal);

    // Calculate line items and totals
    let subtotal = 0;
    const processedItems = [];

    for (const it of items) {
      const qty = parseInt(it.quantity) || 1;
      const rate = parseFloat(it.rate_per_pc ?? it.price_per_piece) || 0;
      const amount = parseFloat((qty * rate).toFixed(2));
      subtotal += amount;

      processedItems.push({
        category: it.category || 'general_item',
        description: it.description || null,
        uom: it.uom || 'pcs',
        quantity: qty,
        rate_per_pc: rate,
        amount
      });
    }

    const discPct = parseFloat(discount_percent) || 0;
    let discAmt = parseFloat(discount) || 0;
    if (discPct > 0 && discAmt === 0) {
      discAmt = parseFloat(((subtotal * discPct) / 100).toFixed(2));
    }

    const afterDiscount = Math.max(0, subtotal - discAmt);
    const taxRate = parseFloat(gst_percent) || 0;
    const taxAmount = parseFloat(((afterDiscount * taxRate) / 100).toFixed(2));
    const total = parseFloat((afterDiscount + taxAmount).toFixed(2));

    const [qRes] = await conn.execute(
      `INSERT INTO quotations (
        tenant_id, client_id, quotation_number, quote_date, expiry_date,
        status, subtotal, discount_percent, discount, gst_percent, gst_amount,
        total, notes, terms_conditions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, client_id, quotationNumber, dateVal, expiry_date || null,
        status, subtotal, discPct, discAmt, taxRate, taxAmount,
        total, notes || null, terms_conditions || null
      ]
    );

    const quotationId = (qRes as any).insertId;

    for (const it of processedItems) {
      await conn.execute(
        `INSERT INTO quotation_items (
          quotation_id, tenant_id, category, description, uom, quantity, rate_per_pc, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quotationId, tenantId, it.category, it.description, it.uom,
          it.quantity, it.rate_per_pc, it.amount
        ]
      );
    }

    await conn.commit();
    res.status(201).json({ id: quotationId, quotation_number: quotationNumber, message: 'Quotation created successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('createQuotation Error:', error);
    res.status(500).json({ message: 'Failed to create quotation', error: String(error) });
  } finally {
    conn.release();
  }
}

export async function updateQuotation(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const {
    client_id, quote_date, expiry_date, items,
    discount_percent = 0, discount = 0, gst_percent = 0,
    notes, terms_conditions, status
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.execute<any[]>(
      'SELECT id, quotation_number FROM quotations WHERE id = ? AND tenant_id = ? LIMIT 1',
      [id, tenantId]
    );

    if (!existing || existing.length === 0) {
      res.status(404).json({ message: 'Quotation not found' });
      conn.release();
      return;
    }

    let subtotal = 0;
    const processedItems = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const qty = parseInt(it.quantity) || 1;
        const rate = parseFloat(it.rate_per_pc ?? it.price_per_piece) || 0;
        const amount = parseFloat((qty * rate).toFixed(2));
        subtotal += amount;

        processedItems.push({
          category: it.category || 'general_item',
          description: it.description || null,
          uom: it.uom || 'pcs',
          quantity: qty,
          rate_per_pc: rate,
          amount
        });
      }
    }

    const discPct = parseFloat(discount_percent) || 0;
    let discAmt = parseFloat(discount) || 0;
    if (discPct > 0 && discAmt === 0) {
      discAmt = parseFloat(((subtotal * discPct) / 100).toFixed(2));
    }

    const afterDiscount = Math.max(0, subtotal - discAmt);
    const taxRate = parseFloat(gst_percent) || 0;
    const taxAmount = parseFloat(((afterDiscount * taxRate) / 100).toFixed(2));
    const total = parseFloat((afterDiscount + taxAmount).toFixed(2));

    await conn.execute(
      `UPDATE quotations SET
        client_id = COALESCE(?, client_id),
        quote_date = COALESCE(?, quote_date),
        expiry_date = ?,
        status = COALESCE(?, status),
        subtotal = ?,
        discount_percent = ?,
        discount = ?,
        gst_percent = ?,
        gst_amount = ?,
        total = ?,
        notes = ?,
        terms_conditions = ?
      WHERE id = ? AND tenant_id = ?`,
      [
        client_id || null, quote_date || null, expiry_date || null,
        status || null, subtotal, discPct, discAmt, taxRate, taxAmount,
        total, notes || null, terms_conditions || null,
        id, tenantId
      ]
    );

    if (processedItems.length > 0) {
      await conn.execute('DELETE FROM quotation_items WHERE quotation_id = ? AND tenant_id = ?', [id, tenantId]);
      for (const it of processedItems) {
        await conn.execute(
          `INSERT INTO quotation_items (
            quotation_id, tenant_id, category, description, uom, quantity, rate_per_pc, amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, tenantId, it.category, it.description, it.uom,
            it.quantity, it.rate_per_pc, it.amount
          ]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Quotation updated successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('updateQuotation Error:', error);
    res.status(500).json({ message: 'Failed to update quotation', error: String(error) });
  } finally {
    conn.release();
  }
}

export async function deleteQuotation(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    await query('DELETE FROM quotation_items WHERE quotation_id = ? AND tenant_id = ?', [id, tenantId]);
    await query('DELETE FROM quotations WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    console.error('deleteQuotation Error:', error);
    res.status(500).json({ message: 'Failed to delete quotation', error: String(error) });
  }
}

/**
 * 1-Click Convert Quotation to Confirmed Sales Order / Invoice
 */
export async function convertToSalesOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [quotes] = await conn.execute<any[]>(
      'SELECT * FROM quotations WHERE id = ? AND tenant_id = ? LIMIT 1',
      [id, tenantId]
    );

    if (!quotes || quotes.length === 0) {
      res.status(404).json({ message: 'Quotation not found' });
      conn.release();
      return;
    }

    const quote = quotes[0];
    if (quote.converted_order_id) {
      res.status(400).json({ message: `This quotation is already converted to Order #${quote.converted_order_id}` });
      conn.release();
      return;
    }

    const [items] = await conn.execute<any[]>(
      'SELECT * FROM quotation_items WHERE quotation_id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    const year = new Date().getFullYear();
    const [invRows] = await conn.execute<any[]>(
      'SELECT invoice_number FROM sales_orders WHERE tenant_id = ? AND YEAR(order_date) = ? ORDER BY id DESC LIMIT 1',
      [tenantId, year]
    );

    let nextSeq = 1;
    if (invRows && invRows.length > 0) {
      const last = invRows[0].invoice_number;
      const parts = last.split('-');
      const numVal = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numVal)) nextSeq = numVal + 1;
    }
    const invoiceNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
    const today = new Date().toISOString().slice(0, 10);

    const [orderRes] = await conn.execute(
      `INSERT INTO sales_orders (
        tenant_id, client_id, invoice_number, order_date, notes,
        include_gst, gst_percent, discount_percent, discount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')`,
      [
        tenantId, quote.client_id, invoiceNumber, today,
        `Converted from Quote #${quote.quotation_number}. ${quote.notes || ''}`.trim(),
        Number(quote.gst_percent) > 0 ? 1 : 0,
        quote.gst_percent || 0,
        quote.discount_percent || 0,
        quote.discount || 0
      ]
    );

    const orderId = (orderRes as any).insertId;

    for (const it of (items || [])) {
      await conn.execute(
        `INSERT INTO sales_order_items (
          tenant_id, order_id, category, quantity, rate_per_pc, uom
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          tenantId, orderId, it.category, it.quantity, it.rate_per_pc, it.uom || 'pcs'
        ]
      );
    }

    // Mark quotation as converted
    await conn.execute(
      `UPDATE quotations SET status = 'converted', converted_order_id = ? WHERE id = ? AND tenant_id = ?`,
      [orderId, id, tenantId]
    );

    await conn.commit();
    res.json({
      message: `Quotation converted successfully to Sales Order #${invoiceNumber}`,
      order_id: orderId,
      invoice_number: invoiceNumber
    });
  } catch (error) {
    await conn.rollback();
    console.error('convertToSalesOrder Error:', error);
    res.status(500).json({ message: 'Failed to convert quotation to order', error: String(error) });
  } finally {
    conn.release();
  }
}
