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

/** Tách chuỗi vị trí răng thành tập số (hỗ trợ 11,12, 21-23, CR46-48). */
export function parseToothPositionsToSet(text: string): Set<number> {
  const set = new Set<number>();
  const parts = text
    .split(/,|;/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    // Xử lý "CR46-48" hoặc "CR 46-48"
    const crMatch = /^CR\s*(\d{2})\s*-\s*(\d{2})$/i.exec(p);
    if (crMatch) {
      const a = Number.parseInt(crMatch[1]!, 10);
      const b = Number.parseInt(crMatch[2]!, 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let t = lo; t <= hi; t++) set.add(t);
      }
      continue;
    }
    // Xử lý khoảng "46-48"
    const rangeMatch = /^(\d{2})\s*-\s*(\d{2})$/.exec(p);
    if (rangeMatch) {
      const a = Number.parseInt(rangeMatch[1]!, 10);
      const b = Number.parseInt(rangeMatch[2]!, 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let t = lo; t <= hi; t++) set.add(t);
      }
      continue;
    }
    // Xử lý số đơn "46"
    const n = Number.parseInt(p, 10);
    if (Number.isFinite(n) && n >= 11 && n <= 48) set.add(n);
  }
  return set;
}

export function sortTeeth(nums: Iterable<number>): number[] {
  return [...new Set(nums)].filter((n) => n >= 11 && n <= 48).sort((a, b) => a - b);
}

/** Chuỗi gọn: 11,12,13 hoặc khoảng liền 11-13. Thêm "CR" cho từng nhóm cầu răng. */
export function formatTeethSelection(nums: Iterable<number>): string {
  const sorted = sortTeeth(nums);
  if (!sorted.length) return "";
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    const isBridge = j > i; // Có ít nhất 2 răng liền kề
    const range = isBridge 
      ? String(sorted[i]!) + "-" + String(sorted[j]!)
      : String(sorted[i]!);
    parts.push(isBridge ? "CR" + range : range);
    i = j + 1;
  }
  return parts.join(", ");
}

/**
 * Phát hiện xem các răng được chọn có phải là cầu răng (bridge) hay không.
 * Trả về "bridge" nếu có ít nhất 2 răng liền kề trong cùng một hàm/cung.
 * Trả về "unit" nếu tất cả răng đều rời rạc.
 */
export function detectArchConnection(nums: Iterable<number>): "unit" | "bridge" {
  const sorted = sortTeeth(nums);
  if (sorted.length === 0) return "unit";
  
  // Nhóm răng theo quadrant (hàm/cung)
  const quadrants = new Map<number, number[]>();
  for (const tooth of sorted) {
    const quad = Math.floor(tooth / 10); // 1=upper right, 2=upper left, 3=lower left, 4=lower right
    const arr = quadrants.get(quad) ?? [];
    arr.push(tooth);
    quadrants.set(quad, arr);
  }
  
  // Kiểm tra từng quadrant xem có răng liền kề không
  for (const teeth of quadrants.values()) {
    if (teeth.length < 2) continue;
    
    // Sắp xếp răng trong quadrant
    teeth.sort((a, b) => a - b);
    
    // Kiểm tra có ít nhất 2 răng liền kề
    for (let i = 0; i < teeth.length - 1; i++) {
      if (teeth[i + 1] === teeth[i]! + 1) {
        return "bridge"; // Tìm thấy ít nhất 2 răng liền kề
      }
    }
  }
  
  return "unit"; // Không có răng liền kề nào
}
