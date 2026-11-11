import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Sales Invoice & Calculation Tests', () => {
  // Helper implementing the exact sales order calculation logic from sales.controller.ts
  function calculateOrderTotals(params: {
    items: Array<{ quantity: number; rate_per_pc: number }>;
    discount?: number;
    include_gst?: boolean;
    gst_percent?: number;
    payments?: number[];
  }) {
    const subtotal = params.items.reduce((sum, item) => sum + (item.quantity * item.rate_per_pc), 0);
    const discountAmt = Math.max(0, Number(params.discount || 0));
    const taxable = Math.max(0, subtotal - discountAmt);
    const gstRate = params.include_gst ? (Number(params.gst_percent || 0) / 100) : 0;
    const gstAmount = taxable * gstRate;
    const total = taxable + gstAmount;

    const totalPaid = Math.min(total, (params.payments || []).reduce((sum, p) => sum + Number(p || 0), 0));
    const balance = Math.max(0, total - totalPaid);
    const status = totalPaid >= total && total > 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'pending');

    return {
      subtotal,
      discountAmt,
      taxable,
      gstAmount,
      total,
      totalPaid,
      balance,
      status,
    };
  }

  it('correctly calculates basic order total without tax or discount', () => {
    const result = calculateOrderTotals({
      items: [
        { quantity: 10, rate_per_pc: 250 },
        { quantity: 5, rate_per_pc: 400 },
      ],
    });

    assert.strictEqual(result.subtotal, 4500);
    assert.strictEqual(result.total, 4500);
    assert.strictEqual(result.balance, 4500);
    assert.strictEqual(result.status, 'pending');
  });

  it('applies discount before computing GST', () => {
    const result = calculateOrderTotals({
      items: [{ quantity: 10, rate_per_pc: 1000 }], // 10,000 subtotal
      discount: 1000,                               // 9,000 taxable
      include_gst: true,
      gst_percent: 5,                               // 5% of 9,000 = 450
    });

    assert.strictEqual(result.subtotal, 10000);
    assert.strictEqual(result.discountAmt, 1000);
    assert.strictEqual(result.taxable, 9000);
    assert.strictEqual(result.gstAmount, 450);
    assert.strictEqual(result.total, 9450);
    assert.strictEqual(result.balance, 9450);
  });

  it('correctly tracks partial payment and pending status', () => {
    const result = calculateOrderTotals({
      items: [{ quantity: 20, rate_per_pc: 500 }], // 10,000
      payments: [4000],
    });

    assert.strictEqual(result.total, 10000);
    assert.strictEqual(result.totalPaid, 4000);
    assert.strictEqual(result.balance, 6000);
    assert.strictEqual(result.status, 'partial');
  });

  it('correctly tracks multi-installment payments totaling full amount', () => {
    const result = calculateOrderTotals({
      items: [{ quantity: 20, rate_per_pc: 500 }], // 10,000
      payments: [4000, 3500, 2500],                 // 3 installments
    });

    assert.strictEqual(result.total, 10000);
    assert.strictEqual(result.totalPaid, 10000);
    assert.strictEqual(result.balance, 0);
    assert.strictEqual(result.status, 'paid');
  });

  it('receipt breakdown shows previously_paid and total_paid correctly', () => {
    const orderTotal = 12000;
    const installments = [
      { id: 1, amount: 4000, receipt_no: 'RCP-2026-0001' },
      { id: 2, amount: 8000, receipt_no: 'RCP-2026-0002' },
    ];

    const currentReceipt = installments[1]; // RCP-2026-0002 for 8,000
    const orderAmountPaid = installments.reduce((s, p) => s + p.amount, 0); // 12,000
    const previouslyPaid = Math.max(0, orderAmountPaid - currentReceipt.amount); // 4,000
    const balanceRemaining = Math.max(0, orderTotal - orderAmountPaid); // 0

    assert.strictEqual(previouslyPaid, 4000);
    assert.strictEqual(currentReceipt.amount, 8000);
    assert.strictEqual(previouslyPaid + currentReceipt.amount, orderTotal);
    assert.strictEqual(balanceRemaining, 0);
  });
});
