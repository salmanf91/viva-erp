import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { masterPool, masterQuery } from '../config/masterDb';
import { provisionNewTenant } from '../services/tenantProvisioner.service';
import { User, TenantModules } from '../types';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, tenant_id } = req.body;
  if (!email || !password || !tenant_id) {
    res.status(400).json({ message: 'email, password and tenant_id are required' });
    return;
  }
  try {
    const cleanEmail = email.toLowerCase().trim();

    // 1. First check master database (master_users & master_tenants)
    let userRow: any = null;
    let tenantRow: any = null;
    let modules: TenantModules = {
      feature_accounting: true,
      feature_expenses: true,
      feature_party_ledger: true,
      feature_sales_invoicing: true,
      feature_purchases: true,
      feature_inventory_stock: true,
      feature_garment_production: true,
      feature_staff_piece_log: true,
      feature_payroll: true,
      feature_zatca_einvoicing: false,
      feature_quotations: false,
      feature_delivery_notes: false,
    };

    try {
      const masterUsers = await masterQuery<any[]>(
        `SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug, t.db_name, t.country, t.currency, t.business_domain, t.logo_url, t.status AS tenant_status,
                m.feature_accounting, m.feature_expenses, m.feature_party_ledger,
                m.feature_sales_invoicing, m.feature_purchases, m.feature_inventory_stock,
                m.feature_garment_production, m.feature_staff_piece_log, m.feature_payroll,
                m.feature_zatca_einvoicing, m.feature_quotations, m.feature_delivery_notes
         FROM master_users u
         JOIN master_tenants t ON t.id = u.tenant_id
         LEFT JOIN master_tenant_modules m ON m.tenant_id = t.id
         WHERE (u.email = ? OR u.email = ?) AND (u.tenant_id = ? OR t.slug = ?)
         LIMIT 1`,
        [cleanEmail, email, tenant_id, tenant_id]
      );

      if (masterUsers && masterUsers.length > 0) {
        userRow = masterUsers[0];
        if (userRow.tenant_status === 'suspended') {
          res.status(403).json({ message: 'This workspace is currently deactivated. Please contact the administrator.' });
          return;
        }
        tenantRow = {
          id: userRow.tenant_id,
          name: userRow.tenant_name,
          slug: userRow.tenant_slug,
          db_name: userRow.db_name,
          country: userRow.country,
          currency: userRow.currency,
          business_domain: userRow.business_domain,
          logo_url: userRow.logo_url,
          status: userRow.tenant_status,
        };
        modules = {
          feature_accounting: !!userRow.feature_accounting,
          feature_expenses: !!userRow.feature_expenses,
          feature_party_ledger: !!userRow.feature_party_ledger,
          feature_sales_invoicing: !!userRow.feature_sales_invoicing,
          feature_purchases: !!userRow.feature_purchases,
          feature_inventory_stock: !!userRow.feature_inventory_stock,
          feature_garment_production: !!userRow.feature_garment_production,
          feature_staff_piece_log: !!userRow.feature_staff_piece_log,
          feature_payroll: !!userRow.feature_payroll,
          feature_zatca_einvoicing: !!userRow.feature_zatca_einvoicing,
          feature_quotations: !!userRow.feature_quotations,
          feature_delivery_notes: !!userRow.feature_delivery_notes,
        };
      }
    } catch (e) {
      // Master DB table not ready or fallback
    }

    // 2. Fallback to legacy database if not found in master_users
    if (!userRow) {
      const rows = await query<any[]>(
        `SELECT u.*, t.name AS tenant_name
         FROM users u JOIN tenants t ON t.id = u.tenant_id
         WHERE u.email = ? AND u.tenant_id = ? LIMIT 1`,
        [cleanEmail, tenant_id]
      );
      if (!rows.length) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
      }
      userRow = rows[0];
      tenantRow = {
        id: userRow.tenant_id,
        name: userRow.tenant_name,
        slug: 'viva_studio',
        db_name: process.env.DB_NAME || 'viva_erp',
        country: 'IN',
        currency: 'INR',
        logo_url: null,
      };
    }

    const match = await bcrypt.compare(password, userRow.password_hash);
    if (!match) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isSuperAdmin = userRow.role === 'super_admin';

    const token = jwt.sign(
      {
        userId: userRow.id,
        tenantId: userRow.tenant_id,
        tenantSlug: tenantRow.slug,
        dbName: tenantRow.db_name,
        role: userRow.role,
        isSuperAdmin,
        modules,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    res.json({
      token,
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      is_super_admin: isSuperAdmin,
      tenant_id: userRow.tenant_id,
      tenant_name: tenantRow.name,
      tenant_slug: tenantRow.slug,
      country: tenantRow.country,
      currency: tenantRow.currency,
      logo_url: tenantRow.logo_url,
      modules,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err instanceof Error ? err.message : String(err) });
  }
}

