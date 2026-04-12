/** Ký tự phân tách nhiều giá trị trong một filter (tránh trùng dấu phẩy trong mã). */
export const GRID_MULTI_FILTER_SEP = "\u001e";

export function encodeMultiFilter(values: readonly string[]): string {
  const uniq = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  return uniq.join(GRID_MULTI_FILTER_SEP);
}

export function decodeMultiFilter(raw: string | undefined): string[] {
  if (raw == null || raw === "") return [];
  return raw
    .split(GRID_MULTI_FILTER_SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Lọc is_active đa chọn: rỗng = tất cả; một giá trị = eq; chọn cả hai = tất cả.
 * @returns null nếu không cần .eq
 */
export function narrowIsActiveFilter(raw: string | undefined): boolean | null {
  const vals = decodeMultiFilter(raw);
  if (vals.length === 0) return null;
  const bools = new Set<boolean>();
  for (const v of vals) {
    if (v === "true") bools.add(true);
    if (v === "false") bools.add(false);
  }
  if (bools.size !== 1) return null;
  return [...bools][0]!;
}
