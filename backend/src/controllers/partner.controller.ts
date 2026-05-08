import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

export async function getPartners(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const partners = await query(
      `SELECT p.*,
        COALESCE(SUM(cp.amount),0) AS confirmed_paid
       FROM partners p
       LEFT JOIN capital_payments cp ON cp.partner_id = p.id
       WHERE p.tenant_id = ?
       GROUP BY p.id`,
      [tenantId]
    );
    res.json(partners);
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function addCapitalPayment(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { partner_id, amount, payment_date, mode, note } = req.body;
  const date = payment_date || new Date().toISOString().slice(0, 10);
  try {
    const result = await query<any>(
      'INSERT INTO capital_payments (tenant_id,partner_id,amount,payment_date,mode,note) VALUES (?,?,?,?,?,?)',
      [tenantId, partner_id, amount, date, mode || 'cash', note || null]
    );
    await query(
      'UPDATE partners SET paid_capital = paid_capital + ? WHERE id = ? AND tenant_id = ?',
      [amount, partner_id, tenantId]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('addCapitalPayment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getCapitalPayments(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { partner_id } = req.params;
  try {
    const rows = await query(
      'SELECT * FROM capital_payments WHERE tenant_id = ? AND partner_id = ? ORDER BY payment_date DESC',
      [tenantId, partner_id]
    );
    res.json(rows);
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function getReminders(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query<any[]>(
      'SELECT *, (status = "resolved") AS is_resolved FROM reminders WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );
    res.json(rows);
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function addReminder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { note, type } = req.body;
  if (!note) { res.status(400).json({ message: 'note is required' }); return; }
  try {
    const result = await query<any>(
      'INSERT INTO reminders (tenant_id,title,body,type) VALUES (?,?,?,?)',
      [tenantId, note, note, type || 'warning']
    );
    res.status(201).json({ id: result.insertId });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function resolveReminder(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query(
      "UPDATE reminders SET status = 'resolved' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    res.json({ message: 'Resolved' });
  } catch { res.status(500).json({ message: 'Server error' }); }
}
