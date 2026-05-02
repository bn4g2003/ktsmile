import { buildPrintShell } from "@/lib/reports/print-html";
import { downloadPDFFromServer } from "@/lib/reports/download-pdf-server";

/** Tải PDF Giấy báo thanh toán bằng Puppeteer phía server. */
export async function downloadPaymentNoticePdf(
  html: string,
  filename: string
): Promise<void> {
  const fullHtml = buildPrintShell("Giấy báo thanh toán", html);
  await downloadPDFFromServer(fullHtml, filename);
}
