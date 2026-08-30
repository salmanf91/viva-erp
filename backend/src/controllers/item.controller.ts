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
    let items: any[] = [];
    try {
      items = await query<any[]>(
        `SELECT * FROM product_config 
         WHERE tenant_id = ? ${showAll ? '' : 'AND (is_active IS NULL OR is_active = 1)'} 
         ORDER BY id ASC`,
        [tenantId]
      );
    } catch (err: any) {
      // If is_active column is not yet present
      if (err.message && err.message.includes('Unknown column')) {
        items = await query<any[]>(
          `SELECT * FROM product_config WHERE tenant_id = ? ORDER BY id ASC`,
          [tenantId]
        );
      } else {
        throw err;
      }
    }

    // Fetch size rates safely from both product_size_rates and product_size_selling_rates
    let sizeRatesByCategory = new Map<string, any[]>();
    let sizeRatesByConfigId = new Map<number, any[]>();

    try {
      const psr = await query<any[]>(
        `SELECT * FROM product_size_rates WHERE tenant_id = ? ORDER BY id ASC`,
        [tenantId]
      );
      for (const sr of psr) {
        const cat = (sr.category || '').toLowerCase().trim();
        if (!sizeRatesByCategory.has(cat)) sizeRatesByCategory.set(cat, []);
        sizeRatesByCategory.get(cat)!.push(sr);
      }
    } catch {}

    try {
      const pssr = await query<any[]>(
        `SELECT * FROM product_size_selling_rates WHERE tenant_id = ? ORDER BY id ASC`,
        [tenantId]
      );
      for (const sr of pssr) {
        if (!sizeRatesByConfigId.has(sr.product_config_id)) sizeRatesByConfigId.set(sr.product_config_id, []);
        sizeRatesByConfigId.get(sr.product_config_id)!.push(sr);
      }
    } catch {}

    const result = items.map(item => {
      const catKey = (item.category || '').toLowerCase().trim();
      const ratesFromCategory = sizeRatesByCategory.get(catKey) || [];
      const ratesFromConfigId = sizeRatesByConfigId.get(item.id) || [];
      const combinedRates = ratesFromCategory.length ? ratesFromCategory : ratesFromConfigId;

      return {
        ...item,
        name: item.name || formatCategoryName(item.category),
        display_name: item.name || formatCategoryName(item.category),
        item_type: item.item_type || 'product',
        uom: item.uom || 'pcs',
        is_active: item.is_active !== undefined ? (item.is_active === 1 || item.is_active === true) : true,
        size_rates: combinedRates,
      };
    });

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
    let sizeRates: any[] = [];
    
    // Check product_size_rates first by category
    try {
      sizeRates = await query<any[]>(
        'SELECT * FROM product_size_rates WHERE category = ? AND tenant_id = ? ORDER BY id ASC',
        [item.category, tenantId]
      );
    } catch {}

    if (!sizeRates || sizeRates.length === 0) {
      try {
        sizeRates = await query<any[]>(
          'SELECT * FROM product_size_selling_rates WHERE product_config_id = ? AND tenant_id = ? ORDER BY id ASC',
          [item.id, tenantId]
        );
      } catch {}
    }

    res.json({
      ...item,
      name: item.name || formatCategoryName(item.category),
      display_name: item.name || formatCategoryName(item.category),
      item_type: item.item_type || 'product',
      uom: item.uom || 'pcs',
      is_active: item.is_active !== undefined ? (item.is_active === 1 || item.is_active === true) : true,
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
  const baseCategory = category ? category.trim().toLowerCase().replace(/\s+/g, '_') : (displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'item_' + Date.now());

  if (!displayName && !baseCategory) {
    res.status(400).json({ message: 'Item name is required' });
    return;
  }

  try {
    let finalCategory = baseCategory;
    let itemId: number | null = null;

    // Check if category already exists for this tenant
    const existing = await query<any[]>(
      'SELECT id, is_active FROM product_config WHERE category = ? AND tenant_id = ? LIMIT 1',
      [baseCategory, tenantId]
    );

    if (existing && existing.length > 0) {
      if (existing[0].is_active === 0) {
        // Re-activate and update the archived record
        itemId = existing[0].id;
        await query(
          `UPDATE product_config SET
            name = ?, item_code = ?, item_type = ?, uom = ?,
            selling_rate = ?, purchase_cost = ?, tax_rate = ?, hsn_code = ?, description = ?,
            fabric_cost = ?, lace_cost = ?, zip_cost = ?, thread_cost = ?,
            canvas_cost = ?, plastic_cost = ?, logistics_cost = ?, cut_rate = ?, stitch_rate = ?,
            is_active = 1
          WHERE id = ? AND tenant_id = ?`,
          [
            displayName || baseCategory, item_code || null, item_type, uom || 'pcs',
            Number(selling_rate) || 0, Number(purchase_cost) || 0, Number(tax_rate) || 0, hsn_code || null, description || null,
            Number(fabric_cost) || 0, Number(lace_cost) || 0, Number(zip_cost) || 0, Number(thread_cost) || 0,
            Number(canvas_cost) || 0, Number(plastic_cost) || 0, Number(logistics_cost) || 0, Number(cut_rate) || 0, Number(stitch_rate) || 0,
            itemId, tenantId
          ]
        );
      } else {
        // Active item already exists with this exact category: generate unique slug suffix
        finalCategory = `${baseCategory}_${Date.now().toString().slice(-4)}`;
      }
    }

    if (!itemId) {
      const insertRes: any = await query<any>(
        `INSERT INTO product_config (
          tenant_id, category, name, item_code, item_type, uom,
          selling_rate, purchase_cost, tax_rate, hsn_code, description,
          fabric_cost, lace_cost, zip_cost, thread_cost,
          canvas_cost, plastic_cost, logistics_cost, cut_rate, stitch_rate, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          tenantId, finalCategory, displayName || finalCategory, item_code || null, item_type, uom || 'pcs',
          Number(selling_rate) || 0, Number(purchase_cost) || 0, Number(tax_rate) || 0, hsn_code || null, description || null,
          Number(fabric_cost) || 0, Number(lace_cost) || 0, Number(zip_cost) || 0, Number(thread_cost) || 0,
          Number(canvas_cost) || 0, Number(plastic_cost) || 0, Number(logistics_cost) || 0, Number(cut_rate) || 0, Number(stitch_rate) || 0
        ]
      );

      itemId = insertRes?.insertId || (await query<any[]>('SELECT id FROM product_config WHERE category=? AND tenant_id=? LIMIT 1', [finalCategory, tenantId]))[0]?.id;
    }

    // Save size rates if provided into both tables
    if (Array.isArray(size_rates) && size_rates.length > 0 && itemId) {
      // Clear any previous size rates for this item
      try {
        await query('DELETE FROM product_size_selling_rates WHERE product_config_id = ? AND tenant_id = ?', [itemId, tenantId]);
      } catch {}
      try {
        await query('DELETE FROM product_size_rates WHERE category = ? AND tenant_id = ?', [finalCategory, tenantId]);
      } catch {}

      for (const sr of size_rates) {
        if (sr.size_label && String(sr.size_label).trim()) {
          const sRate = sr.selling_rate !== undefined && sr.selling_rate !== '' ? Number(sr.selling_rate) : (Number(selling_rate) || 0);
          try {
            await query(
              `INSERT INTO product_size_selling_rates (tenant_id, product_config_id, size_label, selling_rate)
               VALUES (?, ?, ?, ?)`,
              [tenantId, itemId, String(sr.size_label).trim(), sRate]
            );
          } catch (e) {
            console.error('Error inserting product_size_selling_rate:', e);
          }
          try {
            await query(
              `INSERT INTO product_size_rates (tenant_id, category, size_label, selling_rate)
               VALUES (?, ?, ?, ?)`,
              [tenantId, finalCategory, String(sr.size_label).trim(), sRate]
            );
          } catch {}
        }
      }
    }

    res.status(201).json({ id: itemId, message: 'Item created successfully' });
  } catch (error: any) {
    console.error('Error creating item:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ message: `An item with the name '${displayName || baseCategory}' already exists in your catalog.` });
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
      'SELECT id, category FROM product_config WHERE id = ? AND tenant_id = ? LIMIT 1',
      [id, tenantId]
    );

    if (!existing || existing.length === 0) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }

    const itemCat = existing[0].category;

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

    // Update size rates in both tables if explicitly provided
    if (Array.isArray(size_rates)) {
      try {
        await query('DELETE FROM product_size_selling_rates WHERE product_config_id = ? AND tenant_id = ?', [id, tenantId]);
      } catch {}
      try {
        await query('DELETE FROM product_size_rates WHERE category = ? AND tenant_id = ?', [itemCat, tenantId]);
      } catch {}

      for (const sr of size_rates) {
        if (sr.size_label && String(sr.size_label).trim()) {
          const sRate = sr.selling_rate !== undefined && sr.selling_rate !== '' ? Number(sr.selling_rate) : (Number(selling_rate) || 0);
          try {
            await query(
              `INSERT INTO product_size_selling_rates (tenant_id, product_config_id, size_label, selling_rate)
               VALUES (?, ?, ?, ?)`,
              [tenantId, id, String(sr.size_label).trim(), sRate]
            );
          } catch {}
          try {
            await query(
              `INSERT INTO product_size_rates (tenant_id, category, size_label, selling_rate)
               VALUES (?, ?, ?, ?)`,
              [tenantId, itemCat, String(sr.size_label).trim(), sRate]
            );
          } catch {}
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

    // Delete size rates from both tables and item config
    try {
      await query('DELETE FROM product_size_selling_rates WHERE product_config_id = ? AND tenant_id = ?', [id, tenantId]);
    } catch {}
    try {
      await query('DELETE FROM product_size_rates WHERE category = ? AND tenant_id = ?', [item.category, tenantId]);
    } catch {}
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
