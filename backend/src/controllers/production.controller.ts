import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/db';

export async function getBatches(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  try {
    // 1. Count query
    const [countRows] = await query<any[]>('SELECT COUNT(*) AS total FROM production_batches WHERE tenant_id=?', [tenantId]);
    const total = countRows?.total || 0;

    // 2. Paginated data query
    const rows = await query<any[]>(
      `SELECT pb.* FROM production_batches pb
       WHERE pb.tenant_id = ?
       ORDER BY pb.batch_date DESC, pb.id DESC
       LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );

    // Fetch all active batches
    const activeRows = await query<any[]>(
      `SELECT pb.* FROM production_batches pb
       WHERE pb.tenant_id = ? AND pb.status != 'finished'
       ORDER BY pb.batch_date DESC, pb.id DESC`,
      [tenantId]
    );

    // 3. Stats query
    const statsRows = await query<any[]>(
      `SELECT 
         COALESCE(SUM(quantity), 0) AS total_pcs,
         COALESCE(SUM(CASE WHEN status = 'finished' THEN quantity ELSE 0 END), 0) AS finished_pcs,
         COALESCE(SUM(CASE WHEN status != 'finished' THEN quantity ELSE 0 END), 0) AS active_pcs,
         COUNT(CASE WHEN status != 'finished' THEN 1 END) AS active_count,
         COUNT(CASE WHEN status = 'finished' THEN 1 END) AS finished_count
       FROM production_batches
       WHERE tenant_id = ?`,
      [tenantId]
    );
    const stats = statsRows[0] || { total_pcs: 0, finished_pcs: 0, active_pcs: 0, active_count: 0, finished_count: 0 };

    // Category totals
    const catRows = await query<any[]>(
      `SELECT category, COALESCE(SUM(quantity), 0) AS category_qty
       FROM production_batches
       WHERE tenant_id = ?
       GROUP BY category`,
      [tenantId]
    );
    const categoryTotals: Record<string, number> = {};
    for (const catRow of catRows) {
      categoryTotals[catRow.category] = Number(catRow.category_qty);
    }

    res.json({
      data: rows,
      active: activeRows,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
      stats: {
        totalPcs: Number(stats.total_pcs),
        finishedPcs: Number(stats.finished_pcs),
        activePcs: Number(stats.active_pcs),
        activeCount: Number(stats.active_count),
        finishedCount: Number(stats.finished_count),
        categoryTotals
      }
    });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function createBatch(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { category, quantity, cut_rate, stitch_rate, batch_date } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // auto-generate batch number
    const [maxRows] = await conn.execute(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(batch_number, '[^0-9]', '') AS UNSIGNED)), 0) AS max_num,
              COUNT(*) AS cnt 
       FROM production_batches WHERE tenant_id = ?`,
      [tenantId]
    ) as any[];
    const maxNum = Number((maxRows as any[])[0]?.max_num || 0);
    const cnt = Number((maxRows as any[])[0]?.cnt || 0);
    const nextNum = Math.max(maxNum + 1, cnt + 1, 1);
    const batchNumber = `BATCH-${String(nextNum).padStart(3, '0')}`;

    // Resolve rates: if not passed, fall back to product_config defaults
    let finalCutRate = cut_rate;
    let finalStitchRate = stitch_rate;
    if (finalCutRate === undefined || finalCutRate === null || finalStitchRate === undefined || finalStitchRate === null) {
      const [cfgRows] = await conn.execute('SELECT cut_rate, stitch_rate FROM product_config WHERE tenant_id=? AND category=? LIMIT 1', [tenantId, category]);
      const config = (cfgRows as any[])[0];
      if (finalCutRate === undefined || finalCutRate === null) {
        finalCutRate = config?.cut_rate ?? 5.00; // default fallback if no config
      }
      if (finalStitchRate === undefined || finalStitchRate === null) {
        finalStitchRate = config?.stitch_rate ?? 15.00; // default fallback if no config
      }
    }

    const [bRes] = await conn.execute(
      'INSERT INTO production_batches (tenant_id,batch_number,category,quantity,cut_rate,stitch_rate,batch_date) VALUES (?,?,?,?,?,?,?)',
      [tenantId, batchNumber, category, quantity, finalCutRate, finalStitchRate, batch_date]
    );
    const batchId = (bRes as any).insertId;

    // stock: mark as allocated
    await conn.execute(
      `INSERT INTO stock_movements (tenant_id,category,type,quantity,reference,movement_date)
       VALUES (?,?,?,?,?,?)`,
      [tenantId, category.replace('_lace', '').replace('shawl_nighty', 'shawl_nighty'), 'allocated', quantity, batchNumber, batch_date]
    );

    await conn.commit();
    res.status(201).json({ id: batchId, batch_number: batchNumber });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Server error', error: err instanceof Error ? err.message : String(err) });
  } finally {
    conn.release();
  }
}

