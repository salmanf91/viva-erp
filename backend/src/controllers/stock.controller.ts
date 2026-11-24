import { Response } from 'express';
import { query } from '../config/db';
import { AuthRequest } from '../middleware/auth';

export async function getStockSummary(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const safe = <T>(p: Promise<T>, fallback: any = []): Promise<T> => p.catch((err) => {
    console.warn('getStockSummary subquery error:', err?.message || err);
    return fallback;
  });

  try {
    // 1. Total raw fabric received per category (canonical purchase_items + direct manual stock_movements)
    const received = await safe(query<any[]>(
      `SELECT 
         category, 
         SUM(quantity) AS qty
       FROM (
         SELECT
           (CASE 
             WHEN LOWER(pi.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(pi.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN pi.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN pi.category = '' OR pi.category IS NULL OR LOWER(pi.category) = 'mixed' THEN 'Mixed Fabric'
             ELSE TRIM(pi.category)
           END) COLLATE utf8mb4_unicode_ci AS category,
           pi.quantity
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         WHERE (p.tenant_id = ? OR p.tenant_id IS NULL)
         UNION ALL
         SELECT 
           (CASE 
             WHEN LOWER(sm.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(sm.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN sm.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN sm.category = '' OR sm.category IS NULL OR LOWER(sm.category) = 'mixed' THEN 'Mixed Fabric'
             ELSE TRIM(sm.category)
           END) COLLATE utf8mb4_unicode_ci AS category, 
           sm.quantity
         FROM stock_movements sm
         WHERE (sm.tenant_id = ? OR sm.tenant_id IS NULL) AND sm.type='in' AND (sm.reference IS NULL OR sm.reference NOT LIKE 'PUR-%')
       ) t
       GROUP BY category`,
      [tenantId, tenantId]
    ));

    // 2. Fabric in active production (tracked from active production_batches + direct manual allocations)
    let allocated: any[] = [];
    try {
      allocated = await query<any[]>(
        `SELECT 
           category,
           SUM(qty) AS qty
         FROM (
           SELECT 
             (CASE 
               WHEN LOWER(sm.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
               WHEN LOWER(sm.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
               WHEN sm.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
               WHEN sm.category = '' OR sm.category IS NULL OR LOWER(sm.category) = 'mixed' THEN 'Mixed Fabric'
               ELSE TRIM(sm.category)
             END) COLLATE utf8mb4_unicode_ci AS category,
             sm.quantity AS qty
           FROM stock_movements sm
           WHERE (sm.tenant_id = ? OR sm.tenant_id IS NULL) 
             AND sm.type = 'allocated'
             AND (sm.reference IS NULL OR (sm.reference NOT LIKE 'BATCH-%' AND sm.reference NOT LIKE '%(Fabric Issued%'))
           UNION ALL
           SELECT
             (CASE 
               WHEN pb.raw_material_name IS NOT NULL AND TRIM(pb.raw_material_name) != '' THEN TRIM(pb.raw_material_name)
               WHEN LOWER(pb.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
               WHEN LOWER(pb.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
               WHEN pb.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
               WHEN pb.category = '' OR pb.category IS NULL OR LOWER(pb.category) = 'mixed' THEN 'Mixed Fabric'
               ELSE TRIM(pb.category)
             END) COLLATE utf8mb4_unicode_ci AS category,
             COALESCE(NULLIF(pb.raw_quantity_used, 0), pb.quantity, 0) AS qty
           FROM production_batches pb
           WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
             AND (LOWER(COALESCE(pb.status, 'active')) NOT IN ('finished', 'completed', 'delivered'))
         ) a
         GROUP BY category`,
        [tenantId, tenantId]
      );
    } catch {
      allocated = await safe(query<any[]>(
        `SELECT 
           category,
           SUM(qty) AS qty
         FROM (
           SELECT 
             (CASE 
               WHEN LOWER(sm.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
               WHEN LOWER(sm.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
               WHEN sm.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
               WHEN sm.category = '' OR sm.category IS NULL OR LOWER(sm.category) = 'mixed' THEN 'Mixed Fabric'
               ELSE TRIM(sm.category)
             END) COLLATE utf8mb4_unicode_ci AS category,
             sm.quantity AS qty
           FROM stock_movements sm
           WHERE (sm.tenant_id = ? OR sm.tenant_id IS NULL) 
             AND sm.type = 'allocated'
             AND (sm.reference IS NULL OR (sm.reference NOT LIKE 'BATCH-%' AND sm.reference NOT LIKE '%(Fabric Issued%'))
           UNION ALL
           SELECT
             (CASE 
               WHEN LOWER(pb.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
               WHEN LOWER(pb.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
               WHEN pb.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
               WHEN pb.category = '' OR pb.category IS NULL OR LOWER(pb.category) = 'mixed' THEN 'Mixed Fabric'
               ELSE TRIM(pb.category)
             END) COLLATE utf8mb4_unicode_ci AS category,
             COALESCE(NULLIF(pb.raw_quantity_used, 0), pb.quantity, 0) AS qty
           FROM production_batches pb
           WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
             AND (LOWER(COALESCE(pb.status, 'active')) NOT IN ('finished', 'completed', 'delivered'))
         ) a
         GROUP BY category`,
        [tenantId, tenantId]
      ), []);
    }

    // 3. Finished goods produced per raw material category
    const finished = await safe(query<any[]>(
      `SELECT
         t.category,
         SUM(t.qty) AS qty
       FROM (
         SELECT
           (CASE 
             WHEN pb.raw_material_name IS NOT NULL AND TRIM(pb.raw_material_name) != '' THEN TRIM(pb.raw_material_name)
             WHEN LOWER(pb.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(pb.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN pb.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN pb.category = '' OR pb.category IS NULL OR LOWER(pb.category) = 'mixed' THEN 'Mixed Fabric'
             ELSE TRIM(pb.category)
           END) COLLATE utf8mb4_unicode_ci AS category,
           COALESCE(pb.quantity, 0) AS qty
         FROM production_batches pb
         WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
           AND (LOWER(COALESCE(pb.status, '')) IN ('finished', 'completed', 'delivered'))
       ) t
       GROUP BY t.category`,
      [tenantId]
    ));

    // 4. Shawl nighty sub-breakdown: lace vs plain in active production
    const shawlBreakdown = await safe(query<any[]>(
      `SELECT
         COALESCE(NULLIF(pb.category, ''), 'shawl_nighty') AS category,
         SUM(COALESCE(pb.quantity, 0)) AS qty
       FROM production_batches pb
       WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
         AND (LOWER(COALESCE(pb.status, 'active')) NOT IN ('finished', 'completed', 'delivered')) 
         AND pb.category IN ('shawl_nighty', 'shawl_nighty_lace')
       GROUP BY pb.category`,
      [tenantId]
    ));

    // 5. Finished goods breakdown by product, code, size, and price
    const [configs, sizeRates, producedBreakdown, soldBreakdown] = await Promise.all([
      safe(query<any[]>(`SELECT id, category, name, item_code, selling_rate, uom FROM product_config WHERE tenant_id = ?`, [tenantId]), []),
      safe(query<any[]>(`SELECT category, size_label, selling_rate FROM product_size_rates WHERE tenant_id = ?`, [tenantId]), []),
      safe(query<any[]>(
        `SELECT
           COALESCE(NULLIF(TRIM(pbi.item_code), ''), NULLIF(TRIM(pc.item_code), '')) AS item_code,
           COALESCE(NULLIF(TRIM(pbi.product_name), ''), NULLIF(TRIM(pc.name), ''), pbi.category, pb.category) AS product_name,
           (CASE
             WHEN LOWER(COALESCE(pbi.category, pb.category, '')) LIKE '%salwar%' OR LOWER(COALESCE(pbi.product_name, pc.name, '')) LIKE '%salwar%' THEN 'salwar_suit'
             WHEN LOWER(COALESCE(pbi.category, pb.category, '')) LIKE '%nighty%' OR LOWER(COALESCE(pbi.product_name, pc.name, '')) LIKE '%nighty%' THEN 'ordinary_nighty'
             ELSE COALESCE(NULLIF(pbi.category, ''), pb.category)
           END) AS category,
           COALESCE(NULLIF(TRIM(pbi.size), ''), NULLIF(TRIM(pbi.size_label), ''), 'Free Size') AS size,
           MAX(COALESCE(pbi.selling_rate, pc.selling_rate, 0)) AS selling_rate,
           SUM(COALESCE(NULLIF(pbi.quantity, 0), pb.quantity, 0)) AS produced_qty
         FROM production_batches pb
         LEFT JOIN production_batch_items pbi ON pbi.batch_id = pb.id
         LEFT JOIN product_config pc ON (pbi.product_id = pc.id OR (pc.tenant_id = ? AND LOWER(TRIM(pc.category)) = LOWER(TRIM(COALESCE(pbi.category, pb.category)))))
         WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
           AND (LOWER(COALESCE(pb.status, '')) IN ('finished', 'completed', 'delivered'))
         GROUP BY 
           COALESCE(NULLIF(TRIM(pbi.item_code), ''), NULLIF(TRIM(pc.item_code), '')),
           COALESCE(NULLIF(TRIM(pbi.product_name), ''), NULLIF(TRIM(pc.name), ''), pbi.category, pb.category),
           (CASE
             WHEN LOWER(COALESCE(pbi.category, pb.category, '')) LIKE '%salwar%' OR LOWER(COALESCE(pbi.product_name, pc.name, '')) LIKE '%salwar%' THEN 'salwar_suit'
             WHEN LOWER(COALESCE(pbi.category, pb.category, '')) LIKE '%nighty%' OR LOWER(COALESCE(pbi.product_name, pc.name, '')) LIKE '%nighty%' THEN 'ordinary_nighty'
             ELSE COALESCE(NULLIF(pbi.category, ''), pb.category)
           END),
           COALESCE(NULLIF(TRIM(pbi.size), ''), NULLIF(TRIM(pbi.size_label), ''), 'Free Size')`,
        [tenantId, tenantId]
      ), []),
      safe(query<any[]>(
        `SELECT
           COALESCE(NULLIF(TRIM(i.item_code), ''), NULLIF(TRIM(pc.item_code), '')) AS item_code,
           COALESCE(NULLIF(TRIM(i.item_name), ''), NULLIF(TRIM(pc.name), ''), i.category) AS product_name,
           (CASE
             WHEN LOWER(COALESCE(i.category, '')) LIKE '%salwar%' OR LOWER(COALESCE(i.item_name, '')) LIKE '%salwar%' THEN 'salwar_suit'
             WHEN LOWER(COALESCE(i.category, '')) LIKE '%nighty%' OR LOWER(COALESCE(i.item_name, '')) LIKE '%nighty%' THEN 'ordinary_nighty'
             ELSE i.category
           END) AS category,
           COALESCE(NULLIF(TRIM(i.size), ''), 'Free Size') AS size,
           MAX(COALESCE(i.rate_per_pc, pc.selling_rate, 0)) AS selling_rate,
           SUM(i.quantity) AS sold_qty
         FROM sales_order_items i
         JOIN sales_orders o ON o.id = i.order_id
         LEFT JOIN product_config pc ON (i.product_id = pc.id OR (pc.tenant_id = ? AND LOWER(TRIM(pc.category)) = LOWER(TRIM(i.category))))
         WHERE (o.tenant_id = ? OR o.tenant_id IS NULL)
         GROUP BY 
           COALESCE(NULLIF(TRIM(i.item_code), ''), NULLIF(TRIM(pc.item_code), '')),
           COALESCE(NULLIF(TRIM(i.item_name), ''), NULLIF(TRIM(pc.name), ''), i.category),
           (CASE
             WHEN LOWER(COALESCE(i.category, '')) LIKE '%salwar%' OR LOWER(COALESCE(i.item_name, '')) LIKE '%salwar%' THEN 'salwar_suit'
             WHEN LOWER(COALESCE(i.category, '')) LIKE '%nighty%' OR LOWER(COALESCE(i.item_name, '')) LIKE '%nighty%' THEN 'ordinary_nighty'
             ELSE i.category
           END),
           COALESCE(NULLIF(TRIM(i.size), ''), 'Free Size')`,
        [tenantId, tenantId]
      ), [])
    ]);

    const configByCat = new Map<string, any>();
    for (const c of configs) {
      if (c.category) configByCat.set(c.category.toLowerCase().trim(), c);
    }

    const sizeRateMap = new Map<string, number>();
    for (const sr of sizeRates) {
      sizeRateMap.set(`${(sr.category || '').toLowerCase().trim()}__${(sr.size_label || '').toLowerCase().trim()}`, Number(sr.selling_rate || 0));
    }

    const breakdownMap = new Map<string, any>();
    const byCodeAndSize = new Map<string, any>();
    const byNameAndSize = new Map<string, any>();
    const byCatAndSize  = new Map<string, any[]>();
    const byCodeList    = new Map<string, any[]>();
    const byNameList    = new Map<string, any[]>();
    const byCatList     = new Map<string, any[]>();

    for (const r of producedBreakdown) {
      const catKey = (r.category || '').toLowerCase().trim();
      const sizeKey = (r.size || 'free size').toLowerCase().trim();
      const codeKey = (r.item_code || '').toLowerCase().trim();
      const nameKey = (r.product_name || '').toLowerCase().trim();
      const primaryKey = `${codeKey || catKey || nameKey}__${sizeKey}`;

      const cfg = configByCat.get(catKey);
      const configuredRate = sizeRateMap.get(`${catKey}__${sizeKey}`);
      const sellingPrice = Number(r.selling_rate || configuredRate || cfg?.selling_rate || 0);

      const entry = {
        item_code: r.item_code || cfg?.item_code || null,
        product_name: r.product_name || cfg?.name || r.category,
        category: r.category,
        size: r.size,
        selling_rate: sellingPrice,
        price: sellingPrice,
        produced_qty: Number(r.produced_qty || 0),
        sold_qty: 0,
        on_hand_qty: Number(r.produced_qty || 0),
        qty: Number(r.produced_qty || 0),
        inventory_value: Number(r.produced_qty || 0) * sellingPrice
      };

      breakdownMap.set(primaryKey, entry);
      if (codeKey) {
        byCodeAndSize.set(`${codeKey}__${sizeKey}`, entry);
        if (!byCodeList.has(codeKey)) byCodeList.set(codeKey, []);
        byCodeList.get(codeKey)!.push(entry);
      }
      if (nameKey) {
        byNameAndSize.set(`${nameKey}__${sizeKey}`, entry);
        if (!byNameList.has(nameKey)) byNameList.set(nameKey, []);
        byNameList.get(nameKey)!.push(entry);
      }
      if (!byCatAndSize.has(`${catKey}__${sizeKey}`)) byCatAndSize.set(`${catKey}__${sizeKey}`, []);
      byCatAndSize.get(`${catKey}__${sizeKey}`)!.push(entry);
      if (!byCatList.has(catKey)) byCatList.set(catKey, []);
      byCatList.get(catKey)!.push(entry);
    }

    for (const s of soldBreakdown) {
      const catKey = (s.category || '').toLowerCase().trim();
      const sizeKey = (s.size || 'free size').toLowerCase().trim();
      const codeKey = (s.item_code || '').toLowerCase().trim();
      const nameKey = (s.product_name || '').toLowerCase().trim();
      let remainingSold = Number(s.sold_qty || 0);

      // 1. Try exact match by code+size, name+size, or cat+size
      let exactItem: any = null;
      if (codeKey && byCodeAndSize.has(`${codeKey}__${sizeKey}`)) {
        exactItem = byCodeAndSize.get(`${codeKey}__${sizeKey}`);
      } else if (nameKey && byNameAndSize.has(`${nameKey}__${sizeKey}`)) {
        exactItem = byNameAndSize.get(`${nameKey}__${sizeKey}`);
      } else if (byCatAndSize.has(`${catKey}__${sizeKey}`)) {
        const candidates = byCatAndSize.get(`${catKey}__${sizeKey}`)!;
        exactItem = candidates.find(c => c.on_hand_qty > 0) || candidates[0];
      } else if (breakdownMap.has(`${codeKey || catKey || nameKey}__${sizeKey}`)) {
        exactItem = breakdownMap.get(`${codeKey || catKey || nameKey}__${sizeKey}`);
      }

      if (exactItem) {
        exactItem.sold_qty += remainingSold;
        exactItem.on_hand_qty = Math.max(0, exactItem.produced_qty - exactItem.sold_qty);
        exactItem.qty = exactItem.on_hand_qty;
        if (!exactItem.item_code && (s.item_code || codeKey)) exactItem.item_code = s.item_code || codeKey;
        exactItem.inventory_value = exactItem.on_hand_qty * (exactItem.selling_rate || exactItem.price || 0);
        remainingSold = 0;
      } else {
        // 2. Flexible size match: find candidates of the same product with available stock
        let candidates: any[] = [];
        if (codeKey && byCodeList.has(codeKey)) {
          candidates = byCodeList.get(codeKey)!;
        } else if (nameKey && byNameList.has(nameKey)) {
          candidates = byNameList.get(nameKey)!;
        } else if (byCatList.has(catKey)) {
          candidates = byCatList.get(catKey)!;
        } else if (catKey.includes('salwar')) {
          candidates = Array.from(breakdownMap.values()).filter(it =>
            (it.category || '').toLowerCase().includes('salwar') ||
            (it.product_name || '').toLowerCase().includes('salwar')
          );
        } else if (catKey.includes('nighty')) {
          candidates = Array.from(breakdownMap.values()).filter(it =>
            (it.category || '').toLowerCase().includes('nighty') ||
            (it.product_name || '').toLowerCase().includes('nighty')
          );
        }

        // Deduct from available candidates
        for (const cand of candidates) {
          if (remainingSold <= 0) break;
          if (cand.on_hand_qty > 0) {
            const deduct = Math.min(cand.on_hand_qty, remainingSold);
            cand.sold_qty += deduct;
            cand.on_hand_qty = Math.max(0, cand.produced_qty - cand.sold_qty);
            cand.qty = cand.on_hand_qty;
            cand.inventory_value = cand.on_hand_qty * (cand.selling_rate || cand.price || 0);
            remainingSold -= deduct;
          }
        }

        // If candidates exist but remainingSold still > 0, allocate to primary candidate
        if (remainingSold > 0 && candidates.length > 0) {
          const primaryCand = candidates[0];
          primaryCand.sold_qty += remainingSold;
          primaryCand.on_hand_qty = Math.max(0, primaryCand.produced_qty - primaryCand.sold_qty);
          primaryCand.qty = primaryCand.on_hand_qty;
          primaryCand.inventory_value = primaryCand.on_hand_qty * (primaryCand.selling_rate || primaryCand.price || 0);
          remainingSold = 0;
        }
      }

      // If no candidate exists at all in produced stock, record as unmatched sold item
      if (remainingSold > 0) {
        const cfg = configByCat.get(catKey);
        const configuredRate = sizeRateMap.get(`${catKey}__${sizeKey}`);
        const sellingPrice = Number(s.selling_rate || configuredRate || cfg?.selling_rate || 0);
        const primaryKey = `${codeKey || catKey || nameKey}__${sizeKey}`;
        breakdownMap.set(primaryKey, {
          item_code: s.item_code || cfg?.item_code || null,
          product_name: s.product_name || cfg?.name || s.category,
          category: s.category,
          size: s.size,
          selling_rate: sellingPrice,
          price: sellingPrice,
          produced_qty: 0,
          sold_qty: remainingSold,
          on_hand_qty: 0,
          qty: 0,
          inventory_value: 0
        });
      }
    }
    const finishedBreakdown = Array.from(breakdownMap.values());

    // 6. Sold goods mapped to raw material category (linking products to their source raw materials)
    const [batchRawMappings, rawMaterialsList] = await Promise.all([
      safe(query<any[]>(
        `SELECT
           pb.id,
           LOWER(TRIM(COALESCE(NULLIF(TRIM(pbi.item_code), ''), NULLIF(TRIM(pc.item_code), ''), ''))) AS item_code,
           LOWER(TRIM(COALESCE(NULLIF(TRIM(pbi.product_name), ''), NULLIF(TRIM(pc.name), ''), ''))) AS product_name,
           LOWER(TRIM(COALESCE(NULLIF(TRIM(pbi.category), ''), pb.category, ''))) AS category,
           TRIM(pb.raw_material_name) AS raw_material_name,
           LOWER(COALESCE(pb.status, '')) AS status
         FROM production_batches pb
         LEFT JOIN production_batch_items pbi ON pbi.batch_id = pb.id
         LEFT JOIN product_config pc ON (pbi.product_id = pc.id OR (pc.tenant_id = ? AND LOWER(TRIM(pc.category)) = LOWER(TRIM(COALESCE(pbi.category, pb.category)))))
         WHERE (pb.tenant_id = ? OR pb.tenant_id IS NULL)
           AND pb.raw_material_name IS NOT NULL AND TRIM(pb.raw_material_name) != ''
         ORDER BY (CASE WHEN LOWER(COALESCE(pb.status, '')) IN ('finished', 'completed', 'delivered') THEN 1 ELSE 2 END) ASC, pb.id DESC`,
        [tenantId, tenantId]
      ), []),
      safe(query<any[]>(
        `SELECT id, name, code, uom, default_rate FROM raw_materials WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_active=1 ORDER BY id ASC`,
        [tenantId]
      ), [])
    ]);

    const rawMatByCode = new Map<string, string>();
    const rawMatByName = new Map<string, string>();
    const rawMatByCat  = new Map<string, string>();
    const finishedRmByCat = new Map<string, string>();

    for (const b of batchRawMappings) {
      if (b.raw_material_name) {
        const isFin = ['finished', 'completed', 'delivered'].includes(b.status);
        if (b.item_code && !rawMatByCode.has(b.item_code)) rawMatByCode.set(b.item_code, b.raw_material_name);
        if (b.product_name && !rawMatByName.has(b.product_name)) rawMatByName.set(b.product_name, b.raw_material_name);
        if (b.category && !rawMatByCat.has(b.category)) rawMatByCat.set(b.category, b.raw_material_name);

        if (isFin) {
          if (b.item_code && !finishedRmByCat.has(b.item_code)) finishedRmByCat.set(b.item_code, b.raw_material_name);
          if (b.product_name && !finishedRmByCat.has(b.product_name)) finishedRmByCat.set(b.product_name, b.raw_material_name);
          if (b.category && !finishedRmByCat.has(b.category)) finishedRmByCat.set(b.category, b.raw_material_name);
        }
      }
    }

    const soldOrderItems = await safe(query<any[]>(
      `SELECT
         COALESCE(NULLIF(TRIM(i.item_code), ''), NULLIF(TRIM(pc.item_code), '')) AS item_code,
         COALESCE(NULLIF(TRIM(i.item_name), ''), NULLIF(TRIM(pc.name), '')) AS item_name,
         i.category,
         i.quantity AS qty
       FROM sales_order_items i
       JOIN sales_orders o ON o.id = i.order_id
       LEFT JOIN product_config pc ON (i.product_id = pc.id OR (pc.tenant_id = ? AND LOWER(TRIM(pc.category)) = LOWER(TRIM(i.category))))
       WHERE (o.tenant_id = ? OR o.tenant_id IS NULL)`,
      [tenantId, tenantId]
    ), []);

    const soldByRawMat = new Map<string, number>();
    for (const s of soldOrderItems) {
      const code = (s.item_code || '').toLowerCase().trim();
      const name = (s.item_name || '').toLowerCase().trim();
      const cat  = (s.category || '').toLowerCase().trim();
      const qty  = Number(s.qty || 0);

      let mappedRm = '';
      // 1. Check direct finished batch mapping
      if (code && finishedRmByCat.has(code)) {
        mappedRm = finishedRmByCat.get(code)!;
      } else if (name && finishedRmByCat.has(name)) {
        mappedRm = finishedRmByCat.get(name)!;
      } else if (cat && finishedRmByCat.has(cat)) {
        mappedRm = finishedRmByCat.get(cat)!;
      }
      // 2. Check general batch mapping
      else if (code && rawMatByCode.has(code)) {
        mappedRm = rawMatByCode.get(code)!;
      } else if (name && rawMatByName.has(name)) {
        mappedRm = rawMatByName.get(name)!;
      } else if (cat && rawMatByCat.has(cat)) {
        mappedRm = rawMatByCat.get(cat)!;
      }
      // 3. Fallback to finished stock in hand
      else if (finished && finished.length > 0) {
        const candidate = finished.find(f => (f.category || '').toLowerCase().includes(cat) || cat.includes((f.category || '').toLowerCase()))
          || finished[0];
        mappedRm = candidate.category;
      }
      // 4. Default fallback
      else {
        mappedRm = rawMaterialsList[0]?.name || 'Mixed Fabric';
      }

      soldByRawMat.set(mappedRm, (soldByRawMat.get(mappedRm) || 0) + qty);
    }
    const sold = Array.from(soldByRawMat.entries()).map(([category, qty]) => ({ category, qty }));

    // 7. Itemized sales dispatches log (with product name, code, size, price)
    const soldDetailsRaw = await safe(query<any[]>(
      `SELECT 
         o.id AS order_id,
         o.invoice_number,
         o.order_date,
         COALESCE(c.name, 'Direct Client') AS client_name,
         COALESCE(i.item_code, pc.item_code) AS item_code,
         COALESCE(i.item_name, pc.name, i.category) AS item_name,
         i.category,
         i.size,
         (CASE
           WHEN LOWER(COALESCE(i.category, '')) LIKE '%salwar%' OR LOWER(COALESCE(i.item_name, '')) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
           WHEN LOWER(COALESCE(i.category, '')) LIKE '%nighty%' OR LOWER(COALESCE(i.item_name, '')) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
           ELSE 'Mixed Fabric'
         END) AS raw_material_name,
         i.quantity,
         i.rate_per_pc,
         (i.quantity * i.rate_per_pc) AS total_amount,
         o.status
       FROM sales_order_items i
       JOIN sales_orders o ON o.id = i.order_id
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN product_config pc ON (i.product_id = pc.id OR (pc.tenant_id = ? AND LOWER(TRIM(pc.category)) = LOWER(TRIM(i.category))))
       WHERE (o.tenant_id = ? OR o.tenant_id IS NULL)
       ORDER BY o.order_date DESC, o.id DESC`,
      [tenantId, tenantId]
    ), []);

    const soldDetails = soldDetailsRaw.map((item: any) => {
      const code = (item.item_code || '').toLowerCase().trim();
      const name = (item.item_name || '').toLowerCase().trim();
      const cat  = (item.category || '').toLowerCase().trim();
      let rm = '';
      if (code && finishedRmByCat.has(code)) rm = finishedRmByCat.get(code)!;
      else if (name && finishedRmByCat.has(name)) rm = finishedRmByCat.get(name)!;
      else if (cat && finishedRmByCat.has(cat)) rm = finishedRmByCat.get(cat)!;
      else if (code && rawMatByCode.has(code)) rm = rawMatByCode.get(code)!;
      else if (name && rawMatByName.has(name)) rm = rawMatByName.get(name)!;
      else if (cat && rawMatByCat.has(cat)) rm = rawMatByCat.get(cat)!;
      else if (finished && finished.length > 0) rm = finished[0].category;
      else rm = item.raw_material_name || rawMaterialsList[0]?.name || 'Mixed Fabric';
      return { ...item, raw_material_name: rm };
    });

    // 8. Active raw materials master list
    const rawMaterials = rawMaterialsList;

    res.json({ received, allocated, finished, shawlBreakdown, finishedBreakdown, sold, soldDetails, rawMaterials });
  } catch (error) {
    console.error('getStockSummary error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function getStockByVendor(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  try {
    const rows = await query(
      `SELECT 
         category, 
         vendor_name, 
         SUM(quantity) AS received
       FROM (
         SELECT
           (CASE 
             WHEN LOWER(pi.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(pi.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN pi.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN pi.category = '' OR pi.category IS NULL OR LOWER(pi.category) = 'mixed' THEN 'Mixed Fabric'
             ELSE TRIM(pi.category)
           END) COLLATE utf8mb4_unicode_ci AS category,
           COALESCE(v.name, 'Direct Vendor') COLLATE utf8mb4_unicode_ci AS vendor_name,
           pi.quantity
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         LEFT JOIN vendors v ON v.id = p.vendor_id
         WHERE (p.tenant_id = ? OR p.tenant_id IS NULL)
         UNION ALL
         SELECT 
           (CASE 
             WHEN LOWER(sm.category) LIKE '%salwar%' THEN 'Mixed Fabric (Salwar)'
             WHEN LOWER(sm.category) LIKE '%nighty%' THEN 'Mixed Fabric (Nighty)'
             WHEN sm.category = 'shawl_nighty_lace' THEN 'Mixed Fabric (Nighty)'
             WHEN sm.category = '' OR sm.category IS NULL OR LOWER(sm.category) = 'mixed' THEN 'Mixed Fabric'
             ELSE TRIM(sm.category)
           END) COLLATE utf8mb4_unicode_ci AS category, 
           COALESCE(v.name, 'Direct Vendor') COLLATE utf8mb4_unicode_ci AS vendor_name,
           sm.quantity
         FROM stock_movements sm
         LEFT JOIN vendors v ON v.id = sm.vendor_id
         WHERE (sm.tenant_id = ? OR sm.tenant_id IS NULL) AND sm.type='in' AND (sm.reference IS NULL OR sm.reference NOT LIKE 'PUR-%')
       ) vt
       GROUP BY category, vendor_name`,
      [tenantId, tenantId]
    ).catch(() => []);
    res.json(rows);
  } catch (error) {
    console.error('getStockByVendor error:', error);
    res.json([]);
  }
}

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  const { tenantId } = req.user!;
  const safe = (p: Promise<any[]>) => p.catch(() => [{}]);
  const num  = (v: any) => Number(v || 0);
  const earningExpr = `e.completed_pcs * CASE
    WHEN e.work_type='stitching' THEN COALESCE((SELECT pc.stitch_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), 0)
    ELSE                              COALESCE((SELECT pc.cut_rate FROM product_config pc WHERE pc.tenant_id=e.tenant_id AND pc.category=e.category LIMIT 1), s.rate_per_pc, 0)
  END`;

  try {
    const [capitalRow, salesRow, purchasesRow, expCompanyRow, expReimbRow, payrollRow, laborRow, advancesRow, stock, batches] = await Promise.all([
      safe(query<any[]>(`
        SELECT
          COALESCE(SUM(CASE WHEN type='investment' THEN amount ELSE 0 END),0) AS total_invested,
          COALESCE(SUM(CASE WHEN type='drawing'    THEN amount ELSE 0 END),0) AS total_drawn
        FROM capital_payments WHERE tenant_id=?`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(amount_paid),0) AS total
        FROM sales_orders WHERE tenant_id=?`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(
          CASE
            WHEN status='paid' THEN (CASE WHEN total > 0 THEN total ELSE advance_paid END)
            ELSE COALESCE(advance_paid, 0)
          END
        ), 0) AS total FROM purchases
        WHERE tenant_id=?`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE tenant_id=? AND (paid_by IS NULL OR paid_by='')`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE tenant_id=? AND reimbursed_at IS NOT NULL`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(${earningExpr}),0) AS total
        FROM staff_work_entries e JOIN staff s ON s.id=e.staff_id
        WHERE e.tenant_id=? AND e.is_settled=1`, [tenantId])),
      safe(query<any[]>(`
        SELECT COALESCE(SUM(${earningExpr}),0) AS total
        FROM staff_work_entries e JOIN staff s ON s.id=e.staff_id
        WHERE e.tenant_id=? AND e.is_settled=0 AND e.completed_pcs>0`, [tenantId])),
      safe(query<any[]>(`
        SELECT
          COALESCE(SUM(amount), 0) AS total_advances,
          COALESCE(SUM(CASE WHEN is_deducted=0 THEN amount ELSE 0 END), 0) AS pending_advances,
          COALESCE(SUM(CASE WHEN is_deducted=1 THEN amount ELSE 0 END), 0) AS deducted_advances
        FROM staff_advances
        WHERE tenant_id=?`, [tenantId])),
      safe(query<any[]>(`
        SELECT
          (SELECT COALESCE(SUM(quantity),0) FROM (
            SELECT quantity FROM stock_movements WHERE tenant_id=? AND type='in'
            UNION ALL
            SELECT pi.quantity FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id WHERE p.tenant_id=? AND NOT EXISTS (
              SELECT 1 FROM stock_movements sm WHERE sm.tenant_id=p.tenant_id AND sm.reference=CONCAT('PUR-',p.id)
            )
          ) tin) AS total_in,
          (SELECT COALESCE(SUM(COALESCE(NULLIF(pb.raw_quantity_used, 0), pb.quantity, 0)), 0) FROM production_batches pb WHERE pb.tenant_id=? AND (LOWER(COALESCE(pb.status,'active')) NOT IN ('finished','completed','delivered'))) AS total_in_production,
          (SELECT COALESCE(SUM(COALESCE(NULLIF(pb.raw_quantity_used, 0), pb.quantity, 0)), 0) FROM production_batches pb WHERE pb.tenant_id=?) AS total_allocated,
          (SELECT COALESCE(SUM(COALESCE(NULLIF(pb.raw_quantity_used, 0), pb.quantity, 0)), 0) FROM production_batches pb WHERE pb.tenant_id=? AND LOWER(COALESCE(pb.status,'')) IN ('finished','completed','delivered')) AS total_finished,
          (SELECT COALESCE(SUM(i.quantity),0) FROM sales_order_items i JOIN sales_orders o ON o.id=i.order_id WHERE o.tenant_id=?) AS total_sold`,
        [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId])),
      safe(query<any[]>(`
        SELECT COUNT(*) AS active FROM production_batches
        WHERE tenant_id=? AND (LOWER(COALESCE(status,'active')) NOT IN ('finished','completed'))`, [tenantId])),
    ]);

    const totalInvested   = num(capitalRow[0]?.total_invested);
    const totalDrawn      = num(capitalRow[0]?.total_drawn);
    const capital         = totalInvested - totalDrawn;
    const salesReceived   = num(salesRow[0]?.total);
    const fabricPurchases = num(purchasesRow[0]?.total);
    const otherExpenses   = num(expCompanyRow[0]?.total);
    const reimbursements  = num(expReimbRow[0]?.total);
    const payrollSettled  = num(payrollRow[0]?.total);
    const laborUnsettled  = num(laborRow[0]?.total);
    const pendingAdvances = num(advancesRow[0]?.pending_advances);
    const totalPaidToStaff= payrollSettled + pendingAdvances;
    const laborLiability  = Math.max(0, laborUnsettled - pendingAdvances);

    const cashInHand = totalInvested + salesReceived
                     - totalDrawn - fabricPurchases - otherExpenses
                     - reimbursements - totalPaidToStaff;

    res.json({
      capital,
      cash_in_hand:     cashInHand,
      fabric_purchases: fabricPurchases,
      other_expenses:   otherExpenses,
      labor_liability:  laborLiability,
      stock_in:         num(stock[0]?.total_in),
      stock_allocated:  num(stock[0]?.total_in_production),
      stock_available:  num(stock[0]?.total_in) - num(stock[0]?.total_allocated),
      stock_finished:   num(stock[0]?.total_finished),
      stock_sold:       num(stock[0]?.total_sold),
      stock_remaining:  Math.max(0, num(stock[0]?.total_finished) - num(stock[0]?.total_sold)),
      active_batches:   num(batches[0]?.active),
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}
