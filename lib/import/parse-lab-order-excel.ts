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

function fold(s: string): string {
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

function findCol(headers: string[], ...needles: string[]): number {
  const H = headers.map(fold);
  for (const n of needles) {
    const f = fold(n);
    const i = H.findIndex((h) => h === f || h.includes(f));
    if (i >= 0) return i;
  }
  return -1;
}

export function findLabOrderHeaderRow(aoa: unknown[][]): number {
  for (let r = 0; r < aoa.length; r++) {
    const row = (aoa[r] ?? []).map((c) => fold(String(c ?? "")));
    const joined = row.join(" ");
    if (joined.includes("NGAY NHAN") && (joined.includes("MA KH") || joined.includes("MA KHACH"))) {
      return r;
    }
  }
  throw new Error(
    "Không tìm thấy dòng tiêu đề. Cần có cột tương đương “NGÀY NHẬN” và “MÃ KH”.",
  );
}

/** Lấy năm từ ô kiểu “THÁNG 04 2026” phía trên dòng tiêu đề. */
export function findSheetYearFromPreamble(aoa: unknown[][], headerRow: number): number | null {
  for (let r = 0; r < headerRow; r++) {
    for (const cell of aoa[r] ?? []) {
      const t = fold(String(cell ?? ""));
      const m = t.match(/THANG\s+(\d{1,2})\s+(\d{4})/);
      if (m) return Number.parseInt(m[2]!, 10);
    }
  }
  return null;
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
  const sheetYear =
    findSheetYearFromPreamble(aoa, headerIdx) ?? new Date().getFullYear();

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

  if (iDate < 0 || iPartner < 0 || iPatient < 0 || iQty < 0) {
    throw new Error(
      "Thiếu cột bắt buộc: NGÀY NHẬN, MÃ KH, BỆNH NHÂN, SỐ LƯỢNG (hoặc tên lệch dấu).",
    );
  }
  if (iType < 0 && iSku < 0) {
    throw new Error("Cần ít nhất một cột “MÃ LOẠI” hoặc “MÃ SẢN PHẨM” để xác định sản phẩm.");
  }
  if (iPrice < 0) {
    throw new Error("Thiếu cột “ĐƠN GIÁ”.");
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
    if (!patient) {
      throw new Error(`Dòng ${r + 1}: thiếu tên bệnh nhân (MÃ KH: ${partner}).`);
    }

    let receivedAtIso: string;
    try {
      receivedAtIso = parseReceivedDate(row[iDate], sheetYear);
    } catch (e) {
      throw new Error(`Dòng ${r + 1}: ${e instanceof Error ? e.message : "Lỗi ngày"}`);
    }

    const qty = parseQty(row[iQty]);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Dòng ${r + 1}: số lượng không hợp lệ.`);
    }
    const unitPrice = parseMoney(row[iPrice]);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Dòng ${r + 1}: đơn giá không hợp lệ.`);
    }

    const typeCode = pick(row, iType);
    const sku = pick(row, iSku);
    if (!typeCode && !sku) {
      throw new Error(`Dòng ${r + 1}: thiếu mã sản phẩm (MÃ LOẠI / MÃ SẢN PHẨM).`);
    }

    out.push({
      receivedAtIso,
      partnerCode: partner,
      patientName: patient.replace(/\s+/g, " ").trim(),
      clinicName: pick(row, iClinic),
      labName: pick(row, iLab),
      labTruyXuat: pick(row, iLabTx),
      productTypeCode: typeCode,
      productNameHint: pick(row, iTypeName),
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
