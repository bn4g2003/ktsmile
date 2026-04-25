import { formatVnd } from "@/lib/format/currency";
import { htmlBangChu } from "@/lib/reports/amount-in-words-html";
import { formatDateTime } from "@/lib/format/date";
import { escapeHtml } from "@/lib/reports/escape-html";
import { cashVoucherThemeCss } from "@/lib/reports/cash-voucher-theme";

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
  const h1 = isPayment ? "PHIẾU CHI" : "PHIẾU THU";
  const counterpartyLabel = isPayment ? "Nhà cung cấp" : "Khách hàng";
  const counterpartyRaw = isPayment
    ? (p.supplier_name || p.supplier_code || "")
    : (p.partner_name || p.partner_code || "");
  const counterpartyValue = counterpartyRaw.trim() || "—";

  const actorLabel = `Người ${isPayment ? "nhận" : "nộp"} tiền`;
  const actorValue = escapeHtml(p.payer_name || counterpartyValue);
  const docDate = p.transaction_date.split("-").reverse().join("/");

  return `
    <div class="cr-root">
      <h1 class="cr-title">${h1}</h1>
      <div class="cr-meta">
        <p><span class="cr-meta-k">Số phiếu</span><span class="cr-meta-v"><strong>${escapeHtml(p.doc_number)}</strong></span></p>
        <p><span class="cr-meta-k">Ngày chứng từ</span><span class="cr-meta-v">${escapeHtml(docDate)}</span></p>
        <p><span class="cr-meta-k">Loại</span><span class="cr-meta-v">${escapeHtml(isPayment ? "Chi tiền" : "Thu tiền")}</span></p>
        <p><span class="cr-meta-k">Kênh thanh toán</span><span class="cr-meta-v">${escapeHtml(p.payment_channel)}</span></p>
      </div>

      <table class="cr-kv">
        <tbody>
          <tr>
            <th scope="row">${actorLabel}</th>
            <td class="cr-strong">${actorValue}</td>
          </tr>
          ${
            counterpartyValue !== "—"
              ? `<tr>
                  <th scope="row">${counterpartyLabel}</th>
                  <td>${escapeHtml(counterpartyValue)}</td>
                </tr>`
              : ""
          }
          <tr>
            <th scope="row">Nghiệp vụ</th>
            <td>${escapeHtml(p.business_category || "—")}</td>
          </tr>
          <tr>
            <th scope="row">Nội dung</th>
            <td>${escapeHtml(p.description || p.business_category || "—")}</td>
          </tr>
          <tr>
            <th scope="row">Số tiền</th>
            <td class="cr-amount">${escapeHtml(formatVnd(p.amount))} VNĐ</td>
          </tr>
        </tbody>
      </table>
      ${htmlBangChu(p.amount, "Số tiền bằng chữ")}

      <div class="cr-sign">
        <div class="cr-sign-box">
          <div class="cr-sign-title">Giám đốc</div>
          <div class="cr-sign-hint">(Ký, đóng dấu)</div>
        </div>
        <div class="cr-sign-box">
          <div class="cr-sign-title">Kế toán</div>
          <div class="cr-sign-hint">(Ký, họ tên)</div>
        </div>
        <div class="cr-sign-box">
          <div class="cr-sign-title">Thủ quỹ</div>
          <div class="cr-sign-hint">(Ký, họ tên)</div>
        </div>
        <div class="cr-sign-box">
          <div class="cr-sign-title">${actorLabel}</div>
          <div class="cr-sign-hint">(Ký, họ tên)</div>
        </div>
      </div>

      <div class="cr-foot">In lúc: ${escapeHtml(gen)} — Hệ thống quản lý KTSmile Lab</div>
    </div>

    <style>${cashVoucherThemeCss()}</style>
  `;
}
