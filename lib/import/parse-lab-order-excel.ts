/**
 * Parse sheet dạng mảng (aoa) từ file đơn hàng lab kiểu Excel tiếng Việt.
 * Tự tìm dòng tiêu đề có "NGÀY NHẬN" + "MÃ KH" (bỏ dấu khi so khớp).
 */

export type ParsedLabOrderLine = {
  receivedAtIso: string;
  partnerCode: string;
  patientName: string;
  /** Gộp vào ghi chú đầu đơn (nha khoa, lab…) */
  clinicName: string;
  labName: string;
  labTruyXuat: string;
  productTypeCode: string;
  productNameHint: string;
  quantity: number;
  unitPrice: number;
  toothPositions: string;
  shade: string;
  lineNote: string;
  productSku: string;
  sourceRow: number;
};

/** Xuất để import khớp tên SP với danh mục. */
export function fold(s: string): string {
  return String(s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

/**
 * Tìm cột theo tiêu đề: ưu tiên khớp đúng (sau khi fold), rồi mới `includes`.
 * Với `includes`, thử needle dài trước để «LAB TRUY XUẤT» không bị nuốt bởi «LAB».
 */
function findCol(headers: string[], ...needles: string[]): number {
  const H = headers.map(fold);
  const folded = needles.map((n) => fold(n));

  for (let i = 0; i < needles.length; i++) {
    const f = folded[i]!;
    const j = H.findIndex((h) => h === f);
    if (j >= 0) return j;
  }

  const byLen = [...folded].sort((a, b) => b.length - a.length);
  for (const f of byLen) {
    const j = H.findIndex((h) => h.includes(f));
    if (j >= 0) return j;
  }
  return -1;
}

function rowLooksLikeLabOrderHeader(row: string[]): boolean {
  const hasNgayNhan = row.some((h) => h.includes("NGAY") && h.includes("NHAN"));
  const hasMaKh = row.some(
    (h) => h === "MA KH" || (h.includes("MA KH") && !h.includes("MA KHACH")),
  );
  return hasNgayNhan && hasMaKh;
}

export function findLabOrderHeaderRow(aoa: unknown[][]): number {
  for (let r = 0; r < aoa.length; r++) {
    const row = (aoa[r] ?? []).map((c) => fold(String(c ?? "")));
    if (rowLooksLikeLabOrderHeader(row)) return r;
  }
  throw new Error(
    "Không tìm thấy dòng tiêu đề. Cần có cột tương đương “NGÀY NHẬN” và “MÃ KH”.",
  );
}

/** Lấy tháng/năm từ ô kiểu «THÁNG 04 2026» phía trên dòng tiêu đề. */
export function findSheetPeriodFromPreamble(
  aoa: unknown[][],
  headerRow: number,
): { year: number; month: number } | null {
  for (let r = 0; r < headerRow; r++) {
    for (const cell of aoa[r] ?? []) {
      const t = fold(String(cell ?? ""));
      const m = t.match(/THANG\s+(\d{1,2})\s+(\d{4})/);
      if (m) {
        const month = Number.parseInt(m[1]!, 10);
        const year = Number.parseInt(m[2]!, 10);
        if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) return { month, year };
      }
    }
  }
  return null;
}

/** @deprecated Dùng findSheetPeriodFromPreamble; giữ để tương thích. */
export function findSheetYearFromPreamble(aoa: unknown[][], headerRow: number): number | null {
  return findSheetPeriodFromPreamble(aoa, headerRow)?.year ?? null;
}

function parseMoney(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.round(v * 100) / 100;
  }
  const raw = String(v ?? "").trim();
  if (!raw) return NaN;
  const cleaned = raw.replace(/\s/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function parseQty(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 10000) / 10000;
  const n = Number.parseFloat(String(v ?? "").replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : NaN;
}

/** dd/MM/yyyy, dd/MM (dùng defaultYear), hoặc số serial Excel. */
export function parseReceivedDate(v: unknown, defaultYear: number): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const x = v;
    if (x > 20000 && x < 60000) {
      const epoch = Date.UTC(1899, 11, 30) + Math.round(x) * 86400000;
      const d = new Date(epoch);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const s = String(v ?? "").trim();
  if (!s) throw new Error("Thiếu ngày nhận.");
  const mFull = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mFull) {
    const dd = mFull[1]!.padStart(2, "0");
    const mm = mFull[2]!.padStart(2, "0");
    const yyyy = mFull[3]!;
    return `${yyyy}-${mm}-${dd}`;
  }
  const mShort = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (mShort) {
    const day = Number.parseInt(mShort[1]!, 10);
    const month = Number.parseInt(mShort[2]!, 10);
    const y = defaultYear;
    const d = new Date(Date.UTC(y, month - 1, day));
    if (
      d.getUTCFullYear() !== y ||
      d.getUTCMonth() !== month - 1 ||
      d.getUTCDate() !== day
    ) {
      throw new Error(`Ngày không hợp lệ: "${s}"`);
    }
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new Error(`Ngày không đúng định dạng dd/MM hoặc dd/MM/yyyy: "${s}"`);
}

export function parseLabOrderSheet(aoa: unknown[][]): ParsedLabOrderLine[] {
  if (!aoa.length) throw new Error("Sheet trống.");
  const headerIdx = findLabOrderHeaderRow(aoa);
  const headerRow = (aoa[headerIdx] ?? []).map((c) => String(c ?? ""));
  const period = findSheetPeriodFromPreamble(aoa, headerIdx);
  const sheetYear = period?.year ?? new Date().getFullYear();
  const sheetMonth = period?.month ?? new Date().getUTCMonth() + 1;
  const defaultDateIso =
    sheetYear +
    "-" +
    String(sheetMonth).padStart(2, "0") +
    "-01";

  const iLabTx = findCol(headerRow, "LAB TRUY XUAT", "LAB TRUY XUẤT");
  const iDate = findCol(headerRow, "NGÀY NHẬN", "NGAY NHAN");
  const iPartner = findCol(headerRow, "MÃ KH", "MA KH");
  const iLab = findCol(headerRow, "LAB");
  const iClinic = findCol(headerRow, "NHA KHOA");
  const iPatient = findCol(headerRow, "BỆNH NHÂN", "BENH NHAN");
  const iType = findCol(headerRow, "MÃ LOẠI", "MA LOAI");
  const iTypeName = findCol(headerRow, "TÊN LOẠI", "TEN LOAI");
  const iQty = findCol(headerRow, "SỐ LƯỢNG", "SO LUONG");
  const iPrice = findCol(headerRow, "ĐƠN GIÁ", "DON GIA");
  const iAmount = findCol(headerRow, "THÀNH TIỀN", "THANH TIEN");
  const iTooth = findCol(headerRow, "VI TRI", "VỊ TRÍ", "VITRI");
  const iShade = findCol(headerRow, "MÀU", "MAU");
  const iNote = findCol(headerRow, "GHI CHÚ", "GHI CHU");
  const iSku = findCol(headerRow, "MÃ SẢN PHẨM", "MA SAN PHAM");

  if (iPartner < 0) {
    throw new Error("Thiếu cột MÃ KH (kiểm tra dòng tiêu đề).");
  }
  if (iType < 0 && iSku < 0 && iTypeName < 0) {
    throw new Error(
      "Cần ít nhất một trong: MÃ LOẠI, MÃ SẢN PHẨM hoặc TÊN LOẠI (để khớp danh mục SP).",
    );
  }

  const pick = (row: unknown[], idx: number) => (idx >= 0 ? String(row[idx] ?? "").trim() : "");

  const out: ParsedLabOrderLine[] = [];

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const partner = pick(row, iPartner);
    const patient = pick(row, iPatient);
    if (!partner && !patient) {
      const nonEmpty = row.some((c) => String(c ?? "").trim() !== "");
      if (!nonEmpty) continue;
    }
    if (!partner) continue;

    /** Nhiều file Excel để trống BN; vẫn nhập đơn, gom dòng cùng KH + ngày + «—». */
    const patientResolved = patient.replace(/\s+/g, " ").trim() || "—";

    let receivedAtIso: string;
    if (iDate >= 0) {
      try {
        receivedAtIso = parseReceivedDate(row[iDate], sheetYear);
      } catch {
        receivedAtIso = defaultDateIso;
      }
    } else {
      receivedAtIso = defaultDateIso;
    }

    let qty = iQty >= 0 ? parseQty(row[iQty]) : NaN;
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;

    let unitPrice = iPrice >= 0 ? parseMoney(row[iPrice]) : NaN;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      const amount = iAmount >= 0 ? parseMoney(row[iAmount]) : NaN;
      if (Number.isFinite(amount) && amount >= 0 && qty > 0) {
        unitPrice = Math.round((amount / qty) * 100) / 100;
      } else {
        unitPrice = 0;
      }
    }

    const typeCode = pick(row, iType);
    const sku = pick(row, iSku);
    const nameHint = pick(row, iTypeName);
    if (!typeCode && !sku && !nameHint.trim()) {
      continue;
    }

    out.push({
      receivedAtIso,
      partnerCode: partner,
      patientName: patientResolved,
      clinicName: pick(row, iClinic),
      labName: pick(row, iLab),
      labTruyXuat: pick(row, iLabTx),
      productTypeCode: typeCode,
      productNameHint: nameHint,
      quantity: qty,
      unitPrice,
      toothPositions: pick(row, iTooth) || "—",
      shade: pick(row, iShade) || "",
      lineNote: pick(row, iNote),
      productSku: sku,
      sourceRow: r + 1,
    });
  }

  if (out.length === 0) throw new Error("Không có dòng dữ liệu sau tiêu đề.");
  return out;
}

export function groupKey(line: ParsedLabOrderLine): string {
  return `${line.receivedAtIso}|${line.partnerCode}|${line.patientName}`;
}
