import { amountInWordsVietnamese } from "@/lib/format/currency";
import { formatDeliveryNoteDayMonth, type DeliveryNotePayload } from "@/lib/reports/delivery-note-html";

function noteCell(lineNotes: string | null | undefined, orderNotes: string | null) {
  const parts = [lineNotes?.trim(), orderNotes?.trim()].filter(Boolean) as string[];
  return parts.join(" · ");
}

function monthlyListCatalogUnitPrice(line: {
  base_unit_price?: number;
  unit_price?: number;
}): number {
  const b = Number(line.base_unit_price ?? 0);
  const u = Number(line.unit_price ?? 0);
  return b > 0 ? b : u;
}

function appendPartnerDetailRows(aoa: (string | number | null)[][], p: DeliveryNotePayload) {
  const a = p.partner_address?.trim();
  const ph = p.partner_phone?.trim();
  const t = p.partner_tax_id?.trim();
  if (a) aoa.push(["Địa chỉ", a]);
  if (t) aoa.push(["MST", t]);
  if (ph) aoa.push(["SĐT", ph]);
}

/** Ma trận dữ liệu cho XLSX (phiếu giao ngày / tháng / một đơn). */
export function buildDeliveryNoteExcelAoa(p: DeliveryNotePayload): (string | number | null)[][] {
  const who = [p.partner_code, p.partner_name].filter(Boolean).join(" — ");
  const periodLabel = p.period_subtitle?.trim() || p.delivery_date;

  if (p.layout === "monthly_flat") {
    const heading = p.period_heading?.trim() || periodLabel;
    const aoa: (string | number | null)[][] = [
      ["HOÁ ĐƠN PHÒNG NHA / LABO", ""],
      [heading, ""],
      ["Khách hàng (lab)", who || "—"],
    ];
    appendPartnerDetailRows(aoa, p);
    aoa.push(["Khoảng ngày nhận", periodLabel], []);
    aoa.push([
      "STT",
      "Ngày",
      "Nha khoa",
      "Tên bệnh nhân",
      "Sản phẩm",
      "Vị trí răng",
      "SL",
      "Giá niêm yết (VNĐ)",
      "Thành tiền (VNĐ)",
      "Ghi chú",
    ]);
    let stt = 1;
    for (const o of p.orders) {
      const received = o.received_date ?? p.delivery_date;
      const ngay = formatDeliveryNoteDayMonth(received);
      const clinic = o.clinic_name ?? "";
      if (!o.lines.length) {
        aoa.push([stt++, ngay, clinic, o.patient_name, "", "", "", "", "", noteCell(null, o.notes)]);
        continue;
      }
      for (const l of o.lines) {
        const tooth = [l.tooth_positions?.trim(), l.shade?.trim()].filter(Boolean).join(" · ") || "—";
        aoa.push([
          stt++,
          ngay,
          clinic,
          o.patient_name,
          l.product_name || l.product_code || "—",
          tooth,
          l.quantity,
          monthlyListCatalogUnitPrice(l),
          l.line_amount ?? 0,
          noteCell(l.notes, o.notes),
        ]);
      }
    }
    const foot = p.monthly_footer;
    if (foot) {
      const fmt = (n: number) => Math.round(n);
      aoa.push([]);
      if (foot.line_discount_from_list > 0.005) {
        aoa.push(["CỘNG GIÁ NIÊM YẾT", fmt(foot.subtotal_list_catalog)]);
        aoa.push(["CHIẾT KHẤU / GIẢM GIÁ (dòng)", fmt(foot.line_discount_from_list)]);
      }
      aoa.push(["CỘNG TIỀN HÀNG", fmt(foot.subtotal_goods)]);
      aoa.push([foot.discount_label, fmt(foot.discount_amount)]);
      if (foot.other_fees > 0.005) {
        aoa.push(["PHÍ KHÁC (GBTT)", fmt(foot.other_fees)]);
      }
      aoa.push(["NỢ ĐẦU KỲ", fmt(foot.opening_debt)]);
      aoa.push(["THANH TOÁN TRONG KỲ", fmt(foot.payments_in_period)]);
      aoa.push(["TỔNG CỘNG NỢ CUỐI KỲ", fmt(foot.closing_debt)]);
      aoa.push([]);
      aoa.push([
        "Số tiền bằng chữ (nợ cuối kỳ)",
        amountInWordsVietnamese(Math.round(foot.closing_debt)).toLocaleUpperCase("vi-VN") + " ./.",
      ]);
    }
    return aoa;
  }

  const aoa: (string | number | null)[][] = [
    ["PHIẾU GIAO HÀNG", ""],
    ["Kỳ / ngày", periodLabel],
    ["Khách hàng", who || "—"],
  ];
  appendPartnerDetailRows(aoa, p);
  aoa.push(["Số đơn", p.orders.length], [], ["STT", "Số đơn", "Bệnh nhân", "Nha khoa", "Mã SP", "Tên SP", "Răng & màu", "SL", "Ghi chú đơn"]);
  let stt = 1;
  for (const o of p.orders) {
    if (!o.lines.length) {
      aoa.push([stt++, o.order_number, o.patient_name, o.clinic_name ?? "", "", "", "", "", o.notes ?? ""]);
      continue;
    }
    for (const l of o.lines) {
      const tooth = [l.tooth_positions, l.shade].filter(Boolean).join(" · ") || "—";
      aoa.push([
        stt++,
        o.order_number,
        o.patient_name,
        o.clinic_name ?? "",
        l.product_code,
        l.product_name,
        tooth,
        l.quantity,
        o.notes ?? "",
      ]);
    }
  }
  return aoa;
}
