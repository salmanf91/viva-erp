export interface TenantModules {
  feature_accounting: boolean;
  feature_expenses: boolean;
  feature_party_ledger: boolean;
  feature_sales_invoicing: boolean;
  feature_purchases: boolean;
  feature_inventory_stock: boolean;
  feature_garment_production: boolean;
  feature_staff_piece_log: boolean;
  feature_payroll: boolean;
  feature_zatca_einvoicing: boolean;
  feature_quotations: boolean;
  feature_delivery_notes: boolean;
}

export interface AuthPayload {
  userId: number;
  tenantId: number;
  tenantSlug?: string;
  dbName?: string;
  role: string;
  isSuperAdmin?: boolean;
  modules?: TenantModules;
}

export interface RequestWithUser extends Express.Request {
  user?: AuthPayload;
}

// ── DB row shapes ────────────────────────────────────────────

export interface Tenant {
  id: number;
  name: string;
  created_at: string;
}

export interface User {
  id: number;
  tenant_id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'super_admin' | 'owner' | 'partner' | 'manager' | 'staff_admin';
}

export interface Partner {
  id: number;
  tenant_id: number;
  user_id: number | null;
  name: string;
  committed_capital: number;
  paid_capital: number;
}

export interface CapitalPayment {
  id: number;
  tenant_id: number;
  partner_id: number;
  amount: number;
  payment_date: string;
  mode: 'cash' | 'upi' | 'cheque';
  note: string | null;
}

export interface Reminder {
  id: number;
  tenant_id: number;
  title: string;
  body: string | null;
  type: 'warning' | 'critical' | 'info';
  status: 'open' | 'resolved';
}

export interface Vendor {
  id: number;
  tenant_id: number;
  name: string;
  phone: string | null;
}

export interface Purchase {
  id: number;
  tenant_id: number;
  vendor_id: number;
  invoice_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: 'paid' | 'pending' | 'partial';
  note: string | null;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  category: 'shawl_nighty' | 'ordinary_nighty' | 'mixed';
  quantity: number;
  rate_per_pc: number;
  amount: number;
}

export interface PurchaseDispute {
  id: number;
  purchase_id: number;
  amount: number;
  description: string | null;
  status: 'pending' | 'resolved' | 'adjusted_in_next_bill';
}

export interface ExpenseReason {
  id: number;
  tenant_id: number;
  name: string;
  category: 'transport' | 'materials' | 'setup' | 'fabric' | 'staff' | 'other';
  icon: string;
  is_active: boolean;
}

export interface Expense {
  id: number;
  tenant_id: number;
  reason_id: number;
  amount: number;
  expense_date: string;
  note: string | null;
  is_archived: boolean;
}

export interface MonthlyOverhead {
  id: number;
  tenant_id: number;
  month: number;
  year: number;
  rent: number;
  electricity: number;
}

export interface ProductConfig {
  id: number;
  tenant_id: number;
  category: 'shawl_nighty' | 'shawl_nighty_lace' | 'ordinary_nighty';
  fabric_cost: number;
  selling_rate: number;
  lace_cost: number;
  zip_cost: number;
  thread_cost: number;
  canvas_cost: number;
  plastic_cost: number;
  logistics_cost: number;
  cut_rate: number;
  stitch_rate: number;
}

export interface Staff {
  id: number;
  tenant_id: number;
  name: string;
  role: 'cutting_master' | 'tailor';
  rate_per_pc: number;
  phone: string | null;
  is_active: boolean;
}

export interface ProductionBatch {
  id: number;
  tenant_id: number;
  batch_number: string;
  category: 'shawl_nighty' | 'shawl_nighty_lace' | 'ordinary_nighty';
  quantity: number;
  cut_rate: number;
  stitch_rate: number;
  status: 'allocated' | 'cutting' | 'stitching' | 'finished';
  batch_date: string;
}

export interface StaffWorkLog {
  id: number;
  tenant_id: number;
  staff_id: number;
  batch_id: number;
  pieces: number;
  rate: number;
  amount: number;
  log_date: string;
  is_settled: boolean;
}
