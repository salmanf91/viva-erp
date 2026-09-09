import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

const DEFAULT_RAW_MATERIALS = [
  'Mixed Fabric (Salwar)',
  'Mixed Fabric (Nighty)',
];

export async function getRawMaterials(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    let rows = await query<any[]>(
      `SELECT * FROM raw_materials WHERE tenant_id = ? AND is_active = 1 ORDER BY id ASC`,
      [tenantId]
    ).catch(() => []);

    // If none exist for this tenant, seed default raw materials
    if (!rows || rows.length === 0) {
      for (const name of DEFAULT_RAW_MATERIALS) {
        await query(
          `INSERT INTO raw_materials (tenant_id, name, uom) VALUES (?, ?, 'pcs')`,
          [tenantId, name]
        ).catch(() => {});
      }
      rows = await query<any[]>(
        `SELECT * FROM raw_materials WHERE tenant_id = ? AND is_active = 1 ORDER BY id ASC`,
        [tenantId]
      ).catch(() => []);
    }

    res.json(rows || []);
  } catch (error) {
    console.error('getRawMaterials error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createRawMaterial(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { name, code, uom = 'pcs', default_rate = 0 } = req.body;

  const cleanName = (name || '').trim();
  if (!cleanName) {
    res.status(400).json({ message: 'Raw material name is required' });
    return;
  }

  try {
    // Check if already exists (active or inactive)
    const existing = await query<any[]>(
      `SELECT id, is_active FROM raw_materials WHERE tenant_id = ? AND LOWER(TRIM(name)) = LOWER(?) LIMIT 1`,
      [tenantId, cleanName]
    );

    if (existing && existing.length > 0) {
      const existingId = existing[0].id;
      if (!existing[0].is_active) {
        await query(
          `UPDATE raw_materials SET is_active = 1, uom = ?, default_rate = ? WHERE id = ? AND tenant_id = ?`,
          [uom || 'pcs', Number(default_rate) || 0, existingId, tenantId]
        );
      }
      res.status(200).json({ id: existingId, name: cleanName, uom: uom || 'pcs', default_rate: Number(default_rate) || 0 });
      return;
    }

    const r = await query<any>(
      `INSERT INTO raw_materials (tenant_id, name, code, uom, default_rate, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [tenantId, cleanName, code || null, uom || 'pcs', Number(default_rate) || 0]
    );

    res.status(201).json({
      id: r.insertId,
      name: cleanName,
      code: code || null,
      uom: uom || 'pcs',
      default_rate: Number(default_rate) || 0,
      is_active: true,
    });
  } catch (error) {
    console.error('createRawMaterial error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateRawMaterial(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const { name, code, uom, default_rate } = req.body;

  try {
    await query(
      `UPDATE raw_materials SET
         name = COALESCE(?, name),
         code = COALESCE(?, code),
         uom = COALESCE(?, uom),
         default_rate = COALESCE(?, default_rate)
       WHERE id = ? AND tenant_id = ?`,
      [name?.trim(), code || null, uom, default_rate !== undefined ? Number(default_rate) : null, id, tenantId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('updateRawMaterial error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteRawMaterial(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  try {
    await query(
      `UPDATE raw_materials SET is_active = 0 WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('deleteRawMaterial error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
