import { Response } from 'express';
import { query } from '../config/db';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';

/**
 * Auto-generate next Delivery Note Number: DN-YYYY-0001
 */
async function generateNextDeliveryNoteNumber(tenantId: number, dateStr: string): Promise<string> {
  const year = new Date(dateStr || Date.now()).getFullYear();
  const rows = await query<any[]>(
    `SELECT delivery_note_number 
     FROM delivery_notes 
     WHERE tenant_id = ? AND delivery_note_number LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [tenantId, `DN-${year}-%`]
  );

  let nextSeq = 1;
  if (rows && rows.length > 0) {
    const lastNum = rows[0].delivery_note_number;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `DN-${year}-${String(nextSeq).padStart(4, '0')}`;
}

export async function getDeliveryNotes(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const search = (req.query.search as string || '').trim();
  const status = (req.query.status as string || '').trim();
  const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;
  const orderId = req.query.order_id ? parseInt(req.query.order_id as string) : null;
  const from = (req.query.from as string || '').trim();
  const to = (req.query.to as string || '').trim();

  try {
    const conditions: string[] = ['dn.tenant_id = ?'];
    const params: any[] = [tenantId];

    if (search) {
      conditions.push('(dn.delivery_note_number LIKE ? OR c.name LIKE ? OR dn.transporter_name LIKE ? OR dn.vehicle_number LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') {
      conditions.push('dn.status = ?');
      params.push(status);
    }
    if (clientId) {
      conditions.push('dn.client_id = ?');
      params.push(clientId);
    }
    if (orderId) {
      conditions.push('dn.order_id = ?');
      params.push(orderId);
    }
    if (from) {
      conditions.push('dn.delivery_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('dn.delivery_date <= ?');
      params.push(to);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows, notes] = await Promise.all([
      query<any[]>(
        `SELECT COUNT(*) AS total 
         FROM delivery_notes dn 
         JOIN clients c ON c.id = dn.client_id 
         WHERE ${whereClause}`,
        params
      ),
      query<any[]>(
        `SELECT dn.*, c.name AS client_name, c.phone AS client_phone, c.city AS client_city,
                o.invoice_number AS order_invoice_number,
                COALESCE((SELECT SUM(dni.quantity) FROM delivery_note_items dni WHERE dni.delivery_note_id = dn.id), 0) AS total_items_count
         FROM delivery_notes dn
         JOIN clients c ON c.id = dn.client_id
         LEFT JOIN sales_orders o ON o.id = dn.order_id
         WHERE ${whereClause}
         ORDER BY dn.delivery_date DESC, dn.id DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    const total = countRows[0]?.total || 0;
    res.json({
      data: notes,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit
    });
  } catch (error) {
    console.error('getDeliveryNotes Error:', error);
    res.status(500).json({ message: 'Failed to load delivery notes', error: String(error) });
  }
}

export async function getDeliveryNoteDetail(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    const [notes, items] = await Promise.all([
      query<any[]>(
        `SELECT dn.*, c.name AS client_name, c.phone AS client_phone, c.city AS client_city,
                c.address AS client_address, o.invoice_number AS order_invoice_number
         FROM delivery_notes dn
         JOIN clients c ON c.id = dn.client_id
         LEFT JOIN sales_orders o ON o.id = dn.order_id
         WHERE dn.id = ? AND dn.tenant_id = ? LIMIT 1`,
        [id, tenantId]
      ),
      query<any[]>(
        `SELECT * FROM delivery_note_items WHERE delivery_note_id = ? AND tenant_id = ? ORDER BY id ASC`,
        [id, tenantId]
      )
    ]);

    if (!notes || notes.length === 0) {
      res.status(404).json({ message: 'Delivery note not found' });
      return;
    }

    res.json({
      delivery_note: notes[0],
      items: items || []
    });
  } catch (error) {
    console.error('getDeliveryNoteDetail Error:', error);
    res.status(500).json({ message: 'Failed to load delivery note details', error: String(error) });
  }
}

export async function createDeliveryNote(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const {
    client_id, order_id, delivery_date, status = 'dispatched',
    shipping_address, transporter_name, vehicle_number,
    tracking_lr_number, notes, items
  } = req.body;

  if (!client_id) {
    res.status(400).json({ message: 'Client is required.' });
    return;
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'At least one dispatched item is required.' });
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const dateVal = delivery_date || new Date().toISOString().slice(0, 10);
    const dnNumber = await generateNextDeliveryNoteNumber(tenantId, dateVal);

    let totalPieces = 0;
    const processedItems = [];

    for (const it of items) {
      const qty = parseInt(it.quantity) || 1;
      totalPieces += qty;
      processedItems.push({
        category: it.category || 'general_item',
        description: it.description || null,
        uom: it.uom || 'pcs',
        quantity: qty,
        remarks: it.remarks || null
      });
    }

    const [dnRes] = await conn.execute(
      `INSERT INTO delivery_notes (
        tenant_id, client_id, order_id, delivery_note_number, delivery_date,
        status, shipping_address, transporter_name, vehicle_number,
        tracking_lr_number, total_pieces, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, client_id, order_id || null, dnNumber, dateVal,
        status, shipping_address || null, transporter_name || null, vehicle_number || null,
        tracking_lr_number || null, totalPieces, notes || null
      ]
    );

    const dnId = (dnRes as any).insertId;

    for (const it of processedItems) {
      await conn.execute(
        `INSERT INTO delivery_note_items (
          delivery_note_id, tenant_id, category, description, uom, quantity, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          dnId, tenantId, it.category, it.description, it.uom,
          it.quantity, it.remarks
        ]
      );
    }

    await conn.commit();
    res.status(201).json({ id: dnId, delivery_note_number: dnNumber, message: 'Delivery note created successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('createDeliveryNote Error:', error);
    res.status(500).json({ message: 'Failed to create delivery note', error: String(error) });
  } finally {
    conn.release();
  }
}

