import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { masterPool, masterQuery } from '../config/masterDb';
import { getTenantPool } from '../config/tenantDbManager';

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  country?: string;
  currency?: string;
  business_domain?: string;
  logo_url?: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  features?: {
    feature_accounting?: boolean;
    feature_expenses?: boolean;
    feature_party_ledger?: boolean;
    feature_sales_invoicing?: boolean;
    feature_purchases?: boolean;
    feature_inventory_stock?: boolean;
    feature_garment_production?: boolean;
    feature_staff_piece_log?: boolean;
    feature_payroll?: boolean;
    feature_zatca_einvoicing?: boolean;
  };
}

export async function provisionNewTenant(input: ProvisionTenantInput): Promise<{ tenantId: number; dbName: string }> {
  const {
    name, slug, country = 'SA', currency = 'SAR', business_domain = 'trading',
    logo_url, admin_name, admin_email, admin_password, features = {}
  } = input;

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const dbName = `erp_tenant_${cleanSlug}`;

  // Check if slug or db already exists
  const existing = await masterQuery<any[]>(
    `SELECT id FROM master_tenants WHERE slug = ? OR db_name = ? LIMIT 1`,
    [cleanSlug, dbName]
  );
  if (existing && existing.length > 0) {
    throw new Error(`Workspace identifier '${cleanSlug}' already exists. Please choose a different slug.`);
  }

  // 1. Insert into master_tenants
  const [tenantRes] = await masterPool.query<any>(
    `INSERT INTO master_tenants (slug, name, country, currency, business_domain, logo_url, db_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [cleanSlug, name, country, currency, business_domain, logo_url || null, dbName]
  );
  const tenantId = tenantRes.insertId;

  // 2. Insert into master_tenant_modules
  await masterPool.query(
    `INSERT INTO master_tenant_modules (
      tenant_id, feature_accounting, feature_expenses, feature_party_ledger,
      feature_sales_invoicing, feature_purchases, feature_inventory_stock,
      feature_garment_production, feature_staff_piece_log, feature_payroll,
      feature_zatca_einvoicing
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      features.feature_accounting ?? true,
      features.feature_expenses ?? true,
      features.feature_party_ledger ?? true,
      features.feature_sales_invoicing ?? true,
      features.feature_purchases ?? true,
      features.feature_inventory_stock ?? false,
      features.feature_garment_production ?? false,
      features.feature_staff_piece_log ?? false,
      features.feature_payroll ?? true,
      features.feature_zatca_einvoicing ?? (country === 'SA'),
    ]
  );

  // 3. Create Admin User in master_users
  const passwordHash = await bcrypt.hash(admin_password, 10);
  await masterPool.query(
    `INSERT INTO master_users (tenant_id, email, password_hash, name, role)
     VALUES (?, ?, ?, ?, 'owner')`,
    [tenantId, admin_email.toLowerCase().trim(), passwordHash, admin_name.trim()]
  );

  // 4. Create the physical isolated MySQL database
  try {
    await masterPool.query(
      `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } catch (err: any) {
    if (err.code === 'ER_DBACCESS_DENIED_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR') {
      const dbUser = process.env.DB_USER || 'vivauser';
      throw new Error(
        `MySQL permission required: The database user '${dbUser}' does not have permission to execute 'CREATE DATABASE'. ` +
        `Please grant permissions in MySQL: GRANT ALL PRIVILEGES ON \`erp_%\`.* TO '${dbUser}'@'localhost'; FLUSH PRIVILEGES;`
      );
    }
    throw err;
  }

  // 5. Execute schema scripts on the new database
  const tenantPool = getTenantPool(dbName);

  const databaseDir = path.resolve(__dirname, '../../../database');
  
  // A. Execute Base Schema
  const baseSchemaPath = path.join(databaseDir, 'tenant_base_schema.sql');
  if (fs.existsSync(baseSchemaPath)) {
    const baseSql = fs.readFileSync(baseSchemaPath, 'utf8');
    await executeSqlScript(tenantPool, baseSql);
  }

  // B. Execute Garment Production Schema (if enabled)
  if (features.feature_garment_production) {
    const garmentSchemaPath = path.join(databaseDir, 'garment_production_schema.sql');
    if (fs.existsSync(garmentSchemaPath)) {
      const garmentSql = fs.readFileSync(garmentSchemaPath, 'utf8');
      await executeSqlScript(tenantPool, garmentSql);
    }
  }

  // C. Execute ZATCA Schema (if enabled)
  if (features.feature_zatca_einvoicing || country === 'SA') {
    const zatcaSchemaPath = path.join(databaseDir, 'zatca_schema.sql');
    if (fs.existsSync(zatcaSchemaPath)) {
      const zatcaSql = fs.readFileSync(zatcaSchemaPath, 'utf8');
      await executeSqlScript(tenantPool, zatcaSql);
    }
  }

  console.log(`[Provisioner] Successfully created isolated database '${dbName}' for tenant '${name}' (${cleanSlug})`);

  return { tenantId, dbName };
}

async function executeSqlScript(pool: any, sqlContent: string): Promise<void> {
  const statements = sqlContent
    .replace(/--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      console.warn(`[Provisioner] Schema statement notice:`, err.message);
    }
  }
}
