/** Công thức GBTT: (cộng dòng × (1 − CK%)) − CK VNĐ + phí khác. */
export function computeOrderGrandTotal(t: {
  subtotal_lines: number;
  billing_order_discount_percent: number;
  billing_order_discount_amount: number;
  billing_other_fees: number;
}): number {
  const afterPct = t.subtotal_lines * (1 - t.billing_order_discount_percent / 100);
  return Math.round((afterPct - t.billing_order_discount_amount + t.billing_other_fees) * 100) / 100;
}