/**
 * 1-Click Generate Delivery Note directly from an existing Sales Order
 */
export async function createFromSalesOrder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { orderId } = req.params;
  const { transporter_name, vehicle_number, tracking_lr_number, shipping_address, notes } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.execute<any[]>(
      `SELECT o.*, c.address AS client_address
       FROM sales_orders o 
       JOIN clients c ON c.id = o.client_id 
       WHERE o.id = ? AND o.tenant_id = ? LIMIT 1`,
      [orderId, tenantId]
    );

    if (!orders || orders.length === 0) {
      res.status(404).json({ message: 'Sales order not found' });
      conn.release();
      return;
    }

    const order = orders[0];
    const [items] = await conn.execute<any[]>(
      'SELECT * FROM sales_order_items WHERE order_id = ? AND tenant_id = ?',
      [orderId, tenantId]
    );

    const today = new Date().toISOString().slice(0, 10);
    const dnNumber = await generateNextDeliveryNoteNumber(tenantId, today);

    let totalPieces = 0;
    for (const it of (items || [])) {
      totalPieces += (parseInt(it.quantity) || 0);
    }

    const [dnRes] = await conn.execute(
      `INSERT INTO delivery_notes (
        tenant_id, client_id, order_id, delivery_note_number, delivery_date,
        status, shipping_address, transporter_name, vehicle_number,
        tracking_lr_number, total_pieces, notes
      ) VALUES (?, ?, ?, ?, ?, 'dispatched', ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, order.client_id, orderId, dnNumber, today,
        shipping_address || order.client_address || null,
        transporter_name || null,
        vehicle_number || null,
        tracking_lr_number || null,
        totalPieces,
        notes || `Delivery for Invoice #${order.invoice_number}`
      ]
    );

    const dnId = (dnRes as any).insertId;

    for (const it of (items || [])) {
      await conn.execute(
        `INSERT INTO delivery_note_items (
          delivery_note_id, tenant_id, category, description, uom, quantity, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          dnId, tenantId, it.category, null, it.uom || 'pcs',
          it.quantity, `Invoice #${order.invoice_number}`
        ]
      );
    }

    await conn.commit();
    res.status(201).json({
      id: dnId,
      delivery_note_number: dnNumber,
      message: `Delivery Note #${dnNumber} generated from Order #${order.invoice_number}`
    });
  } catch (error) {
    await conn.rollback();
    console.error('createFromSalesOrder Error:', error);
    res.status(500).json({ message: 'Failed to generate delivery note from order', error: String(error) });
  } finally {
    conn.release();
  }
}

export async function updateDeliveryNote(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const {
    client_id, delivery_date, status, shipping_address,
    transporter_name, vehicle_number, tracking_lr_number,
    notes, items, received_by
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let totalPieces = 0;
    const processedItems = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const qty = parseInt(it.quantity) || 1;
        totalPieces += qty;
        processedItems.push({
          category: it.category || 'general_item',
          description: it.description || null,
          uom: it.uom || 'pcs',
          quantity: qty,
          remarks: it.remarks || null
        });
      }
    }

    const receivedAt = status === 'delivered' ? new Date() : null;

    await conn.execute(
      `UPDATE delivery_notes SET
        client_id = COALESCE(?, client_id),
        delivery_date = COALESCE(?, delivery_date),
        status = COALESCE(?, status),
        shipping_address = ?,
        transporter_name = ?,
        vehicle_number = ?,
        tracking_lr_number = ?,
        total_pieces = ?,
        notes = ?,
        received_by = ?,
        received_at = COALESCE(?, received_at)
      WHERE id = ? AND tenant_id = ?`,
      [
        client_id || null, delivery_date || null, status || null,
        shipping_address || null, transporter_name || null, vehicle_number || null,
        tracking_lr_number || null, totalPieces, notes || null,
        received_by || null, receivedAt, id, tenantId
      ]
    );

    if (processedItems.length > 0) {
      await conn.execute('DELETE FROM delivery_note_items WHERE delivery_note_id = ? AND tenant_id = ?', [id, tenantId]);
      for (const it of processedItems) {
        await conn.execute(
          `INSERT INTO delivery_note_items (
            delivery_note_id, tenant_id, category, description, uom, quantity, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id, tenantId, it.category, it.description, it.uom,
            it.quantity, it.remarks
          ]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Delivery note updated successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('updateDeliveryNote Error:', error);
    res.status(500).json({ message: 'Failed to update delivery note', error: String(error) });
  } finally {
    conn.release();
  }
}

export async function updateDeliveryStatus(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { status, received_by } = req.body;

  try {
    const receivedAt = status === 'delivered' ? 'NOW()' : 'NULL';
    await query(
      `UPDATE delivery_notes 
       SET status = ?, received_by = ?, received_at = ${receivedAt}
       WHERE id = ? AND tenant_id = ?`,
      [status, received_by || null, id, tenantId]
    );
    res.json({ message: `Delivery status updated to ${status}` });
  } catch (error) {
    console.error('updateDeliveryStatus Error:', error);
    res.status(500).json({ message: 'Failed to update delivery status', error: String(error) });
  }
}

export async function deleteDeliveryNote(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    await query('DELETE FROM delivery_note_items WHERE delivery_note_id = ? AND tenant_id = ?', [id, tenantId]);
    await query('DELETE FROM delivery_notes WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ message: 'Delivery note deleted successfully' });
  } catch (error) {
    console.error('deleteDeliveryNote Error:', error);
    res.status(500).json({ message: 'Failed to delete delivery note', error: String(error) });
  }
}
