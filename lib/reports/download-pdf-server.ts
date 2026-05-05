/**
 * Gửi nội dung HTML lên server để Puppeteer render PDF và tải về.
 */
export async function downloadPDFFromServer(
  html: string,
  filename: string
): Promise<void> {
  try {
    const response = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename }),
    });

    if (!response.ok) {
      throw new Error("Lỗi khi tạo PDF từ server");
    }

    // Nhận blob và tải file về
    const blob = await response.blob();
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
    alert("Không thể tải PDF từ server. Vui lòng thử lại.");
  }
}
