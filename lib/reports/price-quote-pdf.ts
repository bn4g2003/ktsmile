import { buildPrintShell } from "@/lib/reports/print-html";
import { downloadPDFFromServer } from "@/lib/reports/download-pdf-server";

/** Tải PDF Báo giá bằng Puppeteer phía server. */
export async function downloadPriceQuotePdf(
  html: string,
  filename: string
): Promise<void> {
  const fullHtml = buildPrintShell("Báo giá", html);
  await downloadPDFFromServer(fullHtml, filename);
}
