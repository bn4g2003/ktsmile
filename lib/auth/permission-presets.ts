export const PERMISSION_PRESETS = [
  { id: "admin", label: "Admin (toàn quyền)" },
  { id: "manager", label: "Quản lý vận hành" },
  { id: "accountant", label: "Kế toán" },
  { id: "sales", label: "Kinh doanh / CSKH" },
  { id: "inventory", label: "Kho" },
  { id: "staff", label: "Nhân viên cơ bản" },
] as const;

export type PermissionPresetId = (typeof PERMISSION_PRESETS)[number]["id"];

export const NAV_PERMISSION_RULES: Record<PermissionPresetId, string[]> = {
  admin: ["*"],
  manager: ["/", "/master/partners", "/master/products", "/master/employees", "/orders", "/orders/review", "/inventory/documents", "/inventory/stock", "/accounting/sales", "/accounting/cash", "/accounting/debt"],
  accountant: ["/", "/master/partners", "/orders", "/accounting/sales", "/accounting/cash", "/accounting/debt"],
  sales: ["/", "/master/partners", "/master/prices", "/orders", "/orders/review", "/accounting/sales", "/accounting/debt"],
  inventory: ["/", "/master/products", "/orders", "/inventory/documents", "/inventory/stock"],
  staff: ["/", "/orders"],
};

export function permissionPresetLabel(id: string | null | undefined) {
  if (!id) return "—";
  return PERMISSION_PRESETS.find((p) => p.id === id)?.label ?? id;
}
