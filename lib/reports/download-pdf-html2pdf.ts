"use client";

/**
 * Tạo PDF trong trình duyệt (html2pdf.js). Dùng CSS `wrapPrintHtmlForCanvasPdf` (giống buildDownloadShell)
 * để html2canvas chụp gần với bản Chromium hơn; scale/chất lượng JPEG tăng so với mặc định.
 */
import { wrapPrintHtmlForCanvasPdf } from "@/lib/reports/print-html";

function safeFilename(name: string): string {
  const n = name.trim().endsWith(".pdf") ? name.trim() : `${name.trim() || "document"}.pdf`;
  return n.replace(/[/\\?%*:|"<>]/g, "_");
}

/** Chờ font & ảnh trong iframe trước khi canvas chụp (giảm chữ méo / logo chưa tải). */
async function waitForIframeRender(doc: Document): Promise<void> {
  try {
    if (doc.fonts?.ready) {
      await Promise.race([
        doc.fonts.ready,
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    }
  } catch {
    /* ignore */
  }
  const imgs = [...doc.images];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 2500);
        }),
    ),
  );
  await new Promise((r) => setTimeout(r, 120));
}

/**
 * @param fullHtml Chuỗi HTML đầy đủ (thường từ `buildPrintShell`).
 */
export async function downloadPdfViaHtml2Pdf(fullHtml: string, filename: string): Promise<void> {
  const preparedHtml = wrapPrintHtmlForCanvasPdf(fullHtml);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;min-height:1123px;border:0;visibility:hidden;pointer-events:none;";
  document.body.appendChild(iframe);

  try {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
      throw new Error("Không tạo được iframe xuất PDF.");
    }

    doc.open();
    doc.write(preparedHtml);
    doc.close();

    await new Promise<void>((resolve) => {
      const w = iframe.contentWindow;
      if (!w) {
        resolve();
        return;
      }
      const finish = () => resolve();
      if (w.document.readyState === "complete") {
        queueMicrotask(finish);
      } else {
        w.addEventListener("load", finish, { once: true });
      }
    });

    await waitForIframeRender(doc);

    const body = win.document.body;
    if (!body || !body.innerHTML.trim()) {
      throw new Error("Nội dung PDF trống.");
    }

    const dpr = typeof window !== "undefined" ? Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 2)) : 2;
    const canvasScale = Math.round(dpr * 100) / 100;

    const html2pdf = (await import("html2pdf.js")).default;
    const outName = safeFilename(filename);

    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename: outName,
        image: { type: "jpeg", quality: 0.97 },
        html2canvas: {
          scale: canvasScale,
          useCORS: true,
          allowTaint: false,
          logging: false,
          letterRendering: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], avoid: [".report-header-table", "tr", "img"] },
      })
      .from(body)
      .save();
  } finally {
    iframe.remove();
  }
}
