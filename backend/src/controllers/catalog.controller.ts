import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { masterQuery } from '../config/masterDb';
import { getTenantPool } from '../config/tenantDbManager';
import { AuthRequest } from '../middleware/auth';

export const VALID_CATALOG_TYPES = ['wholesale', 'retail-vendor', 'retail-customer', 'uae-vendor'] as const;
export type CatalogType = typeof VALID_CATALOG_TYPES[number];

const TYPE_CONFIG: Record<string, { label: string; rateColumn: string; subtitle: string; badge: string }> = {
  'wholesale': {
    label: 'Wholesale Vendor Catalog',
    rateColumn: 'wholesale_rate',
    subtitle: 'Exclusive bulk supply pricing for wholesale distributors and B2B partners.',
    badge: '🏢 Wholesale'
  },
  'retail-vendor': {
    label: 'Retail Vendor Catalog',
    rateColumn: 'retail_vendor_rate',
    subtitle: 'Commercial dealer and boutique supply rates.',
    badge: '🏪 Retail Vendor'
  },
  'retail-customer': {
    label: 'Retail & E-Commerce Collection',
    rateColumn: 'retail_customer_rate',
    subtitle: 'Direct retail collection and seasonal styles.',
    badge: '🛍️ Retail / Online'
  },
  'uae-vendor': {
    label: 'UAE Vendor Catalog',
    rateColumn: 'uae_vendor_rate',
    subtitle: 'Exclusive export collection and wholesale rates for UAE partners.',
    badge: '🇦🇪 UAE Vendor Pricing'
  }
};

/**
 * Admin: List all catalog showcase products with cost & margin breakdown
 */
