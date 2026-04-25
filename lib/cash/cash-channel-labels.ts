/** Kênh thanh toán mặc định — đồng bộ form sổ quỹ và nhãn hiển thị. */
export const CASH_FUND_CHANNEL_DEFAULTS: { value: string; label: string }[] = [
  { value: "cash", label: "Tiền mặt" },
  { value: "mbbank", label: "MB Bank (Quân đội)" },
  { value: "acb", label: "ACB" },
  { value: "chuyen_khoan", label: "Chuyển khoản" },
  { value: "vietcombank", label: "Vietcombank" },
  { value: "other", label: "Khác" },
];

const LABEL_BY_KEY = Object.fromEntries(
  CASH_FUND_CHANNEL_DEFAULTS.map((x) => [x.value.toLowerCase(), x.label]),
) as Record<string, string>;

/** Hiển thị tên kênh tiếng Việt; kênh tùy chỉnh giữ nguyên chuỗi đã lưu. */
export function formatCashPaymentChannel(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  return LABEL_BY_KEY[s.toLowerCase()] ?? s;
}
