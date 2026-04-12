/**
 * Bảng công nợ: STT | MÃ KH | TÊN KHÁCH HÀNG | NỢ ĐẦU KỲ | PHÁT SINH TRONG KỲ | THANH TOÁN TRONG KỲ | TỔNG NỢ CUỐI KỲ
 * (Tiêu đề có thể có dòng «THÁNG 04 2026» phía trên.)
 */

import { normalizeHeaderCell } from "@/lib/import/parse-partners-excel";
import { parseMoneyCell } from "@/lib/import/parse-products-excel";

export type ParsedDebtImportRow = {
  sourceRow: number;
  code: string;
  name: string;
  opening: number;
  incurred: number | null;
  paid: number | null;
  closing: number | null;
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

type DebtColumnMap = {
  code: number;
  name?: number;
  opening: number;
  incurred?: number;
  paid?: number;
  closing?: number;
};

function mapDebtHeaderRow(row: unknown[]): DebtColumnMap | null {
  const col: Partial<DebtColumnMap> = {};
  for (let i = 0; i < row.length; i++) {
    const n = normalizeHeaderCell(cellStr(row[i]));
    if (!n) continue;

    if (col.code === undefined && n.includes("MA") && n.includes("KH") && !n.includes("THUE")) {
      col.code = i;
      continue;
    }
    if (
      col.name === undefined &&
      (n.includes("TEN KHACH HANG") || (n.includes("TEN") && n.includes("KHACH")))
    ) {
      col.name = i;
      continue;
    }
    if (
      col.opening === undefined &&
      (n.includes("NO DAU KY") || (n.includes("DAU KY") && n.includes("NO") && !n.includes("CUOI")))
    ) {
      col.opening = i;
      continue;
    }
    if (col.incurred === undefined && n.includes("PHAT SINH") && n.includes("TRONG KY")) {
      col.incurred = i;
      continue;
    }
    if (col.paid === undefined && n.includes("THANH TOAN") && n.includes("TRONG KY")) {
      col.paid = i;
      continue;
    }
    if (
      col.closing === undefined &&
      n.includes("CUOI KY") &&
      n.includes("NO") &&
      (n.includes("TONG") || n.includes("CONG"))
    ) {
      col.closing = i;
      continue;
    }
  }

  if (col.code === undefined || col.opening === undefined) return null;
  return col as DebtColumnMap;
}

export function findDebtHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 100);
  for (let r = 0; r < max; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    if (mapDebtHeaderRow(row)) return r;
  }
  return -1;
}

function pick(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return cellStr(row[idx]);
}

function parseOptionalMoney(line: unknown[], idx: number | undefined): number | null {
  if (idx === undefined) return null;
  const v = parseMoneyCell(line[idx]!);
  if (!Number.isFinite(v)) return null;
  return v;
}

/** Đọc «THÁNG 04 2026» trên vài dòng đầu (đối chiếu với tháng chọn trên UI). */
export function tryParseDebtPeriodBanner(aoa: unknown[][]): { month: number; year: number } | null {
  const max = Math.min(aoa.length, 30);
  const re = /THANG\s*(\d{1,2})\s+(\d{4})/i;
  for (let r = 0; r < max; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    for (const c of row) {
      const raw = cellStr(c)
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toUpperCase()
        .replace(/\s+/g, " ");
      const m = raw.match(re);
      if (m) {
        const mo = Number(m[1]);
        const y = Number(m[2]);
        if (mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) return { month: mo, year: y };
      }
    }
  }
  return null;
}

function isLikelySummaryCode(code: string): boolean {
  const n = code
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!n || n === "-" || n === "—") return true;
  if (n.includes("TONG") && (n.includes("CONG") || n.includes("NO"))) return true;
  return false;
}

export function parseDebtSheet(aoa: unknown[][]): {
  rows: ParsedDebtImportRow[];
  errors: string[];
} {
  const headerIdx = findDebtHeaderRow(aoa);
  if (headerIdx < 0) {
    throw new Error(
      "Không tìm thấy tiêu đề bảng công nợ (cần cột Mã KH và Nợ đầu kỳ).",
    );
  }
  const headerRow = aoa[headerIdx];
  if (!Array.isArray(headerRow)) throw new Error("Dòng tiêu đề không hợp lệ.");
  const col = mapDebtHeaderRow(headerRow);
  if (!col) throw new Error("Không map được cột từ tiêu đề.");

  const rows: ParsedDebtImportRow[] = [];
  const errors: string[] = [];

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r];
    if (!Array.isArray(line)) continue;

    const nonEmpty = line.some((c) => cellStr(c) !== "");
    if (!nonEmpty) continue;

    const code = pick(line, col.code).trim();
    if (!code || isLikelySummaryCode(code)) continue;

    const name = pick(line, col.name).trim();
    const opening = parseMoneyCell(line[col.opening]);
    if (!Number.isFinite(opening)) {
      errors.push("Dòng " + (r + 1) + ": nợ đầu kỳ không hợp lệ (bỏ qua dòng).");
      continue;
    }

    const incurred = parseOptionalMoney(line, col.incurred);
    const paid = parseOptionalMoney(line, col.paid);
    const closing = parseOptionalMoney(line, col.closing);

    if (incurred !== null && paid !== null && closing !== null) {
      const expected = Math.round((opening + incurred - paid) * 100) / 100;
      if (Math.abs(expected - closing) > 0.05) {
        errors.push(
          "Dòng " +
            (r + 1) +
            ": cảnh báo — nợ đầu + phát sinh − thanh toán (" +
            expected +
            ") khác tổng nợ cuối kỳ trong file (" +
            closing +
            ").",
        );
      }
    }

    rows.push({
      sourceRow: r + 1,
      code: code.slice(0, 200),
      name: name.slice(0, 500),
      opening: Math.round(opening * 100) / 100,
      incurred,
      paid,
      closing,
    });
  }

  return { rows, errors };
}
