/**
 * Bảng giá NVL: STT | [MÃ NVL] | TÊN VẬT TƯ | DVT | GIÁ (VNĐ) | [GHI CHÚ]
 * Có thể dùng cùng khung cột với bảng giá SP (Tên sản phẩm / ĐVT / Giá); không đọc cột bảo hành.
 */

import { normalizeHeaderCell } from "@/lib/import/parse-partners-excel";
import { parseMoneyCell } from "@/lib/import/parse-products-excel";

export type ParsedMaterialImportRow = {
  sourceRow: number;
  code: string;
  stt: number | null;
  name: string;
  unit: string;
  unit_price: number;
  notes: string | null;
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

type MaterialColumnMap = {
  stt?: number;
  /** Mã NVL ghi rõ trên sheet (tuỳ chọn). */
  code?: number;
  name: number;
  unit: number;
  price: number;
  notes?: number;
};

function mapMaterialHeaderRow(row: unknown[]): MaterialColumnMap | null {
  const col: Partial<MaterialColumnMap> = {};
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
    if (
      col.code === undefined &&
      ((n.includes("MA") && (n.includes("NVL") || n.includes("VAT TU"))) ||
        (n.includes("MA") && n.includes("HANG")) ||
        n === "SKU" ||
        n === "ITEM CODE")
    ) {
      col.code = i;
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
      (n.includes("TEN NVL") ||
        n.includes("TEN VAT TU") ||
        n.includes("NGUYEN VAT LIEU") ||
        (n.includes("VAT TU") && n.includes("TEN")) ||
        (n.includes("TEN") && n.includes("HANG") && (n.includes("KHO") || n.includes("NHAP"))) ||
        n.includes("TEN SAN PHAM") ||
        (n.includes("TEN") && n.includes("PHAM")) ||
        (n.includes("TEN") && /\bSP\b/.test(n)))
    ) {
      col.name = i;
      continue;
    }
  }

  if (col.name === undefined || col.unit === undefined || col.price === undefined) return null;
  return col as MaterialColumnMap;
}

export function findMaterialsHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 80);
  for (let r = 0; r < max; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    if (mapMaterialHeaderRow(row)) return r;
  }
  return -1;
}

function pick(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return cellStr(row[idx]);
}

/** Mã nội bộ từ cột mã, STT hoặc thứ tự dòng (NVL-0001). */
export function materialCodeFromRow(
  explicitCode: string,
  sttCell: unknown,
  colStt: number | undefined,
  fallbackOrdinal: number,
): string {
  const ex = explicitCode.trim();
  if (ex) return ex.slice(0, 200);

  if (colStt !== undefined) {
    const raw = cellStr(sttCell);
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > 0) {
      return "NVL-" + String(n).padStart(4, "0");
    }
  }
  return "NVL-R" + String(fallbackOrdinal).padStart(4, "0");
}

export function parseMaterialsPriceSheet(aoa: unknown[][]): {
  rows: ParsedMaterialImportRow[];
  errors: string[];
} {
  const headerIdx = findMaterialsHeaderRow(aoa);
  if (headerIdx < 0) {
    throw new Error(
      "Không tìm thấy tiêu đề bảng NVL (cần cột Tên vật tư/NVL hoặc Tên sản phẩm, ĐVT, Giá).",
    );
  }
  const headerRow = aoa[headerIdx];
  if (!Array.isArray(headerRow)) throw new Error("Dòng tiêu đề không hợp lệ.");
  const col = mapMaterialHeaderRow(headerRow);
  if (!col) throw new Error("Không map được cột từ tiêu đề.");

  const rows: ParsedMaterialImportRow[] = [];
  const errors: string[] = [];
  let ordinal = 0;

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r];
    if (!Array.isArray(line)) continue;

    const name = pick(line, col.name).trim();
    if (!name) {
      const nonEmpty = line.some((c) => cellStr(c) !== "");
      if (!nonEmpty) continue;
      errors.push("Dòng " + (r + 1) + ": thiếu tên vật tư (bỏ qua).");
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

    const explicitCode = col.code !== undefined ? pick(line, col.code) : "";
    const code = materialCodeFromRow(explicitCode, sttRaw, col.stt, ordinal);

    const notesRaw = pick(line, col.notes);
    const notes = notesRaw.trim() ? notesRaw.trim().slice(0, 500) : null;

    rows.push({
      sourceRow: r + 1,
      code,
      stt,
      name: name.slice(0, 500),
      unit: unit.slice(0, 50),
      unit_price: price,
      notes,
    });
  }

  return { rows, errors };
}
