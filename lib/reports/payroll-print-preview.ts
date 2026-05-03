import { PRINT_POPUP_BLOCKED_MESSAGE, openBlankPrintTab, writeHtmlToWindow } from "@/lib/reports/print-html";

/** Chèn thanh xem trước + đường dẫn (URL) vào cuối `<head>` / đầu `<body>`. */
export function withPayrollPrintPreviewChrome(fullDocumentHtml: string): string {
  const chromeStyles = `<style id="ktsmile-payroll-preview-chrome">
    @media screen {
      body { padding-top: 54px !important; }
    }
    @media print {
      body { padding-top: 0 !important; }
      #ktsmile-payroll-preview-bar { display: none !important; }
    }
    #ktsmile-payroll-preview-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px 14px;
      padding: 10px 16px;
      background: #0f172a;
      color: #f8fafc;
      font-family: "Times New Roman", Times, serif;
      font-size: 13px;
      line-height: 1.35;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #ktsmile-payroll-preview-bar .ktsmile-preview-title {
      font-weight: 700;
      flex-shrink: 0;
    }
    #ktsmile-payroll-preview-bar .ktsmile-preview-path {
      flex: 1 1 12rem;
      min-width: 0;
      font-size: 11px;
      background: #1e293b;
      color: #e2e8f0;
      padding: 5px 9px;
      border-radius: 4px;
      word-break: break-all;
      font-family: ui-monospace, "Cascadia Code", monospace;
    }
    #ktsmile-payroll-preview-bar button {
      cursor: pointer;
      border: none;
      border-radius: 6px;
      padding: 7px 14px;
      font-weight: 600;
      font-size: 13px;
      font-family: inherit;
    }
    #ktsmile-payroll-preview-bar .ktsmile-btn-print {
      background: #2563eb;
      color: #fff;
    }
    #ktsmile-payroll-preview-bar .ktsmile-btn-download {
      background: #10b981;
      color: #fff;
    }
    #ktsmile-payroll-preview-bar .ktsmile-btn-close {
      background: #475569;
      color: #fff;
    }
    #ktsmile-payroll-preview-bar button:hover {
      filter: brightness(1.06);
    }
    #ktsmile-payroll-preview-bar button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  </style>`;

  const bar = `
    <div id="ktsmile-payroll-preview-bar" role="region" aria-label="Xem trước in">
      <span class="ktsmile-preview-title">Xem trước</span>
      <code class="ktsmile-preview-path" id="ktsmile-payroll-preview-location">Đang mở…</code>
      <button type="button" class="ktsmile-btn-print" onclick="window.print()">In ngay</button>
      <button type="button" id="ktsmile-download-pdf-btn" class="ktsmile-btn-download" onclick="downloadAsPdf()">Tải PDF</button>
      <button type="button" class="ktsmile-btn-close" onclick="window.close()">Đóng cửa sổ</button>
    </div>
    <script>
      (function () {
        var el = document.getElementById("ktsmile-payroll-preview-location");
        if (el) el.textContent = typeof location !== "undefined" ? (location.href || "about:blank") : "";
      })();

      async function downloadAsPdf() {
        const btn = document.getElementById("ktsmile-download-pdf-btn");
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Đang xử lý…";

        try {
          // Lấy nội dung gốc, loại bỏ thanh preview chrome để không bị dính vào PDF
          const styleClone = document.getElementById("ktsmile-payroll-preview-chrome");
          const barClone = document.getElementById("ktsmile-payroll-preview-bar");
          
          if (styleClone) styleClone.remove();
          if (barClone) barClone.remove();
          
          const htmlContent = document.documentElement.outerHTML;
          
          // Khôi phục lại giao diện sau khi đã lấy nội dung
          if (styleClone) document.head.appendChild(styleClone);
          if (barClone) document.body.prepend(barClone);

          const response = await fetch("/api/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              html: htmlContent, 
              filename: "Phieu_luong_" + new Date().getTime() + ".pdf" 
            }),
          });

          if (!response.ok) throw new Error("Lỗi server");

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "Phieu_luong.pdf";
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
        } catch (err) {
          console.error(err);
          alert("Không thể tải PDF. Vui lòng thử lại.");
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }
    </script>
  `.trim();

  let out = fullDocumentHtml;
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${chromeStyles}\n</head>`);
  } else {
    out = `${chromeStyles}\n${out}`;
  }

  const bodyMatch = /<body(\s[^>]*)?>/i.exec(out);
  if (bodyMatch) {
    out = out.replace(bodyMatch[0], `${bodyMatch[0]}${bar}\n`);
  } else {
    out = `${bar}\n${out}`;
  }

  return out;
}

/**
 * Mở tab mới: hiển thị phiếu để xem trước; người dùng bấm **In ngay** để `window.print()`.
 * Khác `writeAndPrintToWindow`: không ép hộp thoại in ngay khi tải.
 */
export function openPayrollPrintPreview(fullDocumentHtml: string): void {
  const w = openBlankPrintTab();
  if (!w) {
    window.alert(PRINT_POPUP_BLOCKED_MESSAGE);
    return;
  }
  writeHtmlToWindow(w, withPayrollPrintPreviewChrome(fullDocumentHtml));
}