export async function getCatalogItems(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;
  const search = (req.query.search as string || '').trim();
  const category = (req.query.category as string || '').trim();
  const status = (req.query.status as string || '').trim(); // 'active', 'inactive', 'all'

  const conditions: string[] = ['tenant_id = ?'];
  const params: any[] = [tenantId];

  if (search) {
    conditions.push('(name LIKE ? OR item_code LIKE ? OR category LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }

  if (status === 'active') {
    conditions.push('is_active = 1');
  } else if (status === 'inactive') {
    conditions.push('is_active = 0');
  }

  const whereClause = conditions.join(' AND ');

  try {
    const [countRows, data, catRows, configCatRows] = await Promise.all([
      query<any[]>(`SELECT COUNT(*) AS total FROM product_showcase WHERE ${whereClause}`, params),
      query<any[]>(
        `SELECT id, tenant_id, name, item_code, category, description, image_url,
                product_cost, expense, wholesale_rate, retail_vendor_rate, retail_customer_rate, uae_vendor_rate,
                uom, is_active, created_at, updated_at,
                (product_cost + expense) AS total_cost,
                (wholesale_rate - (product_cost + expense)) AS wholesale_margin,
                (retail_vendor_rate - (product_cost + expense)) AS retail_vendor_margin,
                (retail_customer_rate - (product_cost + expense)) AS retail_customer_margin,
                (uae_vendor_rate - (product_cost + expense)) AS uae_vendor_margin
         FROM product_showcase 
         WHERE ${whereClause} 
         ORDER BY id DESC 
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      query<any[]>(
        `SELECT DISTINCT category FROM product_showcase WHERE tenant_id = ? AND category IS NOT NULL AND category != '' ORDER BY category ASC`,
        [tenantId]
      ),
      query<any[]>(
        `SELECT DISTINCT category FROM product_config WHERE tenant_id = ? AND category IS NOT NULL AND category != '' ORDER BY category ASC`,
        [tenantId]
      ).catch(() => [])
    ]);

    const total = countRows[0]?.total || 0;

    // Standard garment manufacturing & retail categories
    const defaultCategories = [
      'Salwar Suit',
      'Shawl Nighty',
      'Ordinary Nighty',
      'Kurti',
      'Cotton Fabric',
      'Western Wear',
      'Abaya / Burqa',
      'Gown / Frock',
      'Saree',
      'Dupatta',
      'Nightwear',
      'Kids Wear',
      'Bottom Wear',
      'Co-ord Set',
      'Kaftan'
    ];

    const catSet = new Set<string>();
    (catRows || []).forEach(r => r.category && catSet.add(r.category));
    (configCatRows || []).forEach(r => r.category && catSet.add(r.category));
    defaultCategories.forEach(c => catSet.add(c));
    const categories = Array.from(catSet).sort((a, b) => a.localeCompare(b));

    res.json({
      data,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
      categories
    });
  } catch (err) {
    console.error('getCatalogItems error:', err);
    res.status(500).json({ message: 'Failed to fetch catalog items', error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Admin: Get single catalog item
 */
export async function getCatalogItemById(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    const rows = await query<any[]>(
      `SELECT *, (product_cost + expense) AS total_cost FROM product_showcase WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [id, tenantId]
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({ message: 'Catalog product not found' });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('getCatalogItemById error:', err);
    res.status(500).json({ message: 'Server error', error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Admin: Create new showcase product
 */
export async function createCatalogItem(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const {
    name, item_code, category, description, image_url,
    product_cost, expense, wholesale_rate, retail_vendor_rate, retail_customer_rate, uae_vendor_rate,
    uom = 'pcs', is_active = true
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ message: 'Product / Design name is required' });
    return;
  }

  const costVal = Math.max(0, parseFloat(product_cost) || 0);
  const expenseVal = Math.max(0, parseFloat(expense) || 0);
  const wsRate = Math.max(0, parseFloat(wholesale_rate) || 0);
  const rvRate = Math.max(0, parseFloat(retail_vendor_rate) || 0);
  const rcRate = Math.max(0, parseFloat(retail_customer_rate) || 0);
  const uaeRate = Math.max(0, parseFloat(uae_vendor_rate) || 0);

  try {
    const result = await query<any>(
      `INSERT INTO product_showcase (
        tenant_id, name, item_code, category, description, image_url,
        product_cost, expense, wholesale_rate, retail_vendor_rate, retail_customer_rate, uae_vendor_rate,
        uom, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        name.trim(),
        item_code ? item_code.trim() : null,
        category ? category.trim() : null,
        description ? description.trim() : null,
        image_url || null,
        costVal,
        expenseVal,
        wsRate,
        rvRate,
        rcRate,
        uaeRate,
        uom || 'pcs',
        is_active ? 1 : 0
      ]
    );

    const insertedId = result.insertId;
    const rows = await query<any[]>(
      `SELECT *, (product_cost + expense) AS total_cost FROM product_showcase WHERE id = ? AND tenant_id = ?`,
      [insertedId, tenantId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createCatalogItem error:', err);
    res.status(500).json({ message: 'Failed to create product showcase item', error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Admin: Update showcase product
 */
export async function updateCatalogItem(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;
  const {
    name, item_code, category, description, image_url,
    product_cost, expense, wholesale_rate, retail_vendor_rate, retail_customer_rate, uae_vendor_rate,
    uom, is_active
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ message: 'Product / Design name is required' });
    return;
  }

  const costVal = Math.max(0, parseFloat(product_cost) || 0);
  const expenseVal = Math.max(0, parseFloat(expense) || 0);
  const wsRate = Math.max(0, parseFloat(wholesale_rate) || 0);
  const rvRate = Math.max(0, parseFloat(retail_vendor_rate) || 0);
  const rcRate = Math.max(0, parseFloat(retail_customer_rate) || 0);
  const uaeRate = Math.max(0, parseFloat(uae_vendor_rate) || 0);

  try {
    await query(
      `UPDATE product_showcase 
       SET name = ?, item_code = ?, category = ?, description = ?, image_url = ?,
           product_cost = ?, expense = ?, wholesale_rate = ?, retail_vendor_rate = ?, retail_customer_rate = ?, uae_vendor_rate = ?,
           uom = ?, is_active = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        name.trim(),
        item_code ? item_code.trim() : null,
        category ? category.trim() : null,
        description ? description.trim() : null,
        image_url !== undefined ? image_url : null,
        costVal,
        expenseVal,
        wsRate,
        rvRate,
        rcRate,
        uaeRate,
        uom || 'pcs',
        is_active ? 1 : 0,
        id,
        tenantId
      ]
    );

    const rows = await query<any[]>(
      `SELECT *, (product_cost + expense) AS total_cost FROM product_showcase WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('updateCatalogItem error:', err);
    res.status(500).json({ message: 'Failed to update catalog item', error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Admin: Delete showcase product
 */
export async function deleteCatalogItem(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const { id } = req.params;

  try {
    const result = await query<any>(
      `DELETE FROM product_showcase WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.json({ success: true, message: 'Product deleted from showcase' });
  } catch (err) {
    console.error('deleteCatalogItem error:', err);
    res.status(500).json({ message: 'Failed to delete catalog item', error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Public: Get customer / vendor catalog without authentication
 * Protects business confidentiality: NEVER returns product_cost or expense.
 * Rate mapped according to :type ('wholesale', 'retail-vendor', 'retail-customer').
 */
export async function getPublicShowcase(req: Request, res: Response): Promise<void> {
  const { type } = req.params;
  const config = TYPE_CONFIG[type];

  if (!config) {
    res.status(400).json({
      message: `Invalid catalog type '${type}'. Valid types are: ${VALID_CATALOG_TYPES.join(', ')}`
    });
    return;
  }

  const tenantSlugOrId = (req.query.tenant_id as string || req.query.tenant_slug as string || req.query.tenant as string || '1').trim();
  const search = (req.query.search as string || '').trim();
  const category = (req.query.category as string || '').trim();

  // Requirement 2: Put wholesale, retail-vendor, and retail-customer behind authentication so UAE vendor only sees their link
  if (type !== 'uae-vendor') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        message: 'Authentication required. This catalog tier is restricted to authorized partners and staff. Please sign in to continue.',
        requiresAuth: true
      });
      return;
    }
    try {
      const token = authHeader.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch {
      res.status(401).json({
        message: 'Invalid or expired session. Please sign in to access this catalog.',
        requiresAuth: true
      });
      return;
    }
  }

  try {
    // Resolve tenant details
    let targetTenantId = 1;
    let targetDbName = process.env.DB_NAME || 'viva_studio_erp';
    let companyName = 'Viva Studio';
    let currency = 'INR';
    let currencySymbol = '₹';
    let logoUrl: string | null = '/logo.png';
    let phone: string | null = null;

    try {
      const isNum = /^\d+$/.test(tenantSlugOrId);
      const masterTenants = await masterQuery<any[]>(
        `SELECT id, name, slug, db_name, currency, country, logo_url 
         FROM master_tenants 
         WHERE ${isNum ? 'id = ?' : 'slug = ?'} LIMIT 1`,
        [tenantSlugOrId]
      );

      if (masterTenants && masterTenants.length > 0) {
        const mt = masterTenants[0];
        targetTenantId = mt.id;
        targetDbName = mt.db_name || targetDbName;
        companyName = mt.name || companyName;
        currency = mt.currency || currency;
        currencySymbol = currency === 'SAR' ? 'SAR ' : currency === 'USD' ? '$' : '₹';
        logoUrl = mt.logo_url || logoUrl;
      } else {
        const tenantRows = await query<any[]>(
          `SELECT id, name FROM tenants WHERE id = ? LIMIT 1`,
          [isNum ? parseInt(tenantSlugOrId) : 1]
        );
        if (tenantRows && tenantRows.length > 0) {
          targetTenantId = tenantRows[0].id;
          companyName = tenantRows[0].name;
        }
      }
    } catch {
      // Fallback to default
    }

    // Requirement 4: UAE vendor feature is only for Viva Studio, other tenants cannot view it
    if (type === 'uae-vendor') {
      const isViva = targetTenantId === 1 || tenantSlugOrId === 'viva_studio' || companyName.toLowerCase().includes('viva');
      if (!isViva) {
        res.status(403).json({ message: 'UAE Vendor Catalog is exclusively available for Viva Studio.' });
        return;
      }
      // Force UAE Dirhams currency & symbol
      currency = 'AED';
      currencySymbol = 'AED ';
    }

    // Query the tenant pool
    const pool = getTenantPool(targetDbName);

    const conditions: string[] = ['tenant_id = ?', 'is_active = 1'];
    const params: any[] = [targetTenantId];

    if (search) {
      conditions.push('(name LIKE ? OR item_code LIKE ? OR category LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }

    const whereClause = conditions.join(' AND ');

    // Only select the rate corresponding to this vendor / customer tier
    const [products, catRows] = await Promise.all([
      pool.query<any[]>(
        `SELECT id, name, item_code, category, description, image_url,
                ${config.rateColumn} AS rate, uom, created_at
         FROM product_showcase
         WHERE ${whereClause}
         ORDER BY id DESC`,
        params
      ),
      pool.query<any[]>(
        `SELECT DISTINCT category 
         FROM product_showcase 
         WHERE tenant_id = ? AND is_active = 1 AND category IS NOT NULL AND category != '' 
         ORDER BY category ASC`,
        [targetTenantId]
      )
    ]);

    const productList = (products[0] || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      item_code: p.item_code,
      category: p.category,
      description: p.description,
      image_url: p.image_url,
      rate: Number(p.rate || 0),
      uom: p.uom || 'pcs'
    }));

    const categories = (catRows[0] || []).map((r: any) => r.category);

    res.json({
      tenant: {
        id: targetTenantId,
        name: companyName,
        currency,
        currency_symbol: currencySymbol,
        logo_url: logoUrl,
        phone
      },
      tier: {
        type,
        label: config.label,
        subtitle: config.subtitle,
        badge: config.badge
      },
      categories,
      products: productList,
      total: productList.length
    });
  } catch (err) {
    console.error('getPublicShowcase error:', err);
    res.status(500).json({ message: 'Failed to load product catalog', error: err instanceof Error ? err.message : String(err) });
  }
}
