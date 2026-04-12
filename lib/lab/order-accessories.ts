/** Phụ kiện kèm đơn — đồng bộ mẫu form labo phổ biến. */
export const LAB_ORDER_ACCESSORY_DEFS = [
  { key: "opposing_arch", label: "Hàm đối diện" },
  { key: "impression_tray", label: "Khay lấy dấu" },
  { key: "bite_wax", label: "Sáp cắn" },
  { key: "articulator", label: "Giá khớp sắt / nhựa" },
  { key: "framework", label: "Hàm khung" },
  { key: "abutment", label: "Trụ abutment" },
] as const;

export type LabAccessoryKey = (typeof LAB_ORDER_ACCESSORY_DEFS)[number]["key"];

export function accessoriesToJson(obj: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number" && v > 0 && Number.isFinite(v)) out[k] = Math.floor(v);
  }
  return out;
}

export function parseAccessoriesJson(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of Object.keys(o)) {
    const n = Number(o[k]);
    if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}
