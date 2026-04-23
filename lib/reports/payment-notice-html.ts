import { formatVnd } from "@/lib/format/currency";
import { htmlBangChu } from "@/lib/reports/amount-in-words-html";
import { htmlGbttPartnerKvRows } from "@/lib/reports/partner-kv-html";
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
  partner_address: string | null;
  partner_phone: string | null;
  partner_tax_id: string | null;
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

function lineDiscountLabel(discountPercent: number, discountAmount: number): string {
  const parts: string[] = [];
  if (discountPercent > 0) parts.push(`${discountPercent}%`);
  if (discountAmount > 0) parts.push(formatVnd(discountAmount));
  return parts.join(" + ") || "—";
}

export function paymentNoticePrintTitle(p: PaymentNoticePrintPayload): string {
  const n = p.payment_notice_doc_number ?? p.order_number;
  return `Giấy báo thanh toán · ${n} — KT Smile Lab`;
}

export function buildPaymentNoticeBodyHtml(p: PaymentNoticePrintPayload): string {
  const partnerInner =
    p.partner_code || p.partner_name
      ? `${escapeHtml(p.partner_code ?? "")}${p.partner_code && p.partner_name ? " — " : ""}${escapeHtml(p.partner_name ?? "")}`
      : null;
  const rows = p.lines
    .map(
      (l, i) =>
        `<tr>
          <td class="num pn-c-stt">${i + 1}</td>
          <td class="pn-c-code">${escapeHtml(l.product_code)}</td>
          <td class="pn-c-name">${escapeHtml(l.product_name)}</td>
          <td class="pn-c-tooth">${escapeHtml(l.tooth_positions)}${l.shade ? ` · ${escapeHtml(l.shade)}` : ""}</td>
          <td class="num pn-c-qty">${escapeHtml(fmtQty(l.quantity))}</td>
          <td class="num pn-c-price">${escapeHtml(formatVnd(l.unit_price))}</td>
          <td class="num pn-c-disc">${escapeHtml(lineDiscountLabel(l.discount_percent, l.discount_amount))}</td>
          <td class="num pn-c-amt"><strong>${escapeHtml(formatVnd(l.line_amount))}</strong></td>
          <td class="pn-c-note">${escapeHtml(l.notes ?? "—")}</td>
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
    <div class="pn-root">
    <h1 class="pn-title">GIẤY BÁO THANH TOÁN</h1>
    <div class="pn-meta">
      <p><span class="pn-meta-k">Số báo phí</span><span class="pn-meta-v"><strong>${docLine}</strong></span></p>
      <p><span class="pn-meta-k">Ngày xuất</span><span class="pn-meta-v">${issueLine}</span></p>
      <p><span class="pn-meta-k">Đơn gốc</span><span class="pn-meta-v">${escapeHtml(p.order_number)}</span></p>
      <p><span class="pn-meta-k">Ngày nhận</span><span class="pn-meta-v">${escapeHtml(p.received_at)}</span></p>
    </div>

    <table class="pn-kv">
      <tbody>
        ${htmlGbttPartnerKvRows({
          partnerCellInner: partnerInner,
          address: p.partner_address,
          phone: p.partner_phone,
          taxCode: p.partner_tax_id,
        })}
        ${p.clinic_name?.trim() ? `<tr><th scope="row">Nha khoa</th><td>${escapeHtml(p.clinic_name.trim())}</td></tr>` : ""}
        <tr><th scope="row">Bệnh nhân</th><td>${escapeHtml(p.patient_name)}</td></tr>
        ${p.notes?.trim() ? `<tr><th scope="row">Ghi chú</th><td>${escapeHtml(p.notes.trim())}</td></tr>` : ""}
      </tbody>
    </table>

    <table class="pn-lines">
      <colgroup>
        <col class="pn-col-stt" />
        <col class="pn-col-code" />
        <col class="pn-col-name" />
        <col class="pn-col-tooth" />
        <col class="pn-col-qty" />
        <col class="pn-col-price" />
        <col class="pn-col-disc" />
        <col class="pn-col-amt" />
        <col class="pn-col-note" />
      </colgroup>
      <thead>
        <tr class="pn-head">
          <th class="num">STT</th>
          <th>Mã SP</th>
          <th>Tên sản phẩm</th>
          <th>Răng / màu</th>
          <th class="num">SL</th>
          <th class="num">Đơn giá</th>
          <th class="num">CK dòng</th>
          <th class="num">Thành tiền</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="9">Chưa có dòng.</td></tr>`}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="7" class="num" style="border:none;">CỘNG CHI TIẾT:</td>
          <td class="num" style="background:#f1f5f9;">${escapeHtml(formatVnd(p.subtotal_lines))}</td>
          <td style="border:none;"></td>
        </tr>
        ${p.billing_order_discount_percent > 0 ? `
        <tr class="total-row">
          <td colspan="7" class="num" style="border:none;">CHIẾT KHẤU TỔNG (${escapeHtml(String(p.billing_order_discount_percent))}%):</td>
          <td class="num" style="color:#b91c1c;">−${escapeHtml(formatVnd(p.subtotal_lines * (p.billing_order_discount_percent / 100)))}</td>
          <td style="border:none;"></td>
        </tr>
        ` : ""}
        ${p.billing_order_discount_amount > 0 ? `
        <tr class="total-row">
          <td colspan="7" class="num" style="border:none;">GIẢM GIÁ VNĐ:</td>
          <td class="num" style="color:#b91c1c;">−${escapeHtml(formatVnd(p.billing_order_discount_amount))}</td>
          <td style="border:none;"></td>
        </tr>
        ` : ""}
        ${p.billing_other_fees !== 0 ? `
        <tr class="total-row">
          <td colspan="7" class="num" style="border:none;">CHI PHÍ KHÁC:</td>
          <td class="num">${escapeHtml(formatVnd(p.billing_other_fees))}</td>
          <td style="border:none;"></td>
        </tr>
        ` : ""}
        <tr class="total-row">
          <td colspan="7" class="num" style="border:none;font-weight:800;font-size:13px;">TỔNG THANH TOÁN:</td>
          <td class="num" style="background:#2563eb;color:#fff;font-weight:800;font-size:14px;">${escapeHtml(formatVnd(p.grand_total))}</td>
          <td style="border:none;"></td>
        </tr>
      </tfoot>
    </table>
    ${htmlBangChu(p.grand_total)}

    <div class="pn-foot">
      <div class="pn-bank">
        <p class="pn-bank-title">Thông tin thanh toán</p>
        <p>STK: <strong>886978683</strong> — Ngân hàng MB (Quân đội)</p>
        <p>Chủ TK: CÔNG TY TNHH KTSMILE MILLING CENTER</p>
        <p class="pn-bank-note">* Vui lòng đối chiếu kỹ trước khi thanh toán. Trân trọng cảm ơn!</p>
      </div>
      <div class="pn-sign">
        <div class="pn-sign-title">Người lập phiếu</div>
        <div class="pn-sign-hint">(Ký và ghi rõ họ tên)</div>
      </div>
    </div>
    </div>

    <style>
      .pn-root { color: #0f172a; }
      .pn-title { color: #1d4ed8 !important; margin: 0 0 14px; font-size: 20px; letter-spacing: 0.04em; }
      .pn-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 20px;
        max-width: 100%;
        margin: 0 auto 16px;
        padding: 12px 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 11px;
      }
      .pn-meta p { margin: 0; display: flex; gap: 10px; align-items: baseline; min-width: 0; }
      .pn-meta-k { flex: 0 0 5.5rem; color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em; }
      .pn-meta-v { flex: 1; min-width: 0; word-break: break-word; line-height: 1.35; }

      .pn-kv { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 18px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
      .pn-kv th, .pn-kv td { border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; text-align: left; }
      .pn-kv th { width: 22%; background: #f1f5f9; font-size: 10px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
      .pn-kv td { width: 78%; font-size: 12px; line-height: 1.45; font-weight: 500; word-break: break-word; }

      .pn-lines { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 4px; }
      .pn-lines .pn-col-stt { width: 4%; }
      .pn-lines .pn-col-code { width: 10%; }
      .pn-lines .pn-col-name { width: 26%; }
      .pn-lines .pn-col-tooth { width: 14%; }
      .pn-lines .pn-col-qty { width: 6%; }
      .pn-lines .pn-col-price { width: 10%; }
      .pn-lines .pn-col-disc { width: 10%; }
      .pn-lines .pn-col-amt { width: 12%; }
      .pn-lines .pn-col-note { width: 13%; }
      .pn-lines thead .pn-head th {
        background: #2563eb !important;
        color: #fff !important;
        border-color: #1d4ed8 !important;
        font-size: 9px;
        line-height: 1.25;
        padding: 8px 5px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        vertical-align: middle;
        white-space: normal;
        hyphens: auto;
      }
      .pn-lines tbody td {
        font-size: 10.5px;
        line-height: 1.35;
        padding: 6px 5px;
        vertical-align: top;
        border-color: #cbd5e1;
      }
      .pn-lines tbody .num { white-space: nowrap; }
      .pn-c-name, .pn-c-note { word-break: break-word; }
      .pn-lines tfoot .total-row td { font-size: 11px; padding: 8px 5px; vertical-align: middle; }

      .pn-foot {
        margin-top: 22px;
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(160px, 0.9fr);
        gap: 24px 32px;
        align-items: start;
      }
      .pn-bank { font-size: 11px; color: #475569; line-height: 1.5; }
      .pn-bank-title { font-weight: 800; color: #334155; margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
      .pn-bank p { margin: 0 0 4px; }
      .pn-bank-note { margin-top: 10px !important; font-size: 10px; color: #64748b; }
      .pn-sign { text-align: center; padding-top: 4px; }
      .pn-sign-title { font-weight: 800; font-size: 11px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em; }
      .pn-sign-hint { font-size: 10px; margin-top: 48px; color: #94a3b8; }

      @media print {
        .pn-meta { break-inside: avoid; }
        .pn-kv { break-inside: avoid; }
      }
    </style>
  `;
}
