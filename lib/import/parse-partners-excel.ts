/**
 * Đọc sheet "Danh sách khách hàng" với các cột kiểu:
 * MÃ KH | TÊN CÔNG TY/HỘ KINH DOANH | TÊN NHA KHOA/LABO | TÊN BS/CHỦ LAB | MÃ SỐ THUẾ | ĐT DĐ | ĐỊA CHỈ | HOTLINE
 */

export type ParsedPartnerImportRow = {
  sourceRow: number;
  code: string;
  name: string;
  representative_name: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
};

export function normalizeHeaderCell(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

export type PartnerColumnMap = {
  code: number;
  company?: number;
  clinic?: number;
  representative?: number;
  tax?: number;
  phone?: number;
  address?: number;
  hotline?: number;
};

function mapHeaderRow(row: unknown[]): PartnerColumnMap | null {
  const col: Partial<PartnerColumnMap> = {};
  for (let i = 0; i < row.length; i++) {
    const n = normalizeHeaderCell(cellStr(row[i]));
    if (!n) continue;

    if (col.code === undefined && n.includes("MA") && n.includes("KH") && !n.includes("THUE")) {
      col.code = i;
      continue;
    }
    if (col.hotline === undefined && n.includes("HOTLINE")) {
      col.hotline = i;
      continue;
    }
    if (col.address === undefined && (n.includes("DIA CHI") || n === "DIACHI")) {
      col.address = i;
      continue;
    }
    if (
      col.tax === undefined &&
      (n.includes("MA SO THUE") || n.includes("MST") || (n.includes("THUE") && n.includes("SO")))
    ) {
      col.tax = i;
      continue;
    }
    if (
      col.phone === undefined &&
      ((n.includes("DT") && (n.includes("DD") || n.includes("DONG"))) ||
        n.includes("DIENTHOAI") ||
        n === "SDT" ||
        n.includes("DIEN THOAI"))
    ) {
      col.phone = i;
      continue;
    }
    if (
      col.representative === undefined &&
      (n.includes("BS") || n.includes("CHU LAB") || (n.includes("CHU") && n.includes("LAB")))
    ) {
      col.representative = i;
      continue;
    }
    if (
      col.clinic === undefined &&
      (n.includes("NHA KHOA") || (n.includes("LABO") && n.includes("TEN")))
    ) {
      col.clinic = i;
      continue;
    }
    if (
      col.company === undefined &&
      (n.includes("CONG TY") || n.includes("KINH DOANH") || /\bHO\s/i.test(n) || n.includes("HO KD"))
    ) {
      col.company = i;
      continue;
    }
  }

  if (col.code === undefined) return null;
  return col as PartnerColumnMap;
}

export function findPartnersHeaderRow(aoa: unknown[][]): number {
  const max = Math.min(aoa.length, 80);
  for (let r = 0; r < max; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    if (mapHeaderRow(row)) return r;
  }
  return -1;
}

function pick(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return cellStr(row[idx]);
}

/**
 * Tên hiển thị: ưu tiên cột nha khoa/labo, không có thì công ty/HKD.
 * Ghi chú: nếu có cả hai, lưu dòng "Công ty/HKD: …" vào notes.
 */
function buildNameAndNotes(
  company: string,
  clinic: string,
): { name: string; notesLine: string | null } {
  const c = clinic.trim();
  const co = company.trim();
  if (c && co) {
    return { name: c, notesLine: "Công ty/HKD: " + co };
  }
  if (c) return { name: c, notesLine: null };
  if (co) return { name: co, notesLine: null };
  return { name: "", notesLine: null };
}

function combinePhone(mobile: string, hotline: string): string | null {
  const m = mobile.trim();
  const h = hotline.trim();
  if (m && h) return m + " · Hotline: " + h;
  if (m) return m;
  if (h) return h;
  return null;
}

export function parsePartnersSheet(aoa: unknown[][]): {
  rows: ParsedPartnerImportRow[];
  errors: string[];
} {
  const headerIdx = findPartnersHeaderRow(aoa);
  if (headerIdx < 0) {
    throw new Error(
      "Không tìm thấy dòng tiêu đề có cột “Mã KH”. Kiểm tra file có đúng danh sách khách hàng.",
    );
  }
  const headerRow = aoa[headerIdx];
  if (!Array.isArray(headerRow)) throw new Error("Dòng tiêu đề không hợp lệ.");
  const col = mapHeaderRow(headerRow);
  if (!col) throw new Error("Không map được cột từ tiêu đề.");

  const rows: ParsedPartnerImportRow[] = [];
  const errors: string[] = [];

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r];
    if (!Array.isArray(line)) continue;
    const code = pick(line, col.code);
    if (!code) {
      const nonEmpty = line.some((c) => cellStr(c) !== "");
      if (!nonEmpty) continue;
      errors.push("Dòng " + (r + 1) + ": thiếu mã KH (bỏ qua).");
      continue;
    }

    const company = pick(line, col.company);
    const clinic = pick(line, col.clinic);
    const { name, notesLine } = buildNameAndNotes(company, clinic);
    if (!name) {
      errors.push("Dòng " + (r + 1) + ": thiếu tên (công ty hoặc nha khoa/labo).");
      continue;
    }

    const representative = pick(line, col.representative) || null;
    const tax_id = pick(line, col.tax) || null;
    const address = pick(line, col.address) || null;
    const phone = combinePhone(pick(line, col.phone), pick(line, col.hotline));

    const noteParts: string[] = [];
    if (notesLine) noteParts.push(notesLine);
    const notes = noteParts.length ? noteParts.join("\n").slice(0, 2000) : null;

    rows.push({
      sourceRow: r + 1,
      code,
      name: name.slice(0, 500),
      representative_name: representative ? representative.slice(0, 500) : null,
      phone: phone ? phone.slice(0, 100) : null,
      address: address ? address.slice(0, 1000) : null,
      tax_id: tax_id ? tax_id.slice(0, 100) : null,
      notes,
    });
  }

  return { rows, errors };
}
