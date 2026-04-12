/** Số răng cố định FDI (permanent). */
export const FDI_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11] as const;
export const FDI_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28] as const;
export const FDI_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41] as const;
export const FDI_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38] as const;

export const ALL_FDI_PERMANENT: readonly number[] = [
  ...FDI_UPPER_RIGHT,
  ...FDI_UPPER_LEFT,
  ...FDI_LOWER_LEFT,
  ...FDI_LOWER_RIGHT,
];

/** Tách chuỗi vị trí răng thành tập số (hỗ trợ 11,12, 21-23). */
export function parseToothPositionsToSet(text: string): Set<number> {
  const set = new Set<number>();
  const parts = text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    const m = /^(\d{2})\s*-\s*(\d{2})$/.exec(p);
    if (m) {
      const a = Number.parseInt(m[1]!, 10);
      const b = Number.parseInt(m[2]!, 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let t = lo; t <= hi; t++) set.add(t);
      }
      continue;
    }
    const n = Number.parseInt(p, 10);
    if (Number.isFinite(n) && n >= 11 && n <= 48) set.add(n);
  }
  return set;
}

export function sortTeeth(nums: Iterable<number>): number[] {
  return [...new Set(nums)].filter((n) => n >= 11 && n <= 48).sort((a, b) => a - b);
}

/** Chuỗi gọn: 11,12,13 hoặc khoảng liền 11-13. */
export function formatTeethSelection(nums: Iterable<number>): string {
  const sorted = sortTeeth(nums);
  if (!sorted.length) return "";
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    if (j > i) parts.push(String(sorted[i]!) + "-" + String(sorted[j]!));
    else parts.push(String(sorted[i]!));
    i = j + 1;
  }
  return parts.join(", ");
}
