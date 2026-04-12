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

export const labOrderStatusOptions = [
  { value: "draft", label: "Nháp" },
  { value: "in_progress", label: "Đang làm" },
  { value: "completed", label: "Hoàn thành" },
  { value: "delivered", label: "Đã giao" },
  { value: "cancelled", label: "Đã hủy" },
] as const;

export function formatOrderStatus(s: string) {
  return statusLabels[s] ?? s;
}

/** Badge pill (Tailwind) theo trạng thái đơn — tách màu rõ trên nền sáng/tối. */
export function orderStatusBadgeClassName(status: string): string {
  const base =
    "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums";
  switch (status) {
    case "draft":
      return (
        base +
        " bg-slate-500/18 text-slate-800 ring-1 ring-inset ring-slate-500/25 dark:bg-slate-500/25 dark:text-slate-100 dark:ring-slate-400/30"
      );
    case "in_progress":
      return (
        base +
        " bg-sky-500/18 text-sky-900 ring-1 ring-inset ring-sky-500/30 dark:bg-sky-500/22 dark:text-sky-50 dark:ring-sky-400/35"
      );
    case "completed":
      return (
        base +
        " bg-emerald-500/18 text-emerald-900 ring-1 ring-inset ring-emerald-500/28 dark:bg-emerald-500/22 dark:text-emerald-50 dark:ring-emerald-400/35"
      );
    case "delivered":
      return (
        base +
        " bg-violet-500/18 text-violet-900 ring-1 ring-inset ring-violet-500/28 dark:bg-violet-500/22 dark:text-violet-50 dark:ring-violet-400/35"
      );
    case "cancelled":
      return (
        base +
        " bg-rose-500/18 text-rose-900 ring-1 ring-inset ring-rose-500/30 dark:bg-rose-500/22 dark:text-rose-50 dark:ring-rose-400/35"
      );
    default:
      return base + " bg-[var(--surface-muted)] text-[var(--on-surface)]";
  }
}

const movementLabels: Record<string, string> = {
  inbound: "Nhập kho",
  outbound: "Xuất kho",
};

export function formatMovement(t: string) {
  return movementLabels[t] ?? t;
}

const postingLabels: Record<string, string> = {
  draft: "Yêu cầu (chưa trừ tồn)",
  posted: "Đã ghi nhận tồn",
};

export function formatPostingStatus(s: string) {
  return postingLabels[s] ?? s;
}

const dirLabels: Record<string, string> = {
  receipt: "Thu",
  payment: "Chi",
};

export function formatCashDirection(d: string) {
  return dirLabels[d] ?? d;
}
