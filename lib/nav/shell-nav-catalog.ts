/** Meta menu sidebar (không icon) — dùng cho AppShell và màn phân quyền vai trò. */

export type ShellNavItemMeta = { href: string; label: string };

export type ShellNavGroupMeta = { title: string; items: ShellNavItemMeta[] };

export const SHELL_NAV_GROUPS_META: ShellNavGroupMeta[] = [
  {
    title: "TỔNG QUAN",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "KINH DOANH",
    items: [
      { href: "/orders", label: "Đơn hàng" },
      { href: "/orders/review", label: "Kiểm tra đơn" },
      { href: "/master/partners", label: "Khách & NCC" },
      { href: "/master/prices", label: "Giá theo KH" },
    ],
  },
  {
    title: "KHO HÀNG",
    items: [
      { href: "/master/products", label: "Sản phẩm & NVL" },
      { href: "/inventory/stock", label: "Tồn kho" },
      { href: "/inventory/documents", label: "Phiếu nhập xuất" },
    ],
  },
  {
    title: "TÀI CHÍNH",
    items: [
      { href: "/accounting/revenue", label: "Doanh số theo KH" },
      { href: "/accounting/sales", label: "Doanh số & GBTT" },
      { href: "/accounting/cash", label: "Sổ quỹ" },
      { href: "/accounting/debt", label: "Công nợ khách hàng" },
      { href: "/accounting/summary", label: "Báo cáo tổng hợp" },
    ],
  },
  {
    title: "NHÂN SỰ",
    items: [
      { href: "/master/employees", label: "Hồ sơ nhân sự" },
      { href: "/hr/attendance", label: "Chấm công" },
      { href: "/hr/payroll", label: "Tính lương" },
    ],
  },
];

export const SHELL_NAV_ALLOWED_PATHS: string[] = [
  ...new Set(SHELL_NAV_GROUPS_META.flatMap((g) => g.items.map((it) => it.href))),
].sort((a, b) => a.localeCompare(b));

export const SHELL_NAV_STAR = "*" as const;
