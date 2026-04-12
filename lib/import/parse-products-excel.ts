/**
 * Bảng giá SP: STT | TÊN SẢN PHẨM | DVT | GIÁ (VNĐ) | BẢO HÀNH (năm) | GHI CHÚ
 */

import { normalizeHeaderCell } from "@/lib/import/parse-partners-excel";

export type ParsedProductImportRow = {
  sourceRow: number;
  code: string;
  stt: number | null;
  name: string;
  unit: string;
  unit_price: number;
  warranty_years: number | null;
  notes: string | null;
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

export function parseMoneyCell(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.round(v * 100) / 100;
  }
  let s = cellStr(v).replace(/[₫đ\s]/gi, "").replace(/VNĐ/gi, "");
  if (!s) return NaN;
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastC = s.lastIndexOf(",");
    const lastD = s.lastIndexOf(".");
    if (lastC > lastD) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1]!.length <= 2) {
      s = parts[0]!.replace(/\./g, "") + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length === 2 && parts[1]!.length <= 2) {
      s = parts[0]!.replace(/,/g, "") + "." + parts[1];
    } else {
      s = s.replace(/\./g, "");
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function parseIntCell(v: unknown): number | null {
  if (v == null || cellStr(v) === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const n = parseInt(cellStr(v).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type ProductColumnMap = {
  stt?: number;
  name: number;
  unit: number;
  price: number;
  warranty?: number;
  notes?: number;
};

function mapProductHeaderRow(row: unknown[]): ProductColumnMap | null {
  const col: Partial<ProductColumnMap> = {};
  for (let i = 0; i < row.length; i++) {
    const n = normalizeHeaderCell(cellStr(row[i]));
    if (!n) continue;

    if (col.stt === undefined && (n === "STT" || n.startsWith("STT ") || /^STT[\/\s]/.test(n))) {
      col.stt = i;
      continue;
    }
    if (col.notes === undefined && (n.includes("GHI CHU") || n === "GHICHU")) {
      col.notes = i;
      continue;
    }
    if (col.warranty === undefined && (n.includes("BAO HANH") || (n.includes("BH") && n.includes("NAM")))) {
      col.warranty = i;
      continue;
    }
    if (col.unit === undefined && (n === "DVT" || n.includes("DON VI TINH") || n.includes("DONVITINH"))) {
      col.unit = i;
      continue;
    }
    if (col.price === undefined && (n.includes("GIA") || n.includes("DON GIA"))) {
      col.price = i;
      continue;
    }
    if (
      col.name === undefined &&
      (n.includes("TEN SAN PHAM") ||
        (n.includes("TEN") && n.includes("PHAM")) ||
        (n.includes("TEN") && /\bSP\b/.test(n)))
    ) {
      col.name = i;
      continue;
    }
  }

  if (col.name === undefined || col.unit === undefined || col.price === undefined) return null;
  return col as ProductColumnMap;
}

export function findProductsHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 80);
  for (let r = 0; r < max; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    if (mapProductHeaderRow(row)) return r;
  }
  return -1;
}

function pick(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return cellStr(row[idx]);
}

/** Mã nội bộ từ STT hoặc thứ tự dòng (BG-0001). */
export function productCodeFromRow(
  sttCell: unknown,
  colStt: number | undefined,
  fallbackOrdinal: number,
): string {
  if (colStt !== undefined) {
    const raw = cellStr(sttCell);
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > 0) {
      return "BG-" + String(n).padStart(4, "0");
    }
  }
  return "BG-R" + String(fallbackOrdinal).padStart(4, "0");
}

export function parseProductsPriceSheet(aoa: unknown[][]): {
  rows: ParsedProductImportRow[];
  errors: string[];
} {
  const headerIdx = findProductsHeaderRow(aoa);
  if (headerIdx < 0) {
    throw new Error(
      "Không tìm thấy tiêu đề bảng giá (cần cột Tên sản phẩm, ĐVT, Giá).",
    );
  }
  const headerRow = aoa[headerIdx];
  if (!Array.isArray(headerRow)) throw new Error("Dòng tiêu đề không hợp lệ.");
  const col = mapProductHeaderRow(headerRow);
  if (!col) throw new Error("Không map được cột từ tiêu đề.");

  const rows: ParsedProductImportRow[] = [];
  const errors: string[] = [];
  let ordinal = 0;

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r];
    if (!Array.isArray(line)) continue;

    const name = pick(line, col.name).trim();
    if (!name) {
      const nonEmpty = line.some((c) => cellStr(c) !== "");
      if (!nonEmpty) continue;
      errors.push("Dòng " + (r + 1) + ": thiếu tên sản phẩm (bỏ qua).");
      continue;
    }

    const unit = pick(line, col.unit).trim();
    if (!unit) {
      errors.push("Dòng " + (r + 1) + ": thiếu ĐVT.");
      continue;
    }

    const price = parseMoneyCell(col.price !== undefined ? line[col.price] : "");
    if (!Number.isFinite(price) || price < 0) {
      errors.push("Dòng " + (r + 1) + ": giá không hợp lệ.");
      continue;
    }

    ordinal += 1;
    const sttRaw = col.stt !== undefined ? line[col.stt] : undefined;
    const sttNum =
      sttRaw !== undefined ? parseInt(cellStr(sttRaw).replace(/\D/g, ""), 10) : NaN;
    const stt = Number.isFinite(sttNum) && sttNum > 0 ? sttNum : null;

    const code = productCodeFromRow(sttRaw, col.stt, ordinal);

    const wy =
      col.warranty !== undefined ? parseIntCell(line[col.warranty]) : null;

    const notesRaw = pick(line, col.notes);
    const notes = notesRaw.trim() ? notesRaw.trim().slice(0, 500) : null;

    rows.push({
      sourceRow: r + 1,
      code,
      stt,
      name: name.slice(0, 500),
      unit: unit.slice(0, 50),
      unit_price: price,
      warranty_years: wy !== null && wy >= 0 ? Math.min(wy, 32767) : null,
      notes,
    });
  }

  return { rows, errors };
}
