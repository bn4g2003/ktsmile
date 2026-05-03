import { downloadPDFFromServer } from "@/lib/reports/download-pdf-server";
import type { PayrollSlipOptions, PayrollSlipRow } from "@/lib/reports/payroll-slip-html";
import {
  buildPayrollBatchPrintHtml,
  buildPayrollSlipHtml,
} from "@/lib/reports/payroll-slip-html";

/** Tên file tải về ASCII/VN-safe, luôn kết thúc `.pdf`. */
export function sanitizePayrollPdfDownloadName(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "").replace(/[^\w.\- ()\u00C0-\u024F]/gi, "_");
  return `${base || "Phieu_luong"}.pdf`;
}

/**
 * Xuất PDF phiếu lương bằng Puppeteer (Server-side).
 * Chrome server tự render → xuất PDF chất lượng y hệt bản in.
 */
export async function downloadPayrollPdfFromHtml(fullHtml: string, filename: string): Promise<void> {
  if (typeof window === "undefined") return;
  const safeName = sanitizePayrollPdfDownloadName(filename.trim() || "Phieu_luong.pdf");
  
  // Gửi thẳng HTML qua API Puppeteer để render
  await downloadPDFFromServer(fullHtml, safeName);
}

/**
 * Xuất một phiếu lương duy nhất.
 */
export async function downloadPayrollSlipPdfFromTemplate(
  row: PayrollSlipRow,
  opts: PayrollSlipOptions,
  filename: string,
): Promise<void> {
  const fullHtml = buildPayrollSlipHtml(row, opts);
  return downloadPayrollPdfFromHtml(fullHtml, filename);
}

/**
 * Xuất nhiều phiếu lương trong một file PDF (In hàng loạt).
 */
export async function downloadPayrollBatchSlipPdfFromTemplate(
  rows: PayrollSlipRow[],
  opts: PayrollSlipOptions,
  filename: string,
): Promise<void> {
  const fullHtml = buildPayrollBatchPrintHtml(rows, opts);
  return downloadPayrollPdfFromHtml(fullHtml, filename);
}
