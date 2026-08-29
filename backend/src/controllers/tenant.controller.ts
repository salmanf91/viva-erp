import { Request, Response } from 'express';
import { masterPool, masterQuery } from '../config/masterDb';

export async function getAllTenantsAdmin(_req: Request, res: Response): Promise<void> {
  try {
    const tenants = await masterQuery<any[]>(`
      SELECT t.id, t.slug, t.name, t.country, t.currency, t.business_domain,
             t.logo_url, t.db_name, t.status, t.created_at,
             COUNT(u.id) AS total_users
      FROM master_tenants t
      LEFT JOIN master_users u ON u.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ message: 'Failed to fetch tenants' });
  }
}

export async function toggleTenantStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body; // 'active' or 'suspended'

  if (!['active', 'suspended'].includes(status)) {
    res.status(400).json({ message: "Status must be 'active' or 'suspended'" });
    return;
  }

  try {
    await masterPool.query(
      'UPDATE master_tenants SET status = ? WHERE id = ?',
      [status, id]
    );
    res.json({ message: `Tenant workspace is now ${status}` });
  } catch (error) {
    console.error('Error updating tenant status:', error);
    res.status(500).json({ message: 'Failed to update tenant status' });
  }
}

export async function deleteTenant(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { drop_database } = req.body; // boolean

  try {
    // 1. Fetch tenant db_name
    const rows = await masterQuery<any[]>('SELECT * FROM master_tenants WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      res.status(404).json({ message: 'Tenant workspace not found' });
      return;
    }

    const tenant = rows[0];

    // Prevent deleting default main viva_studio tenant
    if (tenant.slug === 'viva_studio') {
      res.status(400).json({ message: 'The primary workspace cannot be deleted' });
      return;
    }

    // 2. Drop physical database if requested and if it is an isolated database
    if (drop_database && tenant.db_name && tenant.db_name.startsWith('erp_tenant_')) {
      try {
        await masterPool.query(`DROP DATABASE IF EXISTS \`${tenant.db_name}\``);
        console.log(`[TenantManager] Dropped database '${tenant.db_name}'`);
      } catch (err: any) {
        console.warn(`[TenantManager] Could not drop DB ${tenant.db_name}:`, err.message);
      }
    }

    // 3. Delete master_tenants record (cascades to master_users and master_tenant_modules)
    await masterPool.query('DELETE FROM master_tenants WHERE id = ?', [id]);

    res.json({ message: `Tenant '${tenant.name}' has been successfully deleted` });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ message: 'Failed to delete tenant' });
  }
}

export async function getTenantModules(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const targetTenantId = req.params.id === 'current' ? user?.tenantId : parseInt(req.params.id);

  if (!targetTenantId) {
    res.status(400).json({ message: 'Tenant ID required' });
    return;
  }

  // Non-super admin can only view their own modules
  if (!user?.isSuperAdmin && user?.role !== 'super_admin' && user?.tenantId !== targetTenantId) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }

  try {
    const rows = await masterQuery<any[]>(
      'SELECT * FROM master_tenant_modules WHERE tenant_id = ? LIMIT 1',
      [targetTenantId]
    );

    if (rows && rows.length > 0) {
      const m = rows[0];
      res.json({
        feature_accounting: !!m.feature_accounting,
        feature_expenses: !!m.feature_expenses,
        feature_party_ledger: !!m.feature_party_ledger,
        feature_sales_invoicing: !!m.feature_sales_invoicing,
        feature_purchases: !!m.feature_purchases,
        feature_inventory_stock: !!m.feature_inventory_stock,
        feature_garment_production: !!m.feature_garment_production,
        feature_staff_piece_log: !!m.feature_staff_piece_log,
        feature_payroll: !!m.feature_payroll,
        feature_zatca_einvoicing: !!m.feature_zatca_einvoicing,
        feature_quotations: !!m.feature_quotations,
        feature_delivery_notes: !!m.feature_delivery_notes,
      });
      return;
    }

    // Default fallback
    res.json({
      feature_accounting: true,
      feature_expenses: true,
      feature_party_ledger: true,
      feature_sales_invoicing: true,
      feature_purchases: true,
      feature_inventory_stock: false,
      feature_garment_production: false,
      feature_staff_piece_log: false,
      feature_payroll: true,
      feature_zatca_einvoicing: false,
      feature_quotations: false,
      feature_delivery_notes: false,
    });
  } catch (error) {
    console.error('Error fetching tenant modules:', error);
    res.status(500).json({ message: 'Failed to fetch modules' });
  }
}

