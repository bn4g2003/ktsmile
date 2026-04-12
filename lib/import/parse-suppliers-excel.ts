/**
 * Sheet NCC: MÃ NCC | TÊN CÔNG TY | MÃ SỐ THUẾ | ĐT DĐ | ĐỊA CHỈ | GHI CHÚ
 */

import { normalizeHeaderCell } from "@/lib/import/parse-partners-excel";

export type ParsedSupplierImportRow = {
  sourceRow: number;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

type SupplierColumnMap = {
  code: number;
  name: number;
  tax?: number;
  phone?: number;
  address?: number;
  notes?: number;
};

function mapSupplierHeaderRow(row: unknown[]): SupplierColumnMap | null {
  const col: Partial<SupplierColumnMap> = {};
  for (let i = 0; i < row.length; i++) {
    const n = normalizeHeaderCell(cellStr(row[i]));
    if (!n) continue;

    if (col.code === undefined && n.includes("NCC") && n.includes("MA")) {
      col.code = i;
      continue;
    }
    if (col.notes === undefined && (n.includes("GHI CHU") || n === "GHICHU" || n.includes("NOTE"))) {
      col.notes = i;
      continue;
    }
    if (col.address === undefined && (n.includes("DIA CHI") || n === "DIACHI")) {
      col.address = i;
      continue;
    }
    if (
      col.tax === undefined &&
      (n.includes("MA SO THUE") || (n.includes("THUE") && n.includes("SO")) || n === "MST")
    ) {
      col.tax = i;
      continue;
    }
    if (
      col.phone === undefined &&
      ((n.includes("DT") && (n.includes("DD") || n.includes("DONG"))) ||
        n.includes("DIENTHOAI") ||
        n === "SDT")
    ) {
      col.phone = i;
      continue;
    }
    if (
      col.name === undefined &&
      (n.includes("TEN CONG TY") || (n.includes("CONG TY") && n.includes("TEN")))
    ) {
      col.name = i;
      continue;
    }
  }

  if (col.code === undefined || col.name === undefined) return null;
  return col as SupplierColumnMap;
}

export function findSupplierHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 80);
  for (let r = 0; r < max; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    if (mapSupplierHeaderRow(row)) return r;
  }
  return -1;
}

function pick(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return cellStr(row[idx]);
}

export function parseSuppliersSheet(aoa: unknown[][]): {
  rows: ParsedSupplierImportRow[];
  errors: string[];
} {
  const headerIdx = findSupplierHeaderRow(aoa);
  if (headerIdx < 0) {
    throw new Error(
      "Không tìm thấy dòng tiêu đề NCC (cần cột “Mã NCC” và “Tên công ty”).",
    );
  }
  const headerRow = aoa[headerIdx];
  if (!Array.isArray(headerRow)) throw new Error("Dòng tiêu đề không hợp lệ.");
  const col = mapSupplierHeaderRow(headerRow);
  if (!col) throw new Error("Không map được cột từ tiêu đề NCC.");

  const rows: ParsedSupplierImportRow[] = [];
  const errors: string[] = [];

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r];
    if (!Array.isArray(line)) continue;
    const code = pick(line, col.code);
    if (!code) {
      const nonEmpty = line.some((c) => cellStr(c) !== "");
      if (!nonEmpty) continue;
      errors.push("Dòng " + (r + 1) + ": thiếu mã NCC (bỏ qua).");
      continue;
    }

    const name = pick(line, col.name).trim();
    if (!name) {
      errors.push("Dòng " + (r + 1) + ": thiếu tên công ty.");
      continue;
    }

    const ph = pick(line, col.phone);
    const addr = pick(line, col.address);
    const tax = pick(line, col.tax);
    const nt = pick(line, col.notes);

    rows.push({
      sourceRow: r + 1,
      code,
      name: name.slice(0, 500),
      phone: ph ? ph.slice(0, 100) : null,
      address: addr ? addr.slice(0, 1000) : null,
      tax_id: tax ? tax.slice(0, 100) : null,
      notes: nt ? nt.slice(0, 2000) : null,
    });
  }

  return { rows, errors };
}
