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
          <td style="width:70px;">${escapeHtml(l.product_code)}</td>
          <td>${escapeHtml(l.product_name)}</td>
          <td style="width:120px;">${escapeHtml(l.tooth_positions)}${l.shade ? ` · ${escapeHtml(l.shade)}` : ""}</td>
          <td class="num" style="width:40px;">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="num" style="width:85px;">${escapeHtml(formatVnd(l.unit_price))}</td>
          <td class="num" style="width:105px;"><strong>${escapeHtml(formatVnd(l.line_amount))}</strong></td>
          <td>${escapeHtml(l.notes ?? "—")}</td>
        </tr>`,
    )
    .join("");

  const docLine = p.payment_notice_doc_number
    ? escapeHtml(p.payment_notice_doc_number)
    : "<em>BẢN NHÁP</em>";
  const issueLine = p.payment_notice_issued_at
    ? escapeHtml(new Date(p.payment_notice_issued_at).toLocaleString("vi-VN"))
    : "—";

  return `
    <h1 style="color:#2563eb;">GIẤY BÁO THANH TOÁN</h1>
    <p class="muted" style="text-align:center;">Số báo phí: <strong>${docLine}</strong> · Ngày xuất: ${issueLine}</p>
    <p class="muted" style="text-align:center;">Đơn gốc: ${escapeHtml(p.order_number)} · Ngày nhận: ${escapeHtml(p.received_at)}</p>

    <table class="kv" style="margin-bottom:20px;">
      <tbody>
        <tr><th>TÊN KH</th><td>: ${partnerLine}</td></tr>
        <tr><th>NHA KHOA</th><td>: ${escapeHtml(p.clinic_name ?? "—")}</td></tr>
        <tr><th>BỆNH NHÂN</th><td>: ${escapeHtml(p.patient_name)}</td></tr>
        <tr><th>GHI CHÚ</th><td>: ${escapeHtml(p.notes ?? "—")}</td></tr>
      </tbody>
    </table>

    <table>
      <thead>
        <tr style="background:#2563eb;color:#fff;">
          <th class="num" style="color:#fff;">STT</th>
          <th style="color:#fff;">MÃ SP</th>
          <th style="color:#fff;">TÊN SẢN PHẨM</th>
          <th style="color:#fff;">RĂNG/MÀU</th>
          <th class="num" style="color:#fff;">SL</th>
          <th class="num" style="color:#fff;">ĐƠN GIÁ</th>
          <th class="num" style="color:#fff;">THÀNH TIỀN</th>
          <th style="color:#fff;">GHI CHÚ</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="8">Chưa có dòng.</td></tr>`}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="6" class="num" style="border:none;">CỘNG CHI TIẾT:</td>
          <td class="num" style="background:#f1f5f9;">${escapeHtml(formatVnd(p.subtotal_lines))}</td>
          <td style="border:none;"></td>
        </tr>
        ${p.billing_order_discount_percent > 0 ? `
        <tr class="total-row">
          <td colspan="6" class="num" style="border:none;">CHIẾT KHẤU TỔNG (${escapeHtml(String(p.billing_order_discount_percent))}%):</td>
          <td class="num" style="color:#b91c1c;">−${escapeHtml(formatVnd(p.subtotal_lines * (p.billing_order_discount_percent / 100)))}</td>
          <td style="border:none;"></td>
        </tr>
        ` : ""}
        ${p.billing_order_discount_amount > 0 ? `
        <tr class="total-row">
          <td colspan="6" class="num" style="border:none;">GIẢM GIÁ VNĐ:</td>
          <td class="num" style="color:#b91c1c;">−${escapeHtml(formatVnd(p.billing_order_discount_amount))}</td>
          <td style="border:none;"></td>
        </tr>
        ` : ""}
        ${p.billing_other_fees !== 0 ? `
        <tr class="total-row">
          <td colspan="6" class="num" style="border:none;">CHI PHÍ KHÁC:</td>
          <td class="num">${escapeHtml(formatVnd(p.billing_other_fees))}</td>
          <td style="border:none;"></td>
        </tr>
        ` : ""}
        <tr class="total-row">
          <td colspan="6" class="num" style="border:none;font-weight:800;font-size:13px;">TỔNG THANH TOÁN:</td>
          <td class="num" style="background:#2563eb;color:#fff;font-weight:800;font-size:14px;">${escapeHtml(formatVnd(p.grand_total))}</td>
          <td style="border:none;"></td>
        </tr>
      </tfoot>
    </table>
    
    <div style="margin-top:30px;display:grid;grid-template-columns:2fr 1fr;gap:40px;">
      <div style="font-size:11px;color:#64748b;">
        <p><strong>Thông tin thanh toán:</strong></p>
        <p>STK: 886978683 - Ngân hàng MB (Quân Đội)</p>
        <p>Chủ TK: CÔNG TY TNHH KTSMILE MILLING CENTER</p>
        <p style="margin-top:10px;">* Vui lòng đối chiếu kỹ trước khi thanh toán. Trân trọng cảm ơn!</p>
      </div>
      <div style="text-align:center;">
        <div style="font-weight:700;">NGƯỜI LẬP PHIẾU</div>
        <div style="font-size:10px;margin-top:50px;color:#94a3b8;">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>

    <style>
      th { background-color: #2563eb !important; border-color: #1e40af !important; }
      td { height: 22px; }
    </style>
  `;
}
