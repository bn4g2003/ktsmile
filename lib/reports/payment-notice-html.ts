import { formatVnd } from "@/lib/format/currency";
import { formatLabOrderLineWorkType } from "@/lib/format/labels";
import { escapeHtml } from "@/lib/reports/escape-html";

export type PaymentNoticeLine = {
  product_code: string;
  product_name: string;
  unit: string;
  tooth_positions: string;
  shade: string | null;
  tooth_count: number | null;
  work_type: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  line_amount: number;
  notes: string | null;
};

export type PaymentNoticePrintPayload = {
  payment_notice_doc_number: string | null;
  payment_notice_issued_at: string | null;
  order_number: string;
  received_at: string;
  patient_name: string;
  clinic_name: string | null;
  partner_code: string | null;
  partner_name: string | null;
  notes: string | null;
  lines: PaymentNoticeLine[];
  subtotal_lines: number;
  billing_order_discount_percent: number;
  billing_order_discount_amount: number;
  billing_other_fees: number;
  grand_total: number;
};

function fmtQty(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(n);
}

export function paymentNoticePrintTitle(p: PaymentNoticePrintPayload): string {
  const n = p.payment_notice_doc_number ?? p.order_number;
  return `Giấy báo thanh toán · ${n} — KT Smile Lab`;
}

export function buildPaymentNoticeBodyHtml(p: PaymentNoticePrintPayload): string {
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
          <td class="num">${escapeHtml(l.tooth_count != null ? String(l.tooth_count) : "—")}</td>
          <td>${escapeHtml(formatLabOrderLineWorkType(l.work_type))}</td>
          <td class="num">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="num">${escapeHtml(formatVnd(l.unit_price))}</td>
          <td class="num">${escapeHtml(String(l.discount_percent))}</td>
          <td class="num">${escapeHtml(formatVnd(l.discount_amount))}</td>
          <td class="num">${escapeHtml(formatVnd(l.line_amount))}</td>
          <td>${escapeHtml(l.notes ?? "—")}</td>
        </tr>`,
    )
    .join("");

  const docLine = p.payment_notice_doc_number
    ? escapeHtml(p.payment_notice_doc_number)
    : "<em>Chưa cấp số — dùng bản nháp</em>";
  const issueLine = p.payment_notice_issued_at
    ? escapeHtml(new Date(p.payment_notice_issued_at).toLocaleString("vi-VN"))
    : "—";

  return `
    <h1>Giấy báo thanh toán (chi tiết)</h1>
    <p class="muted">Đơn gốc: <strong>${escapeHtml(p.order_number)}</strong> · Ngày nhận đơn: ${escapeHtml(p.received_at)} · In lúc: ${escapeHtml(gen)}</p>
    <p class="muted">Số GBTT: <strong>${docLine}</strong> · Ghi nhận xuất: ${issueLine}</p>
    <table class="kv">
      <tbody>
        <tr><th>Khách hàng</th><td>${partnerLine}</td></tr>
        <tr><th>Nha khoa</th><td>${escapeHtml(p.clinic_name ?? "—")}</td></tr>
        <tr><th>Bệnh nhân</th><td>${escapeHtml(p.patient_name)}</td></tr>
        <tr><th>Ghi chú</th><td>${escapeHtml(p.notes ?? "—")}</td></tr>
      </tbody>
    </table>
    <h2>Chi tiết phải thu</h2>
    <table>
      <thead>
        <tr>
          <th class="num">STT</th>
          <th>Mã SP</th>
          <th>Tên SP</th>
          <th>ĐVT</th>
          <th>Vị trí răng</th>
          <th>Màu</th>
          <th class="num">Số răng</th>
          <th>Loại</th>
          <th class="num">SL</th>
          <th class="num">Đơn giá</th>
          <th class="num">CK %</th>
          <th class="num">Giảm VNĐ</th>
          <th class="num">Thành tiền</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="14">Chưa có dòng.</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <th colspan="12" class="num">Cộng chi tiết</th>
          <th class="num">${escapeHtml(formatVnd(p.subtotal_lines))}</th>
          <th></th>
        </tr>
        <tr>
          <th colspan="12" class="num">Chiết khấu tổng (${escapeHtml(String(p.billing_order_discount_percent))}%)</th>
          <th class="num">−${escapeHtml(formatVnd(p.subtotal_lines * (p.billing_order_discount_percent / 100)))}</th>
          <th></th>
        </tr>
        <tr>
          <th colspan="12" class="num">Giảm giá tổng (VNĐ)</th>
          <th class="num">−${escapeHtml(formatVnd(p.billing_order_discount_amount))}</th>
          <th></th>
        </tr>
        <tr>
          <th colspan="12" class="num">Chi phí khác</th>
          <th class="num">${escapeHtml(formatVnd(p.billing_other_fees))}</th>
          <th></th>
        </tr>
        <tr>
          <th colspan="12" class="num"><strong>Tổng thanh toán</strong></th>
          <th class="num"><strong>${escapeHtml(formatVnd(p.grand_total))}</strong></th>
          <th></th>
        </tr>
      </tfoot>
    </table>
    <p class="muted" style="margin-top:14px">Vui lòng đối chiếu và thanh toán theo số tài khoản / hình thức đã thỏa thuận.</p>
  `;
}
