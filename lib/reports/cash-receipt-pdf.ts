import { buildPrintShell } from "@/lib/reports/print-html";
import { downloadPDFFromServer } from "@/lib/reports/download-pdf-server";

export async function downloadCashReceiptPdf(
  html: string,
  filename: string
): Promise<void> {
  const fullHtml = buildPrintShell("Chứng từ sổ quỹ", html);
  await downloadPDFFromServer(fullHtml, filename);
}
