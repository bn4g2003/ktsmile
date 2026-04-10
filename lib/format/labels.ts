export type PartnerType = "customer_clinic" | "customer_labo" | "supplier";

const partnerTypeLabels: Record<PartnerType, string> = {
  customer_clinic: "Khách — Phòng khám",
  customer_labo: "Khách — Labo",
  supplier: "Nhà cung cấp",
};

export function formatPartnerType(t: PartnerType | string) {
  return partnerTypeLabels[t as PartnerType] ?? t;
}

const statusLabels: Record<string, string> = {
  draft: "Nháp",
  in_progress: "Đang làm",
  completed: "Hoàn thành",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

export function formatOrderStatus(s: string) {
  return statusLabels[s] ?? s;
}

const movementLabels: Record<string, string> = {
  inbound: "Nhập kho",
  outbound: "Xuất kho",
};

export function formatMovement(t: string) {
  return movementLabels[t] ?? t;
}

const dirLabels: Record<string, string> = {
  receipt: "Thu",
  payment: "Chi",
};

export function formatCashDirection(d: string) {
  return dirLabels[d] ?? d;
}
