import { escapeHtml } from "@/lib/reports/escape-html";

/** Khung HTML in A4-friendly, UTF-8, font hệ thống (hỗ trợ tiếng Việt qua trình duyệt). */
export function buildPrintShell(title: string, innerBodyHtml: string): string {
  const t = escapeHtml(title);
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${t}</title><style>
    body{font-family:system-ui,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans",Arial,sans-serif;padding:18px;color:#1a2332;font-size:12px;line-height:1.45;max-width:210mm;margin:0 auto;}
    .report-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px;padding-bottom:12px;}
    .report-header .logo-box{flex:0 0 160px;}
    .report-header .logo{width:100%;height:auto;display:block;}
    .report-header .company-box{flex:1;text-align:right;}
    .report-header .company-name{font-size:16px;font-weight:800;margin:0 0 4px;color:#2563eb;text-transform:uppercase;}
    .report-header .company-info{font-size:11px;color:#1e293b;margin:1px 0;line-height:1.3;}
    
    h1{font-size:22px;margin:10px 0 15px;font-weight:800;text-align:center;text-transform:uppercase;color:#000;letter-spacing:0.02em;}
    h2{font-size:13px;margin:20px 0 8px;font-weight:700;color:#1e293b;}
    .muted{color:#64748b;font-size:11px;margin-bottom:10px;}
    
    table{border-collapse:collapse;width:100%;margin-top:6px;table-layout:fixed;}
    th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:middle;word-wrap:break-word;overflow:hidden;}
    th{background:#f1f5f9;font-weight:700;font-size:10px;text-transform:uppercase;color:#475569;height:24px;}
    td{font-size:10.5px;}
    .num{text-align:right;font-variant-numeric:tabular-nums;}
    
    /* KV table: thông tin khách hàng (không viền) */
    table.kv{margin-top:10px;border:none;}
    table.kv th, table.kv td{border:none;padding:2px 0;}
    table.kv th{background:none;width:5.5rem;font-size:11px;font-weight:700;color:#1e293b;text-align:left;text-transform:uppercase;}
    table.kv td{font-size:12px;font-weight:500;}
    
    tfoot tr{font-weight:700;background:#f8fafc;}
    .total-row td{font-size:12px;padding:8px 6px;}

    @media print{
      body{padding:0;}
      @page{margin:10mm;size:A4;}
      .report-header{margin-bottom:15px;}
      th{background-color:#f1f5f9 !important; -webkit-print-color-adjust:exact;}
    }
  </style></head><body><div class="report-header"><div class="logo-box"><img src="/logobaocao.png" alt="Logo" class="logo"/></div><div class="company-box"><div class="company-name">CÔNG TY TNHH KTSMILE MILLING CENTER</div><div class="company-info">Địa chỉ: 447/10 Đường Tân Sơn, Phường An Hội Tây, TP.Hồ Chí Minh</div><div class="company-info">MST: 0318968071 · SĐT: 0906353568</div><div class="company-info">STK: 886978683 Ngân hàng Thương mại cổ phần Quân Đội</div></div></div>${innerBodyHtml}</body></html>`;
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
