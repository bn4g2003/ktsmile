/** Danh mục nghiệp vụ thu/chi trên sổ quỹ (giá trị lưu = `value`). */
export type CashBusinessCategoryOption = {
  value: string;
  label: string;
  direction: "receipt" | "payment";
};

export const CASH_BUSINESS_CATEGORIES: CashBusinessCategoryOption[] = [
  { value: "Thu công nợ KH", label: "Thu công nợ khách hàng", direction: "receipt" },
  { value: "Thu bán hàng / dịch vụ", label: "Thu bán hàng / dịch vụ", direction: "receipt" },
  { value: "Thu khác", label: "Thu khác", direction: "receipt" },
  { value: "Chi trả công nợ NCC", label: "Chi trả công nợ nhà cung cấp", direction: "payment" },
  { value: "Chi mua NVL / hàng hoá", label: "Chi mua NVL / hàng hoá", direction: "payment" },
  { value: "Chi lương & BHXH", label: "Chi lương & BHXH", direction: "payment" },
  { value: "Chi vận hành", label: "Chi vận hành (điện, nước, thuê…)", direction: "payment" },
  { value: "Chi khác", label: "Chi khác", direction: "payment" },
];

export function defaultCashBusinessCategory(direction: "receipt" | "payment"): string {
  return CASH_BUSINESS_CATEGORIES.find((c) => c.direction === direction)?.value ?? "";
}