export async function superAdminLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const rows = await masterQuery<any[]>(
      `SELECT * FROM master_users WHERE (LOWER(email) = ? OR email = ?) AND role = 'super_admin' LIMIT 1`,
      [cleanEmail, email]
    );

    if (!rows || rows.length === 0) {
      res.status(401).json({ message: 'Invalid super admin credentials' });
      return;
    }

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      res.status(401).json({ message: 'Invalid super admin credentials' });
      return;
    }

    const token = jwt.sign(
      {
        userId: admin.id,
        tenantId: 0,
        tenantSlug: 'platform',
        role: 'super_admin',
        isSuperAdmin: true,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    res.json({
      token,
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: 'super_admin',
      is_super_admin: true,
      tenant_name: 'Platform Administration',
    });
  } catch (err) {
    console.error('Super Admin login error:', err);
    res.status(500).json({ message: 'Server error', error: err instanceof Error ? err.message : String(err) });
  }
}

export async function getTenants(_req: Request, res: Response): Promise<void> {
  try {
    try {
      const masterTenants = await masterQuery<any[]>(
        `SELECT id, slug, name, country, currency, business_domain, logo_url 
         FROM master_tenants 
         WHERE status = 'active' ORDER BY name ASC`
      );
      if (masterTenants && masterTenants.length > 0) {
        res.json(masterTenants);
        return;
      }
    } catch {
      // fallback
    }

    const tenants = await query<{ id: number; name: string }[]>('SELECT id, name FROM tenants ORDER BY name');
    res.json(tenants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function registerTenant(req: Request, res: Response): Promise<void> {
  const {
    name, slug, country, currency, business_domain, logo_url,
    admin_name, admin_email, admin_password, features
  } = req.body;

  if (!name || !slug || !admin_email || !admin_password || !admin_name) {
    res.status(400).json({ message: 'Company name, workspace slug, admin name, email and password are required' });
    return;
  }

  try {
    const result = await provisionNewTenant({
      name,
      slug,
      country: country || 'SA',
      currency: currency || 'SAR',
      business_domain: business_domain || 'trading',
      logo_url: logo_url || undefined,
      admin_name,
      admin_email,
      admin_password,
      features: features || {},
    });

    res.status(201).json({
      message: 'Tenant and database provisioned successfully',
      tenant_id: result.tenantId,
      db_name: result.dbName,
    });
  } catch (error: any) {
    console.error('Tenant provisioning error:', error);
    res.status(400).json({ message: error.message || 'Failed to provision tenant' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { userId } = (req as any).user;
  const { current_password, new_password } = req.body;
  try {
    let userFound = false;

    // 1. Try master_users first
    try {
      const masterRows = await masterQuery<any[]>('SELECT * FROM master_users WHERE id = ?', [userId]);
      if (masterRows && masterRows.length > 0) {
        const user = masterRows[0];
        const match = await bcrypt.compare(current_password, user.password_hash);
        if (!match) { res.status(401).json({ message: 'Current password incorrect' }); return; }
        const hash = await bcrypt.hash(new_password, 10);
        await masterPool.query('UPDATE master_users SET password_hash = ? WHERE id = ?', [hash, userId]);
        userFound = true;
        res.json({ message: 'Password updated' });
        return;
      }
    } catch {}

    // 2. Fallback to local tenant users table
    const rows = await query<User[]>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rows.length) { res.status(404).json({ message: 'User not found' }); return; }
    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) { res.status(401).json({ message: 'Current password incorrect' }); return; }
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
    res.json({ message: 'Password updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
}
