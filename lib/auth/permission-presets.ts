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
  manager: ["/", "/master/partners", "/master/products", "/master/employees", "/orders", "/orders/review", "/inventory/documents", "/inventory/stock", "/accounting/revenue", "/accounting/sales", "/accounting/cash", "/accounting/debt", "/accounting/summary", "/hr/attendance", "/hr/payroll"],
  accountant: ["/", "/master/partners", "/orders", "/accounting/revenue", "/accounting/sales", "/accounting/cash", "/accounting/debt", "/accounting/summary", "/hr/payroll"],
  sales: ["/", "/master/partners", "/master/prices", "/orders", "/orders/review", "/accounting/revenue", "/accounting/sales", "/accounting/debt", "/accounting/summary"],
  inventory: ["/", "/master/products", "/orders", "/inventory/documents", "/inventory/stock", "/hr/attendance"],
  staff: ["/", "/orders", "/hr/attendance"],
};

export function permissionPresetLabel(id: string | null | undefined) {
  if (!id) return "—";
  return PERMISSION_PRESETS.find((p) => p.id === id)?.label ?? id;
}

export function resolvePermissionPreset(id: string | null | undefined): PermissionPresetId {
  if (!id) return "staff";
  const found = PERMISSION_PRESETS.find((p) => p.id === id);
  return (found?.id ?? "staff") as PermissionPresetId;
}
