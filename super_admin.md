# Multi-Tenant SaaS Platform — Super Admin Roadmap

This document outlines the planned roadmap and feature specifications for the centralized Super Admin / SaaS Platform Console.

---

## 1. 💳 SaaS Subscriptions, Plans & Tenant Billing
- **Subscription Packages**:
  - Starter, Professional, Enterprise tiers (with monthly and annual billing cycles).
  - Custom pricing per tenant or currency (INR, SAR, USD, AED).
- **Tenant Billing & Renewal Tracking**:
  - Payment tracking per tenant workspace.
  - Automated upcoming renewal alerts (7 days, 3 days, on expiry).
  - 14-day free trial counter with configurable grace period before auto-suspension.
- **Automated Invoicing & Payment Gateways**:
  - Integrate Stripe / HyperPay / Razorpay for recurring SaaS subscriptions.

---

## 2. 🎛️ Feature Entitlements & Add-on Upselling
- **Granular Feature Toggles per Tenant**:
  - 1-Click enablement of add-on modules (e.g. *Saudi ZATCA E-Invoicing*, *Garment Production Engine*, *Multi-Warehouse Inventory*, *Staff Piece Log*).
- **Quota & Limit Enforcement**:
  - Set limits per tier: Max users (e.g. 3 users vs Unlimited), Max invoices per month, Max storage.

---

## 3. 💾 Database Health, Diagnostics & 1-Click Backups
- **Storage & Disk Telemetry**:
  - Live storage monitoring (MB/GB) for each isolated tenant database (`erp_tenant_*`).
  - MySQL connection pool health and active queries.
- **1-Click Tenant Database Backup**:
  - Instant `.sql.gz` database export / download for any company before major upgrades.
  - Point-in-time database restoration.

---

## 4. 🔑 Support Impersonation ("Login-As-Tenant")
- Super Admin one-click session jump into any tenant workspace for troubleshooting and support without requiring the client's password.
- Read-only support mode or full support audit log.

---

## 5. 📢 Global Platform Broadcasts & Maintenance Notices
- System-wide banner notifications (e.g., *"Scheduled maintenance tonight at 2:00 AM UTC"*) shown on all tenant dashboards.
- Platform release changelog & feature announcements.

---

## 6. 📜 Central Security & Platform Audit Logs
- Immutable audit log of platform operations:
  - Workspace created / deleted / suspended / reactivated.
  - Super admin password changes.
  - Database provisioning and backup actions.
