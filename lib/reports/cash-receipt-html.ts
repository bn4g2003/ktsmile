import { formatVnd } from "@/lib/format/currency";
import { formatCashDirection } from "@/lib/format/labels";
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
  const gen = new Date().toLocaleString("vi-VN");
  const partnerLine =
    p.partner_code || p.partner_name
      ? `${escapeHtml(p.partner_code ?? "")}${p.partner_code && p.partner_name ? " — " : ""}${escapeHtml(p.partner_name ?? "")}`
      : "—";
  const supplierLine =
    p.supplier_code || p.supplier_name
      ? `${escapeHtml(p.supplier_code ?? "")}${p.supplier_code && p.supplier_name ? " — " : ""}${escapeHtml(p.supplier_name ?? "")}`
      : "—";
  const h1 = p.direction === "payment" ? "Phiếu chi" : "Phiếu thu";
  const counterpartyLabel = p.direction === "payment" ? "Đối tượng (NCC)" : "Đối tượng (KH)";
  const counterpartyValue = p.direction === "payment" ? supplierLine : partnerLine;
  const payerRow =
    p.direction === "payment"
      ? ""
      : `<tr><th>Người nộp</th><td>${escapeHtml(p.payer_name ?? "—")}</td></tr>`;
  return `
    <h1>${h1}</h1>
    <p class="muted" style="text-align:center;">Số chứng từ: <strong>${escapeHtml(p.doc_number)}</strong> · Ngày: ${escapeHtml(p.transaction_date)}</p>
    <p class="muted" style="text-align:center;font-size:11px;">In lúc: ${escapeHtml(gen)}</p>
    <table class="kv">
      <tbody>
        <tr><th>Loại</th><td>${escapeHtml(formatCashDirection(p.direction))}</td></tr>
        <tr><th>Nghiệp vụ</th><td>${escapeHtml(p.business_category)}</td></tr>
        <tr><th>Số tiền</th><td><strong>${escapeHtml(formatVnd(p.amount))}</strong></td></tr>
        <tr><th>Kênh thanh toán</th><td>${escapeHtml(p.payment_channel)}</td></tr>
        ${payerRow}
        <tr><th>${counterpartyLabel}</th><td>${counterpartyValue}</td></tr>
        <tr><th>Diễn giải</th><td>${escapeHtml(p.description ?? "—")}</td></tr>
      </tbody>
    </table>
  `;
}
