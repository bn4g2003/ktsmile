import { amountInWordsVietnamese } from "@/lib/format/currency";
import { escapeHtml } from "@/lib/reports/escape-html";

/** Dòng “Bằng chữ” cho phiếu in PDF/HTML (số tiền làm tròn VNĐ). */
export function htmlBangChu(amount: number, label = "Bằng chữ"): string {
  const n = Math.round(Number(amount) || 0);
  return `<div style="margin-top:6px;font-size:11px;font-style:italic;color:#0f172a;line-height:1.45;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(amountInWordsVietnamese(n))}</div>`;
}