export async function getBatchDetail(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    const batches = await query<any[]>(
      `SELECT pb.* FROM production_batches pb
       WHERE pb.id=? AND pb.tenant_id=?`,
      [id, tenantId]
    );
    if (!batches[0]) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ batch: batches[0], workLogs: [] });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function finishBatch(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query(
      "UPDATE production_batches SET status='finished' WHERE id=? AND tenant_id=?",
      [id, tenantId]
    );
    res.json({ message: 'Batch marked as finished' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function getProductConfigs(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const configs = await query<any[]>('SELECT * FROM product_config WHERE tenant_id=?', [tenantId]);
    const sizeRates = await query<any[]>('SELECT * FROM product_size_rates WHERE tenant_id=?', [tenantId]);
    const result = configs.map(cfg => ({
      ...cfg,
      size_rates: sizeRates.filter(r => r.category === cfg.category)
    }));
    res.json(result);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function updateBatch(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { status, cut_rate, stitch_rate } = req.body;
  const allowed = ['allocated', 'cutting', 'stitching', 'finished'];
  if (status && !allowed.includes(status)) { res.status(400).json({ message: 'Invalid status' }); return; }
  try {
    const sets: string[] = [];
    const vals: any[] = [];
    if (status !== undefined)      { sets.push('status=?');      vals.push(status); }
    if (cut_rate !== undefined)    { sets.push('cut_rate=?');    vals.push(cut_rate); }
    if (stitch_rate !== undefined) { sets.push('stitch_rate=?'); vals.push(stitch_rate); }
    if (!sets.length) { res.status(400).json({ message: 'Nothing to update' }); return; }
    await query(`UPDATE production_batches SET ${sets.join(',')} WHERE id=? AND tenant_id=?`, [...vals, id, tenantId]);
    res.json({ message: 'Updated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function deleteBatch(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('DELETE FROM production_batches WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deleted' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function updateBatchStatus(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['allocated', 'cutting', 'stitching', 'finished'];
  if (!allowed.includes(status)) { res.status(400).json({ message: 'Invalid status' }); return; }
  try {
    await query('UPDATE production_batches SET status=? WHERE id=? AND tenant_id=?', [status, id, tenantId]);
    res.json({ message: 'Updated' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}

export async function updateProductConfig(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { category } = req.params;
  const { size_rates, ...fields } = req.body;
  const allowed = [
    'fabric_cost','selling_rate','lace_cost','zip_cost','thread_cost','canvas_cost','plastic_cost','logistics_cost','cut_rate','stitch_rate'
  ];
  const validKeys = Object.keys(fields).filter(k => allowed.includes(k));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (validKeys.length) {
      const vals = validKeys.map(k => fields[k]);
      const setClauses = validKeys.map(k => `${k}=?`).join(',');
      await conn.execute(
        `INSERT INTO product_config (tenant_id,category,${validKeys.join(',')})
         VALUES (?,?,${validKeys.map(() => '?').join(',')})
         ON DUPLICATE KEY UPDATE ${setClauses}`,
        [tenantId, category, ...vals, ...vals]
      );
    }

    if (Array.isArray(size_rates)) {
      // Delete existing size rates for this category
      await conn.execute(
        'DELETE FROM product_size_rates WHERE tenant_id=? AND category=?',
        [tenantId, category]
      );

      // Insert new size rates
      for (const rate of size_rates) {
        if (rate.size_label && rate.selling_rate !== undefined && rate.selling_rate !== null && rate.selling_rate !== '') {
          await conn.execute(
            'INSERT INTO product_size_rates (tenant_id, category, size_label, selling_rate) VALUES (?,?,?,?)',
            [tenantId, category, String(rate.size_label).trim(), rate.selling_rate]
          );
        }
      }
    }

    await conn.commit();
    res.json({ message: 'Saved' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    conn.release();
  }
}

export async function deleteProductConfig(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { category } = req.params;
  try {
    await query('DELETE FROM product_config WHERE tenant_id=? AND category=?', [tenantId, category]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }); }
}
