import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { masterQuery } from './masterDb';

dotenv.config();

const MASTER_DB_NAME = process.env.MASTER_DB_NAME || 'erp_master';

interface TenantDbConfig {
  db_name: string;
  db_host?: string;
  db_port?: number;
  db_user?: string;
  db_password?: string;
}

// Memory cache for tenant connection pools
const tenantPools = new Map<string, mysql.Pool>();

export function getTenantPool(dbName: string, config?: TenantDbConfig): mysql.Pool {
  if (tenantPools.has(dbName)) {
    return tenantPools.get(dbName)!;
  }

  const pool = mysql.createPool({
    host:     config?.db_host || process.env.DB_HOST || 'localhost',
    port:     config?.db_port || parseInt(process.env.DB_PORT || '3306'),
    user:     config?.db_user || process.env.DB_USER || 'root',
    password: config?.db_password ?? (process.env.DB_PASSWORD || ''),
    database: dbName,
    waitForConnections: true,
    connectionLimit:    10,
    dateStrings:        true,
  });

  tenantPools.set(dbName, pool);
  return pool;
}

export async function resolveTenantBySlug(slug: string): Promise<any | null> {
  const rows = await masterQuery<any[]>(
    `SELECT t.*, m.feature_accounting, m.feature_expenses, m.feature_party_ledger,
            m.feature_sales_invoicing, m.feature_purchases, m.feature_inventory_stock,
            m.feature_garment_production, m.feature_staff_piece_log, m.feature_payroll,
            m.feature_zatca_einvoicing
     FROM \`${MASTER_DB_NAME}\`.master_tenants t
     LEFT JOIN \`${MASTER_DB_NAME}\`.master_tenant_modules m ON m.tenant_id = t.id
     WHERE t.slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

export async function resolveTenantById(id: number): Promise<any | null> {
  const rows = await masterQuery<any[]>(
    `SELECT t.*, m.feature_accounting, m.feature_expenses, m.feature_party_ledger,
            m.feature_sales_invoicing, m.feature_purchases, m.feature_inventory_stock,
            m.feature_garment_production, m.feature_staff_piece_log, m.feature_payroll,
            m.feature_zatca_einvoicing
     FROM \`${MASTER_DB_NAME}\`.master_tenants t
     LEFT JOIN \`${MASTER_DB_NAME}\`.master_tenant_modules m ON m.tenant_id = t.id
     WHERE t.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}
