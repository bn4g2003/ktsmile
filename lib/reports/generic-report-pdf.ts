import { buildPrintShell } from "@/lib/reports/print-html";
import { downloadPDFFromServer } from "@/lib/reports/download-pdf-server";

/**
 * Hàm xuất PDF dùng chung cho các báo cáo dạng bảng biểu/biểu đồ.
 * Dùng Puppeteer phía server — chất lượng y hệt bản in.
 */
export async function downloadReportPdf(
  html: string,
  filename: string
): Promise<void> {
  const fullHtml = buildPrintShell("Báo cáo hệ thống", html);
  await downloadPDFFromServer(fullHtml, filename);
}
