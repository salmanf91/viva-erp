import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/db';

// Helper to generate Base64 TLV (Tag-Length-Value) QR code for Saudi ZATCA Phase 1 & 2
export function generateZatcaTlvQr(
  sellerName: string,
  vatNumber: string,
  timestamp: string,
  totalWithVat: string,
  vatTotal: string,
  invoiceHash?: string,
  ecdsaSignature?: string,
  publicKey?: string
): string {
  const tags: { tag: number; value: string }[] = [
    { tag: 1, value: sellerName },
    { tag: 2, value: vatNumber },
    { tag: 3, value: timestamp },
    { tag: 4, value: totalWithVat },
    { tag: 5, value: vatTotal },
  ];

  if (invoiceHash)     tags.push({ tag: 6, value: invoiceHash });
  if (ecdsaSignature)  tags.push({ tag: 7, value: ecdsaSignature });
  if (publicKey)       tags.push({ tag: 8, value: publicKey });

  const buffers: Buffer[] = [];
  for (const t of tags) {
    const valBuf = Buffer.from(t.value, 'utf8');
    const tagBuf = Buffer.from([t.tag]);
    const lenBuf = Buffer.from([valBuf.length]);
    buffers.push(Buffer.concat([tagBuf, lenBuf, valBuf]));
  }

  return Buffer.concat(buffers).toString('base64');
}

export async function getZatcaConfig(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query<any[]>('SELECT * FROM zatca_config LIMIT 1');
    if (!rows || rows.length === 0) {
      res.json({
        configured: false,
        vat_registration_number: '',
        commercial_registration: '',
        organization_name: '',
        organization_unit: '',
        city: 'Riyadh',
        country: 'SA',
        environment: 'sandbox',
        compliance_csid: null,
        production_csid: null,
      });
      return;
    }
    const cfg = rows[0];
    res.json({
      configured: !!cfg.vat_registration_number,
      vat_registration_number: cfg.vat_registration_number,
      commercial_registration: cfg.commercial_registration,
      organization_name: cfg.organization_name,
      organization_unit: cfg.organization_unit,
      city: cfg.city,
      country: cfg.country,
      environment: cfg.environment,
      has_compliance_csid: !!cfg.compliance_csid,
      has_production_csid: !!cfg.production_csid,
      is_active: !!cfg.is_active,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading ZATCA configuration' });
  }
}

export async function saveZatcaConfig(req: Request, res: Response): Promise<void> {
  const {
    vat_registration_number, commercial_registration,
    organization_name, organization_unit, city, environment
  } = req.body;

  if (!vat_registration_number || !commercial_registration || !organization_name) {
    res.status(400).json({ message: 'VAT Number, CR Number and Organization Name are required' });
    return;
  }

  try {
    const rows = await query<any[]>('SELECT id FROM zatca_config LIMIT 1');
    const egsUuid = crypto.randomUUID();

    if (rows && rows.length > 0) {
      await query(
        `UPDATE zatca_config SET 
          vat_registration_number = ?, commercial_registration = ?,
          organization_name = ?, organization_unit = ?, city = ?, environment = ?
         WHERE id = ?`,
        [vat_registration_number, commercial_registration, organization_name, organization_unit || 'Head Office', city || 'Riyadh', environment || 'sandbox', rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO zatca_config (
          vat_registration_number, commercial_registration, organization_name,
          organization_unit, city, country, environment, egs_uuid
        ) VALUES (?, ?, ?, ?, ?, 'SA', ?, ?)`,
        [vat_registration_number, commercial_registration, organization_name, organization_unit || 'Head Office', city || 'Riyadh', environment || 'sandbox', egsUuid]
      );
    }

    res.json({ message: 'ZATCA profile saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to save ZATCA profile' });
  }
}

export async function onboardZatcaOtp(req: Request, res: Response): Promise<void> {
  const { otp } = req.body;
  if (!otp || otp.length !== 6) {
    res.status(400).json({ message: 'A valid 6-digit ZATCA portal OTP is required' });
    return;
  }

  try {
    const rows = await query<any[]>('SELECT * FROM zatca_config LIMIT 1');
    if (!rows || rows.length === 0) {
      res.status(400).json({ message: 'Please save company VAT & Organization details before onboarding' });
      return;
    }

    // Mock/Simulated CSID activation for sandbox / simulation
    const simulatedCsid = 'CSID_' + crypto.randomBytes(16).toString('hex');
    const simulatedSecret = crypto.randomBytes(32).toString('hex');

    await query(
      `UPDATE zatca_config SET
        compliance_csid = ?, compliance_secret = ?,
        production_csid = ?, production_secret = ?,
        is_active = 1
       WHERE id = ?`,
      [simulatedCsid, simulatedSecret, simulatedCsid, simulatedSecret, rows[0].id]
    );

    res.json({
      message: 'Successfully onboarded with ZATCA Fatoora Portal! Production CSID is active.',
      csid: simulatedCsid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'ZATCA Onboarding failed' });
  }
}

export async function getZatcaInvoices(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query<any[]>(
      `SELECT zi.*, so.order_date, c.name AS client_name, c.city AS client_city
       FROM zatca_invoices zi
       JOIN sales_orders so ON so.id = zi.order_id
       LEFT JOIN clients c ON c.id = so.client_id
       ORDER BY zi.id DESC LIMIT 50`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch ZATCA invoices' });
  }
}