export async function updateTenantModules(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const targetTenantId = req.params.id === 'current' ? user?.tenantId : parseInt(req.params.id);

  if (!targetTenantId) {
    res.status(400).json({ message: 'Tenant ID required' });
    return;
  }

  // Non-super admin can only update their own tenant if they are owner
  if (!user?.isSuperAdmin && user?.role !== 'super_admin') {
    if (user?.tenantId !== targetTenantId || (user?.role !== 'owner' && user?.role !== 'partner')) {
      res.status(403).json({ message: 'Access denied: Only workspace owner or Super Admin can modify modules' });
      return;
    }
  }

  const {
    feature_accounting, feature_expenses, feature_party_ledger,
    feature_sales_invoicing, feature_purchases, feature_inventory_stock,
    feature_garment_production, feature_staff_piece_log, feature_payroll,
    feature_zatca_einvoicing, feature_quotations, feature_delivery_notes
  } = req.body;

  try {
    await masterPool.query(
      `INSERT INTO master_tenant_modules (
        tenant_id, feature_accounting, feature_expenses, feature_party_ledger,
        feature_sales_invoicing, feature_purchases, feature_inventory_stock,
        feature_garment_production, feature_staff_piece_log, feature_payroll,
        feature_zatca_einvoicing, feature_quotations, feature_delivery_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        feature_accounting = VALUES(feature_accounting),
        feature_expenses = VALUES(feature_expenses),
        feature_party_ledger = VALUES(feature_party_ledger),
        feature_sales_invoicing = VALUES(feature_sales_invoicing),
        feature_purchases = VALUES(feature_purchases),
        feature_inventory_stock = VALUES(feature_inventory_stock),
        feature_garment_production = VALUES(feature_garment_production),
        feature_staff_piece_log = VALUES(feature_staff_piece_log),
        feature_payroll = VALUES(feature_payroll),
        feature_zatca_einvoicing = VALUES(feature_zatca_einvoicing),
        feature_quotations = VALUES(feature_quotations),
        feature_delivery_notes = VALUES(feature_delivery_notes)`,
      [
        targetTenantId,
        feature_accounting ? 1 : 0,
        feature_expenses ? 1 : 0,
        feature_party_ledger ? 1 : 0,
        feature_sales_invoicing ? 1 : 0,
        feature_purchases ? 1 : 0,
        feature_inventory_stock ? 1 : 0,
        feature_garment_production ? 1 : 0,
        feature_staff_piece_log ? 1 : 0,
        feature_payroll ? 1 : 0,
        feature_zatca_einvoicing ? 1 : 0,
        feature_quotations ? 1 : 0,
        feature_delivery_notes ? 1 : 0,
      ]
    );

    res.json({
      message: 'Modules configuration updated successfully',
      modules: {
        feature_accounting: !!feature_accounting,
        feature_expenses: !!feature_expenses,
        feature_party_ledger: !!feature_party_ledger,
        feature_sales_invoicing: !!feature_sales_invoicing,
        feature_purchases: !!feature_purchases,
        feature_inventory_stock: !!feature_inventory_stock,
        feature_garment_production: !!feature_garment_production,
        feature_staff_piece_log: !!feature_staff_piece_log,
        feature_payroll: !!feature_payroll,
        feature_zatca_einvoicing: !!feature_zatca_einvoicing,
        feature_quotations: !!feature_quotations,
        feature_delivery_notes: !!feature_delivery_notes,
      }
    });
  } catch (error) {
    console.error('Error updating tenant modules:', error);
    res.status(500).json({ message: 'Failed to update modules' });
  }
}
