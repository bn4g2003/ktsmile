/**
 * Tải PDF: ưu tiên POST `/api/pdf` (Puppeteer + Chromium trên server).
 * Trên hosting không có Chrome (vd Hostinger), API thường lỗi — khi đó tự
 * mở hộp thoại in của trình duyệt để người dùng chọn "Lưu thành PDF".
 */
import { openPrintableHtml } from "@/lib/reports/print-html";

export const PDF_SERVER_UNAVAILABLE_HINT =
  "Máy chủ không tạo được PDF tự động (thường do không cài Chromium/Chrome như trên Vercel). Đã mở bản xem in — hãy chọn máy in \"Lưu thành PDF\" / \"Save as PDF\" (hoặc Microsoft Print to PDF) rồi lưu file.";

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
 * Gửi HTML đầy đủ (đã bọc `buildPrintShell` nếu cần) lên server; nếu thất bại thì fallback in.
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
      if (await tryOpenPrintFallback(fullHtml)) {
        window.alert(PDF_SERVER_UNAVAILABLE_HINT);
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
      if (await tryOpenPrintFallback(fullHtml)) {
        window.alert(PDF_SERVER_UNAVAILABLE_HINT + (serverDetail ? `\n\nChi tiết: ${serverDetail}` : ""));
        return;
      }
      throw new Error(serverDetail || "Lỗi khi tạo PDF từ server");
    }

    const blob = await response.blob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    const isPdf = buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
    if (!isPdf) {
      if (await tryOpenPrintFallback(fullHtml)) {
        window.alert(PDF_SERVER_UNAVAILABLE_HINT);
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
    if (await tryOpenPrintFallback(fullHtml)) {
      window.alert(PDF_SERVER_UNAVAILABLE_HINT);
      return;
    }
    window.alert(
      serverDetail
        ? `Không thể tải PDF.\n\n${serverDetail}`
        : "Không thể tải PDF từ server. Vui lòng thử lại.",
    );
  }
}
