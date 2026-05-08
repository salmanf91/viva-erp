import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/db';

export async function getBatches(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      `SELECT pb.*,
        cm.name AS cutting_master_name,
        t.name  AS tailor_name
       FROM production_batches pb
       LEFT JOIN staff cm ON cm.id = pb.cutting_master_id
       LEFT JOIN staff t  ON t.id  = pb.tailor_id
       WHERE pb.tenant_id = ?
       ORDER BY pb.batch_date DESC, pb.id DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function createBatch(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { category, quantity, cutting_master_id, tailor_id, batch_date } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // auto-generate batch number
    const [countRows] = await conn.execute(
      'SELECT COUNT(*) AS cnt FROM production_batches WHERE tenant_id = ?', [tenantId]
    );
    const count = (countRows as any[])[0].cnt + 1;
    const batchNumber = `BATCH-${String(count).padStart(3, '0')}`;

    const [bRes] = await conn.execute(
      'INSERT INTO production_batches (tenant_id,batch_number,category,quantity,cutting_master_id,tailor_id,batch_date) VALUES (?,?,?,?,?,?,?)',
      [tenantId, batchNumber, category, quantity, cutting_master_id || null, tailor_id || null, batch_date]
    );
    const batchId = (bRes as any).insertId;

    // create work logs for cutting master and tailor
    if (cutting_master_id) {
      const [staffRows] = await conn.execute('SELECT rate_per_pc FROM staff WHERE id = ?', [cutting_master_id]);
      const rate = (staffRows as any[])[0]?.rate_per_pc || 5;
      await conn.execute(
        'INSERT INTO staff_work_logs (tenant_id,staff_id,batch_id,pieces,rate,log_date) VALUES (?,?,?,?,?,?)',
        [tenantId, cutting_master_id, batchId, quantity, rate, batch_date]
      );
    }
    if (tailor_id) {
      const [staffRows] = await conn.execute('SELECT rate_per_pc FROM staff WHERE id = ?', [tailor_id]);
      const rate = (staffRows as any[])[0]?.rate_per_pc || 15;
      await conn.execute(
        'INSERT INTO staff_work_logs (tenant_id,staff_id,batch_id,pieces,rate,log_date) VALUES (?,?,?,?,?,?)',
        [tenantId, tailor_id, batchId, quantity, rate, batch_date]
      );
    }

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
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
}

export async function getBatchDetail(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    const [batches, workLogs] = await Promise.all([
      query<any[]>(
        `SELECT pb.*, cm.name AS cutting_master_name, t.name AS tailor_name
         FROM production_batches pb
         LEFT JOIN staff cm ON cm.id = pb.cutting_master_id
         LEFT JOIN staff t  ON t.id  = pb.tailor_id
         WHERE pb.id=? AND pb.tenant_id=?`,
        [id, tenantId]
      ),
      query<any[]>(
        `SELECT swl.*, swl.rate AS rate_per_pc, s.name AS staff_name, s.role
         FROM staff_work_logs swl
         JOIN staff s ON s.id = swl.staff_id
         WHERE swl.batch_id=? AND swl.tenant_id=?`,
        [id, tenantId]
      ),
    ]);
    if (!batches[0]) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ batch: batches[0], workLogs });
  } catch { res.status(500).json({ message: 'Server error' }); }
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
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function getProductConfigs(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query('SELECT * FROM product_config WHERE tenant_id=?', [tenantId]);
    res.json(rows);
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function updateBatch(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { status, cutting_master_id, tailor_id } = req.body;
  const allowed = ['allocated', 'cutting', 'stitching', 'finished'];
  if (status && !allowed.includes(status)) { res.status(400).json({ message: 'Invalid status' }); return; }
  try {
    const sets: string[] = [];
    const vals: any[] = [];
    if (status !== undefined)             { sets.push('status=?');             vals.push(status); }
    if (cutting_master_id !== undefined)  { sets.push('cutting_master_id=?');  vals.push(cutting_master_id || null); }
    if (tailor_id !== undefined)          { sets.push('tailor_id=?');          vals.push(tailor_id || null); }
    if (!sets.length) { res.status(400).json({ message: 'Nothing to update' }); return; }
    await query(`UPDATE production_batches SET ${sets.join(',')} WHERE id=? AND tenant_id=?`, [...vals, id, tenantId]);
    res.json({ message: 'Updated' });
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function deleteBatch(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query('DELETE FROM production_batches WHERE id=? AND tenant_id=?', [id, tenantId]);
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
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
  } catch { res.status(500).json({ message: 'Server error' }); }
}

export async function updateProductConfig(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { category } = req.params;
  const fields = req.body;
  const allowed = ['fabric_cost','selling_rate','lace_cost','zip_cost','thread_cost','canvas_cost','plastic_cost','logistics_cost','cut_rate','stitch_rate'];
  const validKeys = Object.keys(fields).filter(k => allowed.includes(k));
  if (!validKeys.length) { res.status(400).json({ message: 'No valid fields' }); return; }
  const vals = validKeys.map(k => fields[k]);
  try {
    const setClauses = validKeys.map(k => `${k}=?`).join(',');
    await query(
      `INSERT INTO product_config (tenant_id,category,${validKeys.join(',')})
       VALUES (?,?,${validKeys.map(() => '?').join(',')})
       ON DUPLICATE KEY UPDATE ${setClauses}`,
      [tenantId, category, ...vals, ...vals]
    );
    res.json({ message: 'Saved' });
  } catch { res.status(500).json({ message: 'Server error' }); }
}
