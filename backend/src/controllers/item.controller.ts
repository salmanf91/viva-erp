import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

export const STANDARD_UOMS = [
  { code: 'pcs', label: 'Pieces (pcs)' },
  { code: 'box', label: 'Boxes (box)' },
  { code: 'kg',  label: 'Kilograms (kg)' },
  { code: 'mtr', label: 'Meters (mtr)' },
  { code: 'set', label: 'Sets (set)' },
  { code: 'pkt', label: 'Packets (pkt)' },
  { code: 'hrs', label: 'Hours (hrs)' },
  { code: 'ltr', label: 'Liters (ltr)' },
  { code: 'dzn', label: 'Dozens (dzn)' },
  { code: 'sqft', label: 'Square Feet (sqft)' },
];

export async function getItems(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const showAll = req.query.all === '1';

  try {
    const items = await query<any[]>(
      `SELECT * FROM product_config 
       WHERE tenant_id = ? ${showAll ? '' : 'AND is_active = 1'} 
       ORDER BY is_active DESC, name ASC, category ASC`,
      [tenantId]
    );

    // Fetch size rates for all items
    const sizeRates = await query<any[]>(
      `SELECT * FROM product_size_selling_rates WHERE tenant_id = ? ORDER BY id ASC`,
      [tenantId]
    );

    const sizeRatesByConfigId = new Map<number, any[]>();
    for (const sr of sizeRates) {
      if (!sizeRatesByConfigId.has(sr.product_config_id)) {
        sizeRatesByConfigId.set(sr.product_config_id, []);
      }
      sizeRatesByConfigId.get(sr.product_config_id)!.push(sr);
    }

    const result = items.map(item => ({
      ...item,
      display_name: item.name || formatCategoryName(item.category),
      size_rates: sizeRatesByConfigId.get(item.id) || [],
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Failed to fetch items', error: String(error) });
  }
}

export async function getItemById(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    const rows = await query<any[]>(
      'SELECT * FROM product_config WHERE id = ? AND tenant_id = ? LIMIT 1',
      [id, tenantId]
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }

    const item = rows[0];
    const sizeRates = await query<any[]>(
      'SELECT * FROM product_size_selling_rates WHERE product_config_id = ? AND tenant_id = ?',
      [item.id, tenantId]
    );

    res.json({
      ...item,
      display_name: item.name || formatCategoryName(item.category),
      size_rates: sizeRates || [],
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ message: 'Failed to fetch item', error: String(error) });
  }
}

export async function createItem(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const {
    name, category, item_code, item_type = 'product', uom = 'pcs',
    selling_rate = 0, purchase_cost = 0, tax_rate = 0, hsn_code, description,
    fabric_cost = 0, lace_cost = 0, zip_cost = 0, thread_cost = 0,
    canvas_cost = 0, plastic_cost = 0, logistics_cost = 0, cut_rate = 0, stitch_rate = 0,
    size_rates = []
  } = req.body;

  const displayName = name ? name.trim() : '';
  const cleanCategory = category ? category.trim().toLowerCase().replace(/\s+/g, '_') : (displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'item_' + Date.now());

  if (!displayName && !cleanCategory) {
    res.status(400).json({ message: 'Item name is required' });
    return;
  }

  try {
    const [insertRes] = await query<any>(
      `INSERT INTO product_config (
        tenant_id, category, name, item_code, item_type, uom,
        selling_rate, purchase_cost, tax_rate, hsn_code, description,
        fabric_cost, lace_cost, zip_cost, thread_cost,
        canvas_cost, plastic_cost, logistics_cost, cut_rate, stitch_rate, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        tenantId, cleanCategory, displayName || cleanCategory, item_code || null, item_type, uom || 'pcs',
        Number(selling_rate) || 0, Number(purchase_cost) || 0, Number(tax_rate) || 0, hsn_code || null, description || null,
        Number(fabric_cost) || 0, Number(lace_cost) || 0, Number(zip_cost) || 0, Number(thread_cost) || 0,
        Number(canvas_cost) || 0, Number(plastic_cost) || 0, Number(logistics_cost) || 0, Number(cut_rate) || 0, Number(stitch_rate) || 0
      ]
    );

    const itemId = insertRes.insertId;

    // Save size rates if provided
    if (Array.isArray(size_rates) && size_rates.length > 0) {
      for (const sr of size_rates) {
        if (sr.size_label && sr.selling_rate) {
          await query(
            `INSERT INTO product_size_selling_rates (tenant_id, product_config_id, size_label, selling_rate)
             VALUES (?, ?, ?, ?)`,
            [tenantId, itemId, sr.size_label.trim(), Number(sr.selling_rate)]
          );
        }
      }
    }

    res.status(201).json({ id: itemId, message: 'Item created successfully' });
  } catch (error: any) {
    console.error('Error creating item:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ message: `An item with identifier '${cleanCategory}' already exists.` });
      return;
    }
    res.status(500).json({ message: 'Failed to create item', error: String(error) });
  }
}

export async function updateItem(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const {
    name, item_code, item_type, uom,
    selling_rate, purchase_cost, tax_rate, hsn_code, description, is_active,
    fabric_cost, lace_cost, zip_cost, thread_cost,
    canvas_cost, plastic_cost, logistics_cost, cut_rate, stitch_rate,
    size_rates
  } = req.body;

  try {
    const existing = await query<any[]>(
      'SELECT id FROM product_config WHERE id = ? AND tenant_id = ? LIMIT 1',
      [id, tenantId]
    );

    if (!existing || existing.length === 0) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }

    await query(
      `UPDATE product_config SET
        name = COALESCE(?, name),
        item_code = ?,
        item_type = COALESCE(?, item_type),
        uom = COALESCE(?, uom),
        selling_rate = COALESCE(?, selling_rate),
        purchase_cost = COALESCE(?, purchase_cost),
        tax_rate = COALESCE(?, tax_rate),
        hsn_code = ?,
        description = ?,
        is_active = COALESCE(?, is_active),
        fabric_cost = COALESCE(?, fabric_cost),
        lace_cost = COALESCE(?, lace_cost),
        zip_cost = COALESCE(?, zip_cost),
        thread_cost = COALESCE(?, thread_cost),
        canvas_cost = COALESCE(?, canvas_cost),
        plastic_cost = COALESCE(?, plastic_cost),
        logistics_cost = COALESCE(?, logistics_cost),
        cut_rate = COALESCE(?, cut_rate),
        stitch_rate = COALESCE(?, stitch_rate)
      WHERE id = ? AND tenant_id = ?`,
      [
        name !== undefined ? name.trim() : null,
        item_code !== undefined ? (item_code ? item_code.trim() : null) : null,
        item_type,
        uom,
        selling_rate !== undefined ? Number(selling_rate) : null,
        purchase_cost !== undefined ? Number(purchase_cost) : null,
        tax_rate !== undefined ? Number(tax_rate) : null,
        hsn_code !== undefined ? (hsn_code ? hsn_code.trim() : null) : null,
        description !== undefined ? description : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        fabric_cost !== undefined ? Number(fabric_cost) : null,
        lace_cost !== undefined ? Number(lace_cost) : null,
        zip_cost !== undefined ? Number(zip_cost) : null,
        thread_cost !== undefined ? Number(thread_cost) : null,
        canvas_cost !== undefined ? Number(canvas_cost) : null,
        plastic_cost !== undefined ? Number(plastic_cost) : null,
        logistics_cost !== undefined ? Number(logistics_cost) : null,
        cut_rate !== undefined ? Number(cut_rate) : null,
        stitch_rate !== undefined ? Number(stitch_rate) : null,
        id, tenantId
      ]
    );

    // Update size rates if explicitly provided
    if (Array.isArray(size_rates)) {
      await query('DELETE FROM product_size_selling_rates WHERE product_config_id = ? AND tenant_id = ?', [id, tenantId]);
      for (const sr of size_rates) {
        if (sr.size_label && sr.selling_rate) {
          await query(
            `INSERT INTO product_size_selling_rates (tenant_id, product_config_id, size_label, selling_rate)
             VALUES (?, ?, ?, ?)`,
            [tenantId, id, sr.size_label.trim(), Number(sr.selling_rate)]
          );
        }
      }
    }

    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Failed to update item', error: String(error) });
  }
}

export async function deleteItem(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    // Check if item exists
    const rows = await query<any[]>(
      'SELECT id, category, name FROM product_config WHERE id = ? AND tenant_id = ? LIMIT 1',
      [id, tenantId]
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }

    const item = rows[0];

    // Delete size rates and item config
    await query('DELETE FROM product_size_selling_rates WHERE product_config_id = ? AND tenant_id = ?', [id, tenantId]);
    await query('DELETE FROM product_config WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: `Item '${item.name || item.category}' deleted successfully` });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Failed to delete item', error: String(error) });
  }
}

export async function getUomList(_req: AuthRequest, res: Response): Promise<void> {
  res.json(STANDARD_UOMS);
}

function formatCategoryName(cat: string): string {
  if (!cat) return 'Item';
  const labelMap: Record<string, string> = {
    shawl_nighty: 'Shawl Nighty',
    shawl_nighty_lace: 'Shawl Nighty + Lace',
    ordinary_nighty: 'Ordinary Nighty',
  };
  if (labelMap[cat]) return labelMap[cat];
  return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
