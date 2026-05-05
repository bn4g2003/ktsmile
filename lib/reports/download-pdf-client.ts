/**
 * Helper chuyên trách việc gửi HTML lên server để Puppeteer xử lý và tải PDF về trình duyệt.
 */
export async function downloadPdfFromServer(html: string, fileName: string = "document.pdf") {
  const response = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || "Lỗi server khi tạo PDF");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
