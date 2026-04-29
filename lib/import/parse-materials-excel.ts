/**
 * NVL xuất Excel / bảng giá:
 * - Mẫu đầy đủ: Mã NVL | Tên NVL | ĐVT | Đơn giá | Tồn kho (bỏ qua) | NCC chính | Hoạt động
 * - Mẫu cũ: STT | [Mã] | Tên vật tư / SP | ĐVT | Giá | [Ghi chú] — không có cột NCC thì nhập không gắn NCC.
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
  /** Có cột «NCC chính» trong tiêu đề — bắt buộc điền và khớp danh mục NCC. */
  nccColumnPresent: boolean;
  /** Tên NCC từ Excel (đã trim). */
  primary_supplier_trimmed: string;
  is_active: boolean;
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function parseActiveCell(v: unknown, defaultActive: boolean): boolean {
  if (v == null || cellStr(v) === "") return defaultActive;
  if (typeof v === "boolean") return v;
  const s = cellStr(v).toUpperCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (s === "TRUE" || s === "1" || s === "YES" || s === "Y" || s === "CO") return true;
  if (s === "FALSE" || s === "0" || s === "NO" || s === "N" || s === "KHONG") return false;
  return defaultActive;
}

type MaterialColumnMap = {
  stt?: number;
  code?: number;
  name: number;
  unit: number;
  price: number;
  /** Tồn kho — chỉ nhận diện, không dùng khi nhập. */
  stock?: number;
  ncc?: number;
  active?: number;
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
      col.stock === undefined &&
      (n.includes("TON KHO") || n.includes("TONKHO") || n === "SL TON" || n.includes("SO LUONG TON"))
    ) {
      col.stock = i;
      continue;
    }
    if (
      col.active === undefined &&
      (n === "HOAT DONG" ||
        n.includes("KICH HOAT") ||
        n === "ACTIVE" ||
        (n.includes("TRANG") && n.includes("THAI")))
    ) {
      col.active = i;
      continue;
    }
    if (
      col.ncc === undefined &&
      ((n.includes("NCC") && n.includes("CHINH")) ||
        n.includes("NHA CUNG CAP CHINH") ||
        n === "NCC CHINH")
    ) {
      col.ncc = i;
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

  const nccColumnPresent = col.ncc !== undefined;

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

    const primary_supplier_trimmed = nccColumnPresent ? pick(line, col.ncc).trim() : "";
    const is_active = col.active !== undefined ? parseActiveCell(line[col.active!], true) : true;

    if (nccColumnPresent && primary_supplier_trimmed === "") {
      errors.push("Dòng " + (r + 1) + ": thiếu NCC chính (bỏ qua).");
      continue;
    }

    rows.push({
      sourceRow: r + 1,
      code,
      stt,
      name: name.slice(0, 500),
      unit: unit.slice(0, 50),
      unit_price: price,
      notes,
      nccColumnPresent,
      primary_supplier_trimmed,
      is_active,
    });
  }

  return { rows, errors };
}

/** Chuẩn hoá tên NCC để so khớp (giống tiêu đề cột + thêm biến thể không dấu cách). */
export function supplierNameMatchKeys(label: string): string[] {
  const n = normalizeHeaderCell(label);
  const compact = n.replace(/\s+/g, "");
  const out: string[] = [];
  if (n) out.push(n);
  if (compact && compact !== n) out.push(compact);
  return out;
}
