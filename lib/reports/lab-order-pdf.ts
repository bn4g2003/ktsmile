import { buildPrintShell } from "@/lib/reports/print-html";
import { downloadPDFFromServer } from "@/lib/reports/download-pdf-server";

// ── [HTML2CANVAS] Bỏ comment để dùng html2canvas thay Puppeteer ─────────────
// import type { Html2PdfOptions, Html2PdfWorker } from "html2pdf.js";
// import { buildDownloadShell } from "@/lib/reports/print-html";
// ... (xem git history nếu cần restore)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tải PDF danh sách đơn hàng Labo bằng Puppeteer phía server.
 * Chrome ẩn tự render → xuất PDF chất lượng y hệt bản in.
 */
export async function downloadLabOrderListPdf(
  html: string,
  filename: string
): Promise<void> {
  const fullHtml = buildPrintShell("Hoá đơn báo phí", html);
  await downloadPDFFromServer(fullHtml, filename);
}
