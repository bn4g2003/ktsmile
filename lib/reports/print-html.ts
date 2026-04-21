import { escapeHtml } from "@/lib/reports/escape-html";

/** Khung HTML in A4-friendly, UTF-8, font hệ thống (hỗ trợ tiếng Việt qua trình duyệt). */
export function buildPrintShell(title: string, innerBodyHtml: string): string {
  const t = escapeHtml(title);
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${t}</title><style>
    body{font-family:system-ui,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans",Arial,sans-serif;padding:18px;color:#1a2332;font-size:13px;line-height:1.45;max-width:210mm;margin:0 auto;}
    .report-header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1a2332;padding-bottom:16px;}
    .report-header .logo{max-width:180px;height:auto;margin:0 auto 12px;}
    .report-header .company-name{font-size:16px;font-weight:700;margin:4px 0;text-transform:uppercase;color:#1a2332;}
    .report-header .company-info{font-size:11px;color:#5c6678;margin:2px 0;}
    h1{font-size:18px;margin:16px 0 8px;font-weight:700;text-align:center;text-transform:uppercase;}
    h2{font-size:14px;margin:16px 0 8px;font-weight:600;}
    .muted{color:#5c6678;font-size:12px;margin-bottom:14px;}
    table{border-collapse:collapse;width:100%;margin-top:6px;}
    th,td{border:1px solid #d5dae3;padding:6px 8px;text-align:left;vertical-align:top;}
    th{background:#eef1f5;font-weight:600;font-size:11px;}
    .num{text-align:right;font-variant-numeric:tabular-nums;}
    table.kv{margin-top:10px;max-width:640px;}
    table.kv th{text-align:left;width:7.5rem;font-size:12px;font-weight:600;background:#f4f6f9;}
    table.kv td{font-size:12px;}
    tfoot tr{font-weight:600;background:#f9fafb;}
    @media print{
      body{padding:12px;}
      @page{margin:12mm;size:A4;}
    }
  </style></head><body><div class="report-header"><img src="/logobaocao.png" alt="Logo" class="logo"/><div class="company-name">CÔNG TY TNHH KTSMILE MILLING CENTER</div><div class="company-info">Địa chỉ: 447/10 Đường Tân Sơn, Phường An Hội Tây, TP.Hồ Chí Minh</div><div class="company-info">MST: 0318968071 · SĐT: 0906353568</div><div class="company-info">STK: 886978683 Ngân hàng Thương mại cổ phần Quân Đội</div></div>${innerBodyHtml}</body></html>`;
}

/**
 * Ghi HTML vào tab đã mở rồi gọi in.
 * (Tách riêng để luồng async vẫn dùng được: mở tab trong cùng lượt click với `window.open`.)
 */
export function writeAndPrintToWindow(w: Window, fullDocumentHtml: string): void {
  w.document.open();
  w.document.write(fullDocumentHtml);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 200);
}

/**
 * Mở tab mới, ghi HTML, gọi hộp thoại in (PDF qua “Lưu dưới dạng PDF” của trình duyệt).
 * Không dùng `noopener` trên `window.open`: nhiều trình duyệt trả về `null` và không ghi được document.
 */
export function openPrintableHtml(fullDocumentHtml: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("about:blank", "_blank");
  if (!w) {
    window.alert(
      "Không mở được cửa sổ in. Trình duyệt đã chặn popup — bấm biểu tượng popup trên thanh địa chỉ và chọn “Luôn cho phép” cho trang này, rồi thử lại.",
    );
    return;
  }
  writeAndPrintToWindow(w, fullDocumentHtml);
}

/** Mở tab trống ngay trong handler click (đồng bộ) để không bị chặn popup sau `await`. Trả về `null` nếu bị chặn. */
export function openBlankPrintTab(): Window | null {
  if (typeof window === "undefined") return null;
  return window.open("about:blank", "_blank");
}
