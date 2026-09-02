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

    // Fetch batch items for rows and activeRows
    const allBatchIds = Array.from(new Set([...rows.map(r => r.id), ...activeRows.map(r => r.id)]));
    let itemsByBatch = new Map<number, any[]>();
    if (allBatchIds.length > 0) {
      try {
        const batchItems = await query<any[]>(
          `SELECT * FROM production_batch_items WHERE tenant_id = ? AND batch_id IN (${allBatchIds.map(() => '?').join(',')}) ORDER BY id ASC`,
          [tenantId, ...allBatchIds]
        );
        for (const item of batchItems) {
          if (!itemsByBatch.has(item.batch_id)) itemsByBatch.set(item.batch_id, []);
          itemsByBatch.get(item.batch_id)!.push(item);
        }
      } catch {}
    }

    const enrichBatch = (b: any) => ({
      ...b,
      items: itemsByBatch.get(b.id) || [
        {
          id: null,
          category: b.category,
          size: null,
          quantity: b.quantity,
          cut_rate: b.cut_rate,
          stitch_rate: b.stitch_rate,
          zip_cost: 0,
          thread_cost: 0,
          canvas_cost: 0,
          plastic_cost: 0,
          lace_cost: 0,
          logistics_cost: 0,
        }
      ]
    });

    const enrichedRows = rows.map(enrichBatch);
    const enrichedActiveRows = activeRows.map(enrichBatch);

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
      data: enrichedRows,
      active: enrichedActiveRows,
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
  const { category, quantity, cut_rate, stitch_rate, batch_date, notes, items } = req.body;

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

    // Normalize items
    let parsedItems: Array<{
      category: string;
      size?: string | null;
      quantity: number;
      cut_rate?: number;
      stitch_rate?: number;
      zip_cost?: number;
      thread_cost?: number;
      canvas_cost?: number;
      plastic_cost?: number;
      lace_cost?: number;
      logistics_cost?: number;
    }> = [];

    if (Array.isArray(items) && items.length > 0) {
      parsedItems = items
        .filter(it => it && (Number(it.quantity) > 0 || it.category))
        .map(it => ({
          category: it.category || category || 'ordinary_nighty',
          size: it.size ? String(it.size).trim() : null,
          quantity: Number(it.quantity) || 0,
          cut_rate: it.cut_rate !== undefined && it.cut_rate !== null ? Number(it.cut_rate) : undefined,
          stitch_rate: it.stitch_rate !== undefined && it.stitch_rate !== null ? Number(it.stitch_rate) : undefined,
          zip_cost: it.zip_cost !== undefined && it.zip_cost !== null ? Number(it.zip_cost) : undefined,
          thread_cost: it.thread_cost !== undefined && it.thread_cost !== null ? Number(it.thread_cost) : undefined,
          canvas_cost: it.canvas_cost !== undefined && it.canvas_cost !== null ? Number(it.canvas_cost) : undefined,
          plastic_cost: it.plastic_cost !== undefined && it.plastic_cost !== null ? Number(it.plastic_cost) : undefined,
          lace_cost: it.lace_cost !== undefined && it.lace_cost !== null ? Number(it.lace_cost) : undefined,
          logistics_cost: it.logistics_cost !== undefined && it.logistics_cost !== null ? Number(it.logistics_cost) : undefined,
        }));
    }

    if (parsedItems.length === 0) {
      parsedItems = [{
        category: category || 'ordinary_nighty',
        size: req.body.size ? String(req.body.size).trim() : null,
        quantity: Number(quantity) || 0,
        cut_rate: cut_rate !== undefined && cut_rate !== null ? Number(cut_rate) : undefined,
        stitch_rate: stitch_rate !== undefined && stitch_rate !== null ? Number(stitch_rate) : undefined,
        zip_cost: req.body.zip_cost !== undefined ? Number(req.body.zip_cost) : undefined,
        thread_cost: req.body.thread_cost !== undefined ? Number(req.body.thread_cost) : undefined,
        canvas_cost: req.body.canvas_cost !== undefined ? Number(req.body.canvas_cost) : undefined,
        plastic_cost: req.body.plastic_cost !== undefined ? Number(req.body.plastic_cost) : undefined,
        lace_cost: req.body.lace_cost !== undefined ? Number(req.body.lace_cost) : undefined,
        logistics_cost: req.body.logistics_cost !== undefined ? Number(req.body.logistics_cost) : undefined,
      }];
    }

    // Resolve rates and accessories from product_config for any item missing rates
    const [cfgRows] = await conn.execute(
      'SELECT category, cut_rate, stitch_rate, zip_cost, thread_cost, canvas_cost, plastic_cost, lace_cost, logistics_cost FROM product_config WHERE tenant_id=?',
      [tenantId]
    ) as any[];
    const configMap = new Map<string, any>();
    for (const c of (cfgRows as any[])) {
      configMap.set((c.category || '').toLowerCase(), {
        cut_rate: Number(c.cut_rate ?? 5.00),
        stitch_rate: Number(c.stitch_rate ?? 15.00),
        zip_cost: Number(c.zip_cost ?? 0.00),
        thread_cost: Number(c.thread_cost ?? 0.00),
        canvas_cost: Number(c.canvas_cost ?? 0.00),
        plastic_cost: Number(c.plastic_cost ?? 0.00),
        lace_cost: Number(c.lace_cost ?? 0.00),
        logistics_cost: Number(c.logistics_cost ?? 0.00),
      });
    }

    let totalQuantity = 0;
    let primaryCategory = parsedItems[0]?.category || category || 'ordinary_nighty';
    let weightedCutSum = 0;
    let weightedStitchSum = 0;

    for (const it of parsedItems) {
      const cfg = configMap.get((it.category || '').toLowerCase()) || {
        cut_rate: 5.00,
        stitch_rate: 15.00,
        zip_cost: 0,
        thread_cost: 0,
        canvas_cost: 0,
        plastic_cost: 0,
        lace_cost: 0,
        logistics_cost: 0,
      };
      if (it.cut_rate === undefined || isNaN(it.cut_rate)) it.cut_rate = cfg.cut_rate;
      if (it.stitch_rate === undefined || isNaN(it.stitch_rate)) it.stitch_rate = cfg.stitch_rate;
      if (it.zip_cost === undefined || isNaN(it.zip_cost)) it.zip_cost = cfg.zip_cost;
      if (it.thread_cost === undefined || isNaN(it.thread_cost)) it.thread_cost = cfg.thread_cost;
      if (it.canvas_cost === undefined || isNaN(it.canvas_cost)) it.canvas_cost = cfg.canvas_cost;
      if (it.plastic_cost === undefined || isNaN(it.plastic_cost)) it.plastic_cost = cfg.plastic_cost;
      if (it.lace_cost === undefined || isNaN(it.lace_cost)) it.lace_cost = cfg.lace_cost;
      if (it.logistics_cost === undefined || isNaN(it.logistics_cost)) it.logistics_cost = cfg.logistics_cost;

      totalQuantity += it.quantity;
      weightedCutSum += (it.cut_rate || 0) * (it.quantity || 1);
      weightedStitchSum += (it.stitch_rate || 0) * (it.quantity || 1);
    }

    const avgCutRate = totalQuantity > 0 ? (weightedCutSum / totalQuantity) : (parsedItems[0]?.cut_rate || 5.00);
    const avgStitchRate = totalQuantity > 0 ? (weightedStitchSum / totalQuantity) : (parsedItems[0]?.stitch_rate || 15.00);
    let batchId: number;
    try {
      const [bRes] = await conn.execute(
        'INSERT INTO production_batches (tenant_id,batch_number,category,quantity,cut_rate,stitch_rate,batch_date,notes) VALUES (?,?,?,?,?,?,?,?)',
        [tenantId, batchNumber, primaryCategory, totalQuantity, avgCutRate, avgStitchRate, batch_date, notes || null]
      );
      batchId = (bRes as any).insertId;
    } catch (e: any) {
      if (e?.message && e.message.includes('notes')) {
        const [bRes] = await conn.execute(
          'INSERT INTO production_batches (tenant_id,batch_number,category,quantity,cut_rate,stitch_rate,batch_date) VALUES (?,?,?,?,?,?,?)',
          [tenantId, batchNumber, primaryCategory, totalQuantity, avgCutRate, avgStitchRate, batch_date]
        );
        batchId = (bRes as any).insertId;
      } else {
        throw e;
      }
    }

    // Insert batch items
    for (const it of parsedItems) {
      try {
        await conn.execute(
          `INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate, zip_cost, thread_cost, canvas_cost, plastic_cost, lace_cost, logistics_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            batchId,
            it.category,
            it.size || null,
            it.quantity,
            it.cut_rate || 0,
            it.stitch_rate || 0,
            it.zip_cost || 0,
            it.thread_cost || 0,
            it.canvas_cost || 0,
            it.plastic_cost || 0,
            it.lace_cost || 0,
            it.logistics_cost || 0,
          ]
        );
      } catch {
        // Fallback for older schema without accessory columns
        await conn.execute(
          `INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, batchId, it.category, it.size || null, it.quantity, it.cut_rate || 0, it.stitch_rate || 0]
        );
      }

      // stock: mark as allocated
      if (it.quantity > 0) {
        await conn.execute(
          `INSERT INTO stock_movements (tenant_id,category,type,quantity,reference,movement_date)
           VALUES (?,?,?,?,?,?)`,
          [tenantId, it.category, 'allocated', it.quantity, `${batchNumber}${it.size ? ` (${it.size})` : ''}`, batch_date]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ id: batchId, batch_number: batchNumber, quantity: totalQuantity, items: parsedItems });
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

    const items = await query<any[]>(
      `SELECT * FROM production_batch_items WHERE batch_id=? AND tenant_id=? ORDER BY id ASC`,
      [id, tenantId]
    );

    res.json({
      batch: {
        ...batches[0],
        items: items.length > 0 ? items : [
          {
            id: null,
            category: batches[0].category,
            size: null,
            quantity: batches[0].quantity,
            cut_rate: batches[0].cut_rate,
            stitch_rate: batches[0].stitch_rate,
            zip_cost: 0,
            thread_cost: 0,
            canvas_cost: 0,
            plastic_cost: 0,
            lace_cost: 0,
            logistics_cost: 0,
          }
        ]
      },
      workLogs: []
    });
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
  const { status, cut_rate, stitch_rate, batch_date, notes, category, quantity, items } = req.body;
  const allowed = ['allocated', 'cutting', 'stitching', 'finished'];
  if (status && !allowed.includes(status)) { res.status(400).json({ message: 'Invalid status' }); return; }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch product configs for accessories fallback
    const [configs] = await conn.execute('SELECT * FROM product_config WHERE tenant_id = ?', [tenantId]) as any[];
    const configMap = new Map<string, any>();
    for (const c of (configs as any[] || [])) {
      configMap.set((c.category || '').toLowerCase(), {
        cut_rate: Number(c.cut_rate ?? 5.00),
        stitch_rate: Number(c.stitch_rate ?? 15.00),
        zip_cost: Number(c.zip_cost ?? 0.00),
        thread_cost: Number(c.thread_cost ?? 0.00),
        canvas_cost: Number(c.canvas_cost ?? 0.00),
        plastic_cost: Number(c.plastic_cost ?? 0.00),
        lace_cost: Number(c.lace_cost ?? 0.00),
        logistics_cost: Number(c.logistics_cost ?? 0.00),
      });
    }

    const sets: string[] = [];
    const vals: any[] = [];
    if (status !== undefined)      { sets.push('status=?');      vals.push(status); }
    if (batch_date !== undefined)  { sets.push('batch_date=?');  vals.push(batch_date); }
    if (notes !== undefined)       { sets.push('notes=?');       vals.push(notes || null); }

    // If items are provided, update batch items and calculate total quantity
    if (Array.isArray(items) && items.length > 0) {
      const validItems = items.filter(it => it && (Number(it.quantity) > 0 || it.category));
      let totalQty = 0;
      let weightedCut = 0;
      let weightedStitch = 0;

      for (const it of validItems) {
        const cfg = configMap.get((it.category || '').toLowerCase()) || {
          cut_rate: 5.00,
          stitch_rate: 15.00,
          zip_cost: 0,
          thread_cost: 0,
          canvas_cost: 0,
          plastic_cost: 0,
          lace_cost: 0,
          logistics_cost: 0,
        };

        const itCut = (it.cut_rate !== undefined && !isNaN(Number(it.cut_rate))) ? Number(it.cut_rate) : cfg.cut_rate;
        const itStitch = (it.stitch_rate !== undefined && !isNaN(Number(it.stitch_rate))) ? Number(it.stitch_rate) : cfg.stitch_rate;
        const itZip = (it.zip_cost !== undefined && !isNaN(Number(it.zip_cost))) ? Number(it.zip_cost) : cfg.zip_cost;
        const itThread = (it.thread_cost !== undefined && !isNaN(Number(it.thread_cost))) ? Number(it.thread_cost) : cfg.thread_cost;
        const itCanvas = (it.canvas_cost !== undefined && !isNaN(Number(it.canvas_cost))) ? Number(it.canvas_cost) : cfg.canvas_cost;
        const itPlastic = (it.plastic_cost !== undefined && !isNaN(Number(it.plastic_cost))) ? Number(it.plastic_cost) : cfg.plastic_cost;
        const itLace = (it.lace_cost !== undefined && !isNaN(Number(it.lace_cost))) ? Number(it.lace_cost) : cfg.lace_cost;
        const itLogistics = (it.logistics_cost !== undefined && !isNaN(Number(it.logistics_cost))) ? Number(it.logistics_cost) : cfg.logistics_cost;

        totalQty += Number(it.quantity) || 0;
        weightedCut += itCut * (Number(it.quantity) || 1);
        weightedStitch += itStitch * (Number(it.quantity) || 1);
      }

      const avgCut = totalQty > 0 ? (weightedCut / totalQty) : (cut_rate || 0);
      const avgStitch = totalQty > 0 ? (weightedStitch / totalQty) : (stitch_rate || 0);

      sets.push('quantity=?'); vals.push(totalQty);
      sets.push('cut_rate=?'); vals.push(avgCut);
      sets.push('stitch_rate=?'); vals.push(avgStitch);
      if (validItems[0]?.category) { sets.push('category=?'); vals.push(validItems[0].category); }

      // Replace batch items
      await conn.execute('DELETE FROM production_batch_items WHERE batch_id=? AND tenant_id=?', [id, tenantId]);
      for (const it of validItems) {
        const cfg = configMap.get((it.category || '').toLowerCase()) || {
          cut_rate: 5.00,
          stitch_rate: 15.00,
          zip_cost: 0,
          thread_cost: 0,
          canvas_cost: 0,
          plastic_cost: 0,
          lace_cost: 0,
          logistics_cost: 0,
        };

        const itCut = (it.cut_rate !== undefined && !isNaN(Number(it.cut_rate))) ? Number(it.cut_rate) : cfg.cut_rate;
        const itStitch = (it.stitch_rate !== undefined && !isNaN(Number(it.stitch_rate))) ? Number(it.stitch_rate) : cfg.stitch_rate;
        const itZip = (it.zip_cost !== undefined && !isNaN(Number(it.zip_cost))) ? Number(it.zip_cost) : cfg.zip_cost;
        const itThread = (it.thread_cost !== undefined && !isNaN(Number(it.thread_cost))) ? Number(it.thread_cost) : cfg.thread_cost;
        const itCanvas = (it.canvas_cost !== undefined && !isNaN(Number(it.canvas_cost))) ? Number(it.canvas_cost) : cfg.canvas_cost;
        const itPlastic = (it.plastic_cost !== undefined && !isNaN(Number(it.plastic_cost))) ? Number(it.plastic_cost) : cfg.plastic_cost;
        const itLace = (it.lace_cost !== undefined && !isNaN(Number(it.lace_cost))) ? Number(it.lace_cost) : cfg.lace_cost;
        const itLogistics = (it.logistics_cost !== undefined && !isNaN(Number(it.logistics_cost))) ? Number(it.logistics_cost) : cfg.logistics_cost;

        try {
          await conn.execute(
            `INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate, zip_cost, thread_cost, canvas_cost, plastic_cost, lace_cost, logistics_cost)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tenantId,
              id,
              it.category,
              it.size ? String(it.size).trim() : null,
              Number(it.quantity) || 0,
              itCut,
              itStitch,
              itZip,
              itThread,
              itCanvas,
              itPlastic,
              itLace,
              itLogistics,
            ]
          );
        } catch {
          await conn.execute(
            `INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tenantId, id, it.category, it.size ? String(it.size).trim() : null, Number(it.quantity) || 0, itCut, itStitch]
          );
        }
      }
    } else {
      if (quantity !== undefined)    { sets.push('quantity=?');    vals.push(Number(quantity)); }
      if (category !== undefined)    { sets.push('category=?');    vals.push(category); }
      if (cut_rate !== undefined)    { sets.push('cut_rate=?');    vals.push(Number(cut_rate)); }
      if (stitch_rate !== undefined) { sets.push('stitch_rate=?'); vals.push(Number(stitch_rate)); }
    }

    if (sets.length > 0) {
      try {
        await conn.execute(`UPDATE production_batches SET ${sets.join(',')} WHERE id=? AND tenant_id=?`, [...vals, id, tenantId]);
      } catch (err: any) {
        if (err?.message && err.message.includes('notes')) {
          const notesIdx = sets.findIndex(s => s.startsWith('notes='));
          if (notesIdx !== -1) {
            sets.splice(notesIdx, 1);
            vals.splice(notesIdx, 1);
          }
          if (sets.length > 0) {
            await conn.execute(`UPDATE production_batches SET ${sets.join(',')} WHERE id=? AND tenant_id=?`, [...vals, id, tenantId]);
          }
        } else {
          throw err;
        }
      }
    }

    await conn.commit();
    res.json({ message: 'Updated' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    conn.release();
  }
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
