import { formatVnd } from "@/lib/format/currency";
import { formatOrderStatus } from "@/lib/format/labels";
import { escapeHtml } from "@/lib/reports/escape-html";

export type LabOrderPrintLine = {
  product_code: string;
  product_name: string;
  unit: string;
  tooth_positions: string;
  shade: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_amount: number;
  notes: string | null;
};

export type LabOrderPrintPayload = {
  order_number: string;
  received_at: string;
  patient_name: string;
  status: string;
  partner_code: string | null;
  partner_name: string | null;
  notes: string | null;
  lines: LabOrderPrintLine[];
};

function fmtQty(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(n);
}

export function buildLabOrderBodyHtml(p: LabOrderPrintPayload): string {
  const gen = new Date().toLocaleString("vi-VN");
  const partnerLine =
    p.partner_code || p.partner_name
      ? `${escapeHtml(p.partner_code ?? "")}${p.partner_code && p.partner_name ? " — " : ""}${escapeHtml(p.partner_name ?? "")}`
      : "—";
  const rows = p.lines
    .map(
      (l, i) =>
        `<tr>
          <td class="num">${i + 1}</td>
          <td>${escapeHtml(l.product_code)}</td>
          <td>${escapeHtml(l.product_name)}</td>
          <td>${escapeHtml(l.unit || "—")}</td>
          <td>${escapeHtml(l.tooth_positions)}</td>
          <td>${escapeHtml(l.shade ?? "—")}</td>
          <td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="num">${escapeHtml(formatVnd(l.unit_price))}</td>
          <td class="num">${escapeHtml(String(l.discount_percent))}</td>
          <td class="num">${escapeHtml(formatVnd(l.line_amount))}</td>
          <td>${escapeHtml(l.notes ?? "—")}</td>
        </tr>`,
    )
    .join("");
  const total = p.lines.reduce((s, l) => s + l.line_amount, 0);
  return `
    <h1>Đơn hàng phục hình</h1>
    <p class="muted">Số đơn: <strong>${escapeHtml(p.order_number)}</strong> · Ngày nhận: ${escapeHtml(p.received_at)} · ${escapeHtml(gen)}</p>
    <table class="kv">
      <tbody>
        <tr><th>Khách hàng</th><td>${partnerLine}</td></tr>
        <tr><th>Bệnh nhân</th><td>${escapeHtml(p.patient_name)}</td></tr>
        <tr><th>Trạng thái</th><td>${escapeHtml(formatOrderStatus(p.status))}</td></tr>
        <tr><th>Ghi chú đơn</th><td>${escapeHtml(p.notes ?? "—")}</td></tr>
      </tbody>
    </table>
    <h2>Chi tiết sản phẩm</h2>
    <table>
      <thead>
        <tr>
          <th class="num">STT</th>
          <th>Mã SP</th>
          <th>Tên SP</th>
          <th>ĐVT</th>
          <th>Vị trí răng</th>
          <th>Màu</th>
          <th class="num">SL</th>
          <th class="num">Đơn giá</th>
          <th class="num">CK %</th>
          <th class="num">Thành tiền</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="11">Chưa có dòng.</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <th colspan="9" class="num">Cộng</th>
          <th class="num">${escapeHtml(formatVnd(total))}</th>
          <th></th>
        </tr>
      </tfoot>
    </table>
  `;
}

export function labOrderPrintTitle(p: LabOrderPrintPayload): string {
  return `Đơn hàng · ${p.order_number} — KT Smile Lab`;
}
