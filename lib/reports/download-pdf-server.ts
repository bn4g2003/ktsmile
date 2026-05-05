/**
 * Tải PDF: ưu tiên POST `/api/pdf` (Puppeteer). Không được thì dùng html2pdf.js trong trình duyệt
 * (tự lưu file, không hộp thoại in). Cuối cùng mới fallback in (Save as PDF thủ công).
 */
import { openPrintableHtml } from "@/lib/reports/print-html";
import { downloadPdfViaHtml2Pdf } from "@/lib/reports/download-pdf-html2pdf";

export const PDF_CLIENT_FALLBACK_HINT =
  "Máy chủ không tạo được PDF. Đã thử tải bằng trình duyệt — nếu vẫn lỗi, cửa sổ in sẽ mở: chọn \"Lưu thành PDF\".";

async function tryHtml2PdfSave(fullHtml: string, filename: string): Promise<boolean> {
  try {
    await downloadPdfViaHtml2Pdf(fullHtml, filename);
    return true;
  } catch (e) {
    console.error("[PDF html2pdf]", e);
    return false;
  }
}

async function tryOpenPrintFallback(fullHtml: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    openPrintableHtml(fullHtml);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gửi HTML đầy đủ (đã bọc `buildPrintShell` nếu cần) lên server; nếu thất bại thì html2pdf → in.
 */
export async function downloadPDFFromServer(fullHtml: string, filename: string): Promise<void> {
  let serverDetail = "";
  try {
    const response = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: fullHtml,
        filename,
        baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      }),
    });

    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      try {
        const t = await response.text();
        serverDetail = t.slice(0, 500);
      } catch {
        /* ignore */
      }
      if (await tryHtml2PdfSave(fullHtml, filename)) return;
      if (await tryOpenPrintFallback(fullHtml)) {
        window.alert(PDF_CLIENT_FALLBACK_HINT);
        return;
      }
      throw new Error("Lỗi khi tạo PDF từ server");
    }

    if (contentType.includes("application/json")) {
      try {
        const j = (await response.json()) as { error?: string; detail?: string };
        serverDetail = [j.error, j.detail].filter(Boolean).join(" — ");
      } catch {
        /* ignore */
      }
      if (await tryHtml2PdfSave(fullHtml, filename)) return;
      if (await tryOpenPrintFallback(fullHtml)) {
        window.alert(PDF_CLIENT_FALLBACK_HINT + (serverDetail ? `\n\nChi tiết: ${serverDetail}` : ""));
        return;
      }
      throw new Error(serverDetail || "Lỗi khi tạo PDF từ server");
    }

    const blob = await response.blob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    const isPdf = buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
    if (!isPdf) {
      if (await tryHtml2PdfSave(fullHtml, filename)) return;
      if (await tryOpenPrintFallback(fullHtml)) {
        window.alert(PDF_CLIENT_FALLBACK_HINT);
        return;
      }
      throw new Error("Phản hồi server không phải file PDF.");
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("[PDF Server] Lỗi:", error);
    if (await tryHtml2PdfSave(fullHtml, filename)) return;
    if (await tryOpenPrintFallback(fullHtml)) {
      window.alert(PDF_CLIENT_FALLBACK_HINT);
      return;
    }
    window.alert(
      serverDetail
        ? `Không thể tải PDF.\n\n${serverDetail}`
        : "Không thể tải PDF. Vui lòng thử lại.",
    );
  }
}
