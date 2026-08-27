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
