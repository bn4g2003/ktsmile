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
              <td>${escapeHtml(l.product_code)}</td>
              <td>${escapeHtml(l.product_name)}</td>
              <td>${escapeHtml(l.tooth_positions || "—")}</td>
              <td>${escapeHtml(l.shade ?? "—")}</td>
              <td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
            </tr>`,
        )
        .join("");
      return `<section class="order-block">
        <h3>${idx + 1}. Đơn ${escapeHtml(o.order_number)} — BN: ${escapeHtml(o.patient_name)}</h3>
        <p class="muted">Nha khoa: ${escapeHtml(o.clinic_name ?? "—")}</p>
        <table>
          <thead>
            <tr>
              <th>Mã SP</th>
              <th>Tên SP</th>
              <th>Vị trí răng</th>
              <th>Màu</th>
              <th class="num">SL</th>
            </tr>
          </thead>
          <tbody>${lineHtml || `<tr><td colspan="5">Không có dòng.</td></tr>`}</tbody>
        </table>
        <p><strong>Ghi chú đơn:</strong> ${escapeHtml(o.notes ?? "—")}</p>
      </section>`;
    })
    .join("");

  return `
    <h1>Phiếu giao hàng theo ngày</h1>
    <p class="muted" style="text-align:center;">Ngày giao: <strong>${escapeHtml(p.delivery_date)}</strong></p>
    <p class="muted" style="text-align:center;font-size:11px;">In lúc: ${escapeHtml(p.generated_at)}</p>
    <table class="kv">
      <tbody>
        <tr><th>Khách hàng / Lab</th><td>${who}</td></tr>
        <tr><th>Số đơn trong phiếu</th><td>${p.orders.length}</td></tr>
      </tbody>
    </table>
    ${orderRows || "<p>Không có đơn hàng.</p>"}
    <style>
      .order-block { margin-top: 16px; page-break-inside: avoid; }
      .order-block h3 { margin: 0 0 6px; }
    </style>
  `;
}
