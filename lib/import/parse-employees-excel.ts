/**
 * Bảng lương / danh sách NV: MÃ NCC (mã NV) | TÊN NHÂN VIÊN | VAI TRÒ | MỨC LƯƠNG | …
 * Cột CHI TM / CHI CK (nếu có) bị bỏ qua khi đồng bộ master nhân viên.
 */

import { normalizeHeaderCell } from "@/lib/import/parse-partners-excel";
import { parseMoneyCell } from "@/lib/import/parse-products-excel";

export type ParsedEmployeeImportRow = {
  sourceRow: number;
  code: string;
  full_name: string;
  role: string;
  base_salary: number;
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

type EmployeePayrollColumnMap = {
  code: number;
  full_name: number;
  role: number;
  base_salary: number;
};

function mapEmployeePayrollHeaderRow(row: unknown[]): EmployeePayrollColumnMap | null {
  const col: Partial<EmployeePayrollColumnMap> = {};
  for (let i = 0; i < row.length; i++) {
    const n = normalizeHeaderCell(cellStr(row[i]));
    if (!n) continue;

    if (
      col.code === undefined &&
      n.includes("MA") &&
      (n.includes("NV") || n.includes("NCC")) &&
      !n.includes("THUE")
    ) {
      col.code = i;
      continue;
    }
    if (
      col.full_name === undefined &&
      ((n.includes("TEN") && n.includes("NHAN VIEN")) ||
        n.includes("HO TEN") ||
        n.includes("HO VA TEN"))
    ) {
      col.full_name = i;
      continue;
    }
    if (
      col.role === undefined &&
      (n.includes("VAI TRO") || n.includes("CHUC VU") || n.includes("CHUC DANH"))
    ) {
      col.role = i;
      continue;
    }
    if (
      col.base_salary === undefined &&
      (n.includes("MUC LUONG") ||
        n.includes("LUONG CO BAN") ||
        n.includes("LUONGCB") ||
        (n.includes("LUONG") && n.includes("CB")))
    ) {
      col.base_salary = i;
      continue;
    }
  }

  if (
    col.code === undefined ||
    col.full_name === undefined ||
    col.role === undefined ||
    col.base_salary === undefined
  ) {
    return null;
  }
  return col as EmployeePayrollColumnMap;
}

export function findEmployeesPayrollHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 120);
  for (let r = 0; r < max; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    if (mapEmployeePayrollHeaderRow(row)) return r;
  }
  return -1;
}

function pick(row: unknown[], idx: number): string {
  return cellStr(row[idx]);
}

export function parseEmployeesPayrollSheet(aoa: unknown[][]): {
  rows: ParsedEmployeeImportRow[];
  errors: string[];
} {
  const headerIdx = findEmployeesPayrollHeaderRow(aoa);
  if (headerIdx < 0) {
    throw new Error(
      "Không tìm thấy tiêu đề bảng nhân viên (cần cột Mã NV/Mã NCC, Tên nhân viên, Vai trò, Mức lương).",
    );
  }
  const headerRow = aoa[headerIdx];
  if (!Array.isArray(headerRow)) throw new Error("Dòng tiêu đề không hợp lệ.");
  const col = mapEmployeePayrollHeaderRow(headerRow);
  if (!col) throw new Error("Không map được cột từ tiêu đề.");

  const rows: ParsedEmployeeImportRow[] = [];
  const errors: string[] = [];

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r];
    if (!Array.isArray(line)) continue;

    const nonEmpty = line.some((c) => cellStr(c) !== "");
    if (!nonEmpty) continue;

    const code = pick(line, col.code).trim();
    const full_name = pick(line, col.full_name).trim();
    const role = pick(line, col.role).trim();

    if (!code) {
      errors.push("Dòng " + (r + 1) + ": thiếu mã NV (Mã NCC / Mã NV).");
      continue;
    }
    if (!full_name) {
      errors.push("Dòng " + (r + 1) + ": thiếu tên nhân viên.");
      continue;
    }
    if (!role) {
      errors.push("Dòng " + (r + 1) + ": thiếu vai trò.");
      continue;
    }

    const base_salary = parseMoneyCell(line[col.base_salary]);
    if (!Number.isFinite(base_salary) || base_salary < 0) {
      errors.push("Dòng " + (r + 1) + ": mức lương không hợp lệ.");
      continue;
    }

    rows.push({
      sourceRow: r + 1,
      code: code.slice(0, 100),
      full_name: full_name.slice(0, 500),
      role: role.slice(0, 200),
      base_salary,
    });
  }

  return { rows, errors };
}
