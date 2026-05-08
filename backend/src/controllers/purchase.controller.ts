import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/db';

export async function getVendors(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query('SELECT * FROM vendors WHERE tenant_id = ? ORDER BY name', [tenantId]);
    res.json(rows);
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function createVendor(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { name, phone } = req.body;
  try {
    const r = await query<any>(
      'INSERT INTO vendors (tenant_id,name,phone) VALUES (?,?,?)',
      [tenantId, name, phone || null]
    );
    res.status(201).json({ id: r.insertId, name, phone });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function getPurchases(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
  const search = (req.query.search as string || '').trim();
  const offset = (page - 1) * limit;

  const vendorFilter = search ? `AND v.name LIKE ?` : '';
  const params: any[] = search ? [tenantId, `%${search}%`] : [tenantId];

  try {
    const [countRows, purchases] = await Promise.all([
      query<any[]>(
        `SELECT COUNT(*) AS total FROM purchases p JOIN vendors v ON v.id = p.vendor_id WHERE p.tenant_id = ? ${vendorFilter}`,
        params
      ),
      query(
        `SELECT p.*, v.name AS vendor_name,
                COALESCE((SELECT SUM(pi.quantity) FROM purchase_items pi WHERE pi.purchase_id = p.id), 0) AS total_pieces,
                EXISTS(SELECT 1 FROM purchase_disputes pd WHERE pd.purchase_id = p.id AND pd.status = 'pending') AS has_dispute,
                COALESCE((SELECT SUM(pd2.amount) FROM purchase_disputes pd2 WHERE pd2.purchase_id = p.id AND pd2.status = 'pending'), 0) AS dispute_amount,
                COALESCE((SELECT pt.freight FROM purchase_transport pt WHERE pt.purchase_id = p.id), 0) AS freight,
                COALESCE((SELECT pt.coolie  FROM purchase_transport pt WHERE pt.purchase_id = p.id), 0) AS coolie,
                ROUND(CASE WHEN p.subtotal > 0 THEN p.discount / p.subtotal * 100 ELSE 0 END, 2) AS discount_pct
         FROM purchases p
         JOIN vendors v ON v.id = p.vendor_id
         WHERE p.tenant_id = ? ${vendorFilter}
         ORDER BY p.invoice_date DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
    ]);
    const total = (countRows as any[])[0]?.total || 0;
    res.json({ data: purchases, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function getPurchaseDetail(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    const [purchases, items, transport, disputes] = await Promise.all([
      query(
        `SELECT p.*, v.name AS vendor_name,
                ROUND(CASE WHEN p.subtotal > 0 THEN p.discount / p.subtotal * 100 ELSE 0 END, 2) AS discount_pct
         FROM purchases p JOIN vendors v ON v.id = p.vendor_id WHERE p.id = ? AND p.tenant_id = ?`,
        [id, tenantId]
      ) as Promise<any[]>,
      query('SELECT * FROM purchase_items WHERE purchase_id = ?', [id]) as Promise<any[]>,
      query('SELECT * FROM purchase_transport WHERE purchase_id = ?', [id]) as Promise<any[]>,
      query('SELECT * FROM purchase_disputes WHERE purchase_id = ?', [id]) as Promise<any[]>,
    ]);
    if (!(purchases as any[]).length) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ purchase: (purchases as any[])[0], items, transport: (transport as any[])[0] || null, disputes });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function createPurchase(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { vendor_id, invoice_date, items, tax_rate, discount, status, note, transport, dispute } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const subtotal: number = items.reduce((s: number, i: any) => s + i.quantity * i.rate_per_pc, 0);
    const discountPct = parseFloat(discount) || 0;
    const discountAmt = parseFloat(((subtotal * discountPct) / 100).toFixed(2));
    const taxRate = parseFloat(tax_rate) || 0;
    const taxAmount = parseFloat((((subtotal - discountAmt) * taxRate) / 100).toFixed(2));
    const total = subtotal - discountAmt + taxAmount;

    const [pRes] = await conn.execute(
      'INSERT INTO purchases (tenant_id,vendor_id,invoice_date,subtotal,discount,tax_rate,tax_amount,total,status,note) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [tenantId, vendor_id, invoice_date, subtotal, discountAmt, taxRate, taxAmount, total, status || 'paid', note || null]
    );
    const purchaseId = (pRes as any).insertId;

    for (const item of items) {
      const amount = item.quantity * item.rate_per_pc;
      await conn.execute(
        'INSERT INTO purchase_items (purchase_id,category,quantity,rate_per_pc,amount) VALUES (?,?,?,?,?)',
        [purchaseId, item.category, item.quantity, item.rate_per_pc, amount]
      );
      // record stock movement
      await conn.execute(
        'INSERT INTO stock_movements (tenant_id,category,vendor_id,type,quantity,reference,movement_date) VALUES (?,?,?,?,?,?,?)',
        [tenantId, item.category, vendor_id, 'in', item.quantity, `PUR-${purchaseId}`, invoice_date]
      );
    }

    if (transport) {
      await conn.execute(
        'INSERT INTO purchase_transport (purchase_id,freight,coolie) VALUES (?,?,?)',
        [purchaseId, transport.freight || 0, transport.coolie || 0]
      );
    }

    if (dispute) {
      await conn.execute(
        'INSERT INTO purchase_disputes (purchase_id,amount,description,status) VALUES (?,?,?,?)',
        [purchaseId, dispute.amount, dispute.description || null, 'pending']
      );
    }

    await conn.commit();
    res.status(201).json({ id: purchaseId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
}

export async function updatePurchase(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { vendor_id, invoice_date, tax_rate, discount, note, freight, coolie } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Recalculate totals based on existing items + new tax/discount
    const [itemRows] = await conn.execute(
      'SELECT SUM(amount) AS subtotal FROM purchase_items WHERE purchase_id = ?', [id]
    ) as any[];
    const subtotal    = Number((itemRows as any[])[0]?.subtotal || 0);
    const discountPct = parseFloat(discount) || 0;
    const discountAmt = parseFloat(((subtotal * discountPct) / 100).toFixed(2));
    const taxRate     = parseFloat(tax_rate) || 0;
    const taxAmount   = parseFloat((((subtotal - discountAmt) * taxRate) / 100).toFixed(2));
    const total       = subtotal - discountAmt + taxAmount;

    await conn.execute(
      'UPDATE purchases SET vendor_id=?, invoice_date=?, discount=?, tax_rate=?, tax_amount=?, total=?, note=? WHERE id=? AND tenant_id=?',
      [vendor_id, invoice_date, discountAmt, taxRate, taxAmount, total, note || null, id, tenantId]
    );

    // Update transport if provided
    if (freight !== undefined || coolie !== undefined) {
      const [existing] = await conn.execute('SELECT id FROM purchase_transport WHERE purchase_id=?', [id]) as any[];
      if ((existing as any[]).length) {
        await conn.execute(
          'UPDATE purchase_transport SET freight=?, coolie=? WHERE purchase_id=?',
          [freight ?? 0, coolie ?? 0, id]
        );
      } else if ((freight ?? 0) > 0 || (coolie ?? 0) > 0) {
        await conn.execute(
          'INSERT INTO purchase_transport (purchase_id,freight,coolie) VALUES (?,?,?)',
          [id, freight ?? 0, coolie ?? 0]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
}

export async function deletePurchase(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('DELETE FROM purchases WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function resolveDispute(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await query('UPDATE purchase_disputes SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Updated' });
  } catch { res.status(500).json({ message: 'Server error' }); }
}
