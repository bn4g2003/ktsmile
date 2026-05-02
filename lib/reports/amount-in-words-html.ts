import { amountInWordsVietnamese } from "@/lib/format/currency";
import { escapeHtml } from "@/lib/reports/escape-html";

/** Dòng “Bằng chữ” cho phiếu in PDF/HTML (số tiền làm tròn VNĐ). */
export function htmlBangChu(amount: number, label = "Bằng chữ"): string {
  const n = Math.round(Number(amount) || 0);
  const words = escapeHtml(amountInWordsVietnamese(n));
  return `<div class="bang-chu-line"><strong>${escapeHtml(label)}:</strong> ${words}</div>`;
}
