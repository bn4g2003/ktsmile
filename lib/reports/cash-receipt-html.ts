import { formatVnd, amountInWordsVietnamese } from "@/lib/format/currency";
import { formatCashDirection } from "@/lib/format/labels";
import { formatDateTime } from "@/lib/format/date";
import { escapeHtml } from "@/lib/reports/escape-html";

export type CashReceiptPrintPayload = {
  doc_number: string;
  transaction_date: string;
  payment_channel: string;
  direction: string;
  business_category: string;
  amount: number;
  payer_name: string | null;
  partner_code: string | null;
  partner_name: string | null;
  supplier_code: string | null;
  supplier_name: string | null;
  description: string | null;
};

export function cashReceiptPrintTitle(p: CashReceiptPrintPayload): string {
  const kind = p.direction === "payment" ? "Phiếu chi" : "Phiếu thu";
  return `${kind} · ${p.doc_number} — KT Smile Lab`;
}

export function buildCashReceiptBodyHtml(p: CashReceiptPrintPayload): string {
  const gen = formatDateTime(new Date());
  const isPayment = p.direction === "payment";
  const h1 = isPayment ? "Phiếu chi" : "Phiếu thu";
  const counterpartyLabel = isPayment ? "Nhà cung cấp" : "Khách hàng";
  const counterpartyValue = isPayment 
    ? (p.supplier_name || p.supplier_code || "—")
    : (p.partner_name || p.partner_code || "—");

  return `
    <div style="margin-top: -10px;">
      <h1 style="margin-bottom: 5px;">${h1}</h1>
      <p style="text-align:center; font-size: 13px; margin: 0 0 20px 0;">
        Số: <strong>${escapeHtml(p.doc_number)}</strong> 
        <span style="margin: 0 10px; color: #cbd5e1;">|</span> 
        Ngày: <strong>${p.transaction_date.split('-').reverse().join('/')}</strong>
      </p>

      <table class="kv" style="margin-bottom: 25px;">
        <tbody>
          <tr>
            <th style="width: 120px;">Người ${isPayment ? 'nhận' : 'nộp'} tiền:</th>
            <td style="font-size: 14px; font-weight: 700; border-bottom: 1px dotted #cbd5e1;">${escapeHtml(p.payer_name || counterpartyValue)}</td>
          </tr>
          <tr>
            <th>${counterpartyLabel}:</th>
            <td style="border-bottom: 1px dotted #cbd5e1;">${escapeHtml(counterpartyValue)}</td>
          </tr>
          <tr>
            <th>Nội dung:</th>
            <td style="border-bottom: 1px dotted #cbd5e1;">${escapeHtml(p.description || p.business_category)}</td>
          </tr>
          <tr>
            <th>Số tiền:</th>
            <td style="font-size: 15px; font-weight: 800; border-bottom: 1px dotted #cbd5e1;">${formatVnd(p.amount)} VNĐ</td>
          </tr>
          <tr>
            <th>Bằng chữ:</th>
            <td style="font-style: italic; border-bottom: 1px dotted #cbd5e1;">${amountInWordsVietnamese(p.amount)}</td>
          </tr>
          <tr>
            <th>Kênh / Chứng từ:</th>
            <td style="border-bottom: 1px dotted #cbd5e1;">${escapeHtml(p.payment_channel)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; margin-top: 40px; min-height: 120px;">
        <div>
          <div style="font-weight: 700;">Giám đốc</div>
          <div style="font-size: 10px; font-style: italic; color: #64748b;">(Ký, đóng dấu)</div>
        </div>
        <div>
          <div style="font-weight: 700;">Kế toán</div>
          <div style="font-size: 10px; font-style: italic; color: #64748b;">(Ký, họ tên)</div>
        </div>
        <div>
          <div style="font-weight: 700;">Thủ quỹ</div>
          <div style="font-size: 10px; font-style: italic; color: #64748b;">(Ký, họ tên)</div>
        </div>
        <div>
          <div style="font-weight: 700;">Người ${isPayment ? 'nhận' : 'nộp'}</div>
          <div style="font-size: 10px; font-style: italic; color: #64748b;">(Ký, họ tên)</div>
        </div>
      </div>

      <div style="margin-top: 50px; text-align: right; font-size: 10px; color: #94a3b8;">
        In lúc: ${escapeHtml(gen)} — Hệ thống quản lý KTSmile Lab
      </div>
    </div>
  `;
}
