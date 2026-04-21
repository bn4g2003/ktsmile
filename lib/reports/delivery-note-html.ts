import { escapeHtml } from "@/lib/reports/escape-html";

export type DeliveryNoteLine = {
  product_code: string;
  product_name: string;
  tooth_positions: string;
  quantity: number;
  shade: string | null;
};

export type DeliveryNoteOrder = {
  order_number: string;
  patient_name: string;
  clinic_name: string | null;
  notes: string | null;
  lines: DeliveryNoteLine[];
};

export type DeliveryNotePayload = {
  partner_code: string | null;
  partner_name: string | null;
  delivery_date: string;
  generated_at: string;
  orders: DeliveryNoteOrder[];
};

function fmtQty(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n);
}

export function deliveryNotePrintTitle(p: DeliveryNotePayload): string {
  const who = p.partner_code || p.partner_name || "Khách hàng";
  return `Phiếu giao hàng ${p.delivery_date} · ${who}`;
}

export function buildDeliveryNoteBodyHtml(p: DeliveryNotePayload): string {
  const who =
    p.partner_code || p.partner_name
      ? `${escapeHtml(p.partner_code ?? "")}${p.partner_code && p.partner_name ? " — " : ""}${escapeHtml(p.partner_name ?? "")}`
      : "—";
  const orderRows = p.orders
    .map((o, idx) => {
      const lineHtml = o.lines
        .map(
          (l) =>
            `<tr>
              <td style="width:70px;">${escapeHtml(l.product_code)}</td>
              <td>${escapeHtml(l.product_name)}</td>
              <td style="width:130px;">${escapeHtml(l.tooth_positions || "—")}${l.shade ? ` · ${escapeHtml(l.shade)}` : ""}</td>
              <td class="num" style="width:50px;">${escapeHtml(fmtQty(l.quantity))}</td>
            </tr>`,
        )
        .join("");
      return `<section class="order-block">
        <h3 style="background:#f1f5f9;padding:4px 8px;font-size:11px;margin-bottom:6px;border-left:3px solid #2563eb;">
          ${idx + 1}. ĐƠN ${escapeHtml(o.order_number)} — BN: ${escapeHtml(o.patient_name)}
        </h3>
        ${o.clinic_name ? `<div style="font-size:10px;margin-bottom:4px;color:#64748b;padding-left:11px;">Nha khoa: ${escapeHtml(o.clinic_name)}</div>` : ""}
        <table>
          <thead>
            <tr style="background:#64748b;color:#fff;">
              <th style="color:#fff;">MÃ SP</th>
              <th style="color:#fff;">TÊN SẢN PHẨM</th>
              <th style="color:#fff;">RĂNG/MÀU</th>
              <th class="num" style="color:#fff;">SL</th>
            </tr>
          </thead>
          <tbody>${lineHtml || `<tr><td colspan="4">Không có dòng.</td></tr>`}</tbody>
        </table>
        ${o.notes ? `<div style="font-size:10px;margin-top:4px;color:#64748b;padding-left:11px;">Ghi chú: ${escapeHtml(o.notes)}</div>` : ""}
      </section>`;
    })
    .join("");

  return `
    <h1 style="color:#2563eb;">PHIẾU GIAO HÀNG TỔNG HỢP</h1>
    <p class="muted" style="text-align:center;">Ngày giao: <strong>${escapeHtml(p.delivery_date)}</strong></p>

    <table class="kv" style="margin-bottom:20px;">
      <tbody>
        <tr><th>KHÁCH HÀNG</th><td>: ${who}</td></tr>
        <tr><th>SỐ ĐƠN HÀNG</th><td>: ${p.orders.length} đơn</td></tr>
      </tbody>
    </table>

    <div style="border-top:1px dashed #cbd5e1;padding-top:10px;">
      ${orderRows || "<p>Không có đơn hàng.</p>"}
    </div>

    <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;text-align:center;">
      <div>
        <div style="font-weight:700;">NGƯỜI NHẬN HÀNG</div>
        <div style="font-size:10px;margin-top:40px;color:#94a3b8;">(Ký và ghi rõ họ tên)</div>
      </div>
      <div>
        <div style="font-weight:700;">LAB XÁC NHẬN</div>
        <div style="font-size:10px;margin-top:40px;color:#94a3b8;">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>

    <style>
      .order-block { margin-top: 16px; page-break-inside: avoid; }
      th { border-color: #94a3b8 !important; }
      td { height: 20px; }
    </style>
  `;
}
