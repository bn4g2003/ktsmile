"use client";

/**
 * Tạo PDF trong trình duyệt (html2pdf.js) và gọi lưu tải xuống — không qua hộp thoại in.
 * Dùng khi `/api/pdf` không dùng được (vd Hostinger không có Chromium).
 */

function safeFilename(name: string): string {
  const n = name.trim().endsWith(".pdf") ? name.trim() : `${name.trim() || "document"}.pdf`;
  return n.replace(/[/\\?%*:|"<>]/g, "_");
}

/**
 * @param fullHtml Chuỗi HTML đầy đủ `<!DOCTYPE html>...` (vd từ `buildPrintShell`).
 */
export async function downloadPdfViaHtml2Pdf(fullHtml: string, filename: string): Promise<void> {
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
    doc.write(fullHtml);
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

    // Chờ layout / ảnh (logo) ổn định cho html2canvas
    await new Promise((r) => setTimeout(r, 500));

    const body = win.document.body;
    if (!body || !body.innerHTML.trim()) {
      throw new Error("Nội dung PDF trống.");
    }

    const html2pdf = (await import("html2pdf.js")).default;
    const outName = safeFilename(filename);

    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: outName,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(body)
      .save();
  } finally {
    iframe.remove();
  }
}
