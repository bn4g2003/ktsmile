import type { DeliveryNotePayload } from "@/lib/reports/delivery-note-html";

/** Ma trận dữ liệu cho XLSX (phiếu giao ngày / tháng / một đơn). */
export function buildDeliveryNoteExcelAoa(p: DeliveryNotePayload): (string | number | null)[][] {
  const who = [p.partner_code, p.partner_name].filter(Boolean).join(" — ");
  const periodLabel = p.period_subtitle?.trim() || p.delivery_date;
  const aoa: (string | number | null)[][] = [
    ["PHIẾU GIAO HÀNG", ""],
    ["Kỳ / ngày", periodLabel],
    ["Khách hàng", who || "—"],
    ["Số đơn", p.orders.length],
    [],
    ["STT", "Số đơn", "Bệnh nhân", "Nha khoa", "Mã SP", "Tên SP", "Răng & màu", "SL", "Ghi chú đơn"],
  ];
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
