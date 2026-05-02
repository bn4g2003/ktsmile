
export async function downloadPDFFromServer(
  html: string,
  filename: string
): Promise<void> {
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, filename: safeFilename, baseUrl }),
  });

  if (!res.ok) {
    let detail = "Unknown error";
    try {
      const json = await res.json();
      detail = json.detail ?? json.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`PDF generation failed (${res.status}): ${detail}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = safeFilename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Đợi một chút để trình duyệt kịp bắt đầu tải trước khi revoke
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
