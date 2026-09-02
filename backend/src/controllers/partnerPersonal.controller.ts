import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

export async function getPersonalAccountsSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const partners = await query<any[]>(
      `SELECT p.id, p.name, p.share_percent,
        COALESCE(SUM(CASE WHEN pa.type = 'credit' THEN pa.amount ELSE 0 END), 0) AS total_credit,
        COALESCE(SUM(CASE WHEN pa.type = 'debit' THEN pa.amount ELSE 0 END), 0) AS total_debit,
        COUNT(pa.id) AS tx_count
       FROM partners p
       LEFT JOIN partner_personal_accounts pa ON pa.partner_id = p.id AND pa.tenant_id = ?
       WHERE p.tenant_id = ?
       GROUP BY p.id, p.name, p.share_percent
       ORDER BY p.id ASC`,
      [tenantId, tenantId]
    );

    const partnerSummaries = partners.map(p => {
      const credit = Number(p.total_credit || 0);
      const debit = Number(p.total_debit || 0);
      return {
        id: p.id,
        name: p.name,
        share_percent: p.share_percent,
        total_credit: credit,
        total_debit: debit,
        net_balance: credit - debit,
        tx_count: Number(p.tx_count || 0),
      };
    });

    const combined = partnerSummaries.reduce(
      (acc, curr) => {
        acc.total_credit += curr.total_credit;
        acc.total_debit += curr.total_debit;
        acc.net_balance += curr.net_balance;
        acc.tx_count += curr.tx_count;
        return acc;
      },
      { total_credit: 0, total_debit: 0, net_balance: 0, tx_count: 0 }
    );

    res.json({
      partners: partnerSummaries,
      combined,
    });
  } catch (error) {
    console.error('getPersonalAccountsSummary error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function getPartnerPersonalLedger(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { partnerId } = req.params;
  const { startDate, endDate, type, category } = req.query as Record<string, string>;

  try {
    let sql = `
      SELECT pa.*, p.name AS partner_name
      FROM partner_personal_accounts pa
      JOIN partners p ON p.id = pa.partner_id AND p.tenant_id = pa.tenant_id
      WHERE pa.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (partnerId && partnerId !== 'all') {
      sql += ' AND pa.partner_id = ?';
      params.push(Number(partnerId));
    }

    if (startDate) {
      sql += ' AND pa.entry_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND pa.entry_date <= ?';
      params.push(endDate);
    }

    if (type && (type === 'credit' || type === 'debit')) {
      sql += ' AND pa.type = ?';
      params.push(type);
    }

    if (category && category !== 'all') {
      sql += ' AND pa.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY pa.entry_date ASC, pa.id ASC';

    const rows = await query<any[]>(sql, params);

    // Calculate running balance
    let runningBalance = 0;
    const ledger = rows.map(r => {
      const amt = Number(r.amount || 0);
      if (r.type === 'credit') {
        runningBalance += amt;
      } else {
        runningBalance -= amt;
      }
      return {
        ...r,
        amount: amt,
        running_balance: runningBalance,
      };
    });

    res.json(ledger);
  } catch (error) {
    console.error('getPartnerPersonalLedger error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createPersonalEntry(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { partner_id, entry_date, type, category, amount, payment_mode, reference_no, description } = req.body;

  if (!partner_id || !amount || Number(amount) <= 0) {
    res.status(400).json({ message: 'Valid partner and amount are required' });
    return;
  }

  if (!type || !['credit', 'debit'].includes(type)) {
    res.status(400).json({ message: 'Transaction type must be credit or debit' });
    return;
  }

  const date = entry_date || new Date().toISOString().slice(0, 10);
  const cat = category || 'general';
  const mode = payment_mode || 'cash';

  try {
    const result = await query<any>(
      `INSERT INTO partner_personal_accounts 
       (tenant_id, partner_id, entry_date, type, category, amount, payment_mode, reference_no, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, partner_id, date, type, cat, Number(amount), mode, reference_no || null, description || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Personal account entry created successfully' });
  } catch (error) {
    console.error('createPersonalEntry error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updatePersonalEntry(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { partner_id, entry_date, type, category, amount, payment_mode, reference_no, description } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ message: 'Valid amount is required' });
    return;
  }

  try {
    const sets: string[] = [];
    const vals: any[] = [];

    if (partner_id !== undefined) { sets.push('partner_id=?'); vals.push(Number(partner_id)); }
    if (entry_date !== undefined) { sets.push('entry_date=?'); vals.push(entry_date); }
    if (type !== undefined) { sets.push('type=?'); vals.push(type); }
    if (category !== undefined) { sets.push('category=?'); vals.push(category); }
    if (amount !== undefined) { sets.push('amount=?'); vals.push(Number(amount)); }
    if (payment_mode !== undefined) { sets.push('payment_mode=?'); vals.push(payment_mode); }
    if (reference_no !== undefined) { sets.push('reference_no=?'); vals.push(reference_no || null); }
    if (description !== undefined) { sets.push('description=?'); vals.push(description || null); }

    if (sets.length === 0) {
      res.status(400).json({ message: 'No fields to update' });
      return;
    }

    await query(
      `UPDATE partner_personal_accounts SET ${sets.join(', ')} WHERE id=? AND tenant_id=?`,
      [...vals, id, tenantId]
    );

    res.json({ message: 'Personal account entry updated successfully' });
  } catch (error) {
    console.error('updatePersonalEntry error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deletePersonalEntry(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    await query('DELETE FROM partner_personal_accounts WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Personal account entry deleted successfully' });
  } catch (error) {
    console.error('deletePersonalEntry error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}
