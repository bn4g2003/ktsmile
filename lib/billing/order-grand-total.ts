/** Tránh NaN/Infinity — Next.js serialize server action có thể lỗi với NaN. */
export function finiteNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Công thức GBTT: (cộng dòng × (1 − CK%)) − CK VNĐ + phí khác. */
export function computeOrderGrandTotal(t: {
  subtotal_lines: number;
  billing_order_discount_percent: number;
  billing_order_discount_amount: number;
  billing_other_fees: number;
}): number {
  const subtotal_lines = finiteNumber(t.subtotal_lines);
  const billing_order_discount_percent = finiteNumber(t.billing_order_discount_percent);
  const billing_order_discount_amount = finiteNumber(t.billing_order_discount_amount);
  const billing_other_fees = finiteNumber(t.billing_other_fees);
  const afterPct = subtotal_lines * (1 - billing_order_discount_percent / 100);
  const out = Math.round((afterPct - billing_order_discount_amount + billing_other_fees) * 100) / 100;
  return Number.isFinite(out) ? out : 0;
}
