import { buildPrintShell } from "@/lib/reports/print-html";
import { downloadPDFFromServer } from "@/lib/reports/download-pdf-server";

/** Tải PDF Phiếu kho bằng Puppeteer phía server. */
export async function downloadStockVoucherPdf(
  html: string,
  filename: string
): Promise<void> {
  const fullHtml = buildPrintShell("Phiếu kho", html);
  await downloadPDFFromServer(fullHtml, filename);
}
