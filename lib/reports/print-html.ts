import { BRAND_LOGO_PUBLIC_PATH } from "@/lib/brand/logo-public-path";
import { escapeHtml } from "@/lib/reports/escape-html";

/** Thông báo khi `window.open` trả về null (popup bị chặn). */
export const PRINT_POPUP_BLOCKED_MESSAGE =
  "Không mở được cửa sổ in. Trình duyệt đã chặn popup — bấm biểu tượng popup trên thanh địa chỉ và chọn “Luôn cho phép” cho trang này, rồi thử lại.";

/** Khung HTML in A4-friendly, UTF-8, font hệ thống (hỗ trợ tiếng Việt qua trình duyệt). */
export function buildPrintShell(title: string, innerBodyHtml: string): string {
  const t = escapeHtml(title);
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${t}</title><style>
    *,*::before,*::after{box-sizing:border-box;}
    html,body{margin:0;}
    body{font-family:"Times New Roman",Times,serif;padding:30px;color:#1a2332;font-size:13px;line-height:1.45;max-width:190mm;margin:0 auto;background-color:#fff;}
    .print-root{max-width:100%;width:100%;min-width:0;}

    /* Header kiểu Bảng để cố định Chữ trái - Logo phải sát lề */
    .report-header-table{width:100%;border:none !important;margin-bottom:20px;border-bottom:2px solid #2563eb !important;padding-bottom:12px;table-layout:fixed !important;}
    .report-header-table td{border:none !important;padding:0 !important;vertical-align:middle !important;}
    .company-box{text-align:left !important;width:75% !important;}
    .logo-box{text-align:right !important;width:25% !important;}
    .logo{max-width:180px !important;height:auto;display:inline-block !important;margin:0 !important;padding:0 !important;}

    .company-name{font-size:18px;font-weight:800;margin:0 0 4px;color:#2563eb;text-transform:uppercase;}
    .company-info{font-size:12px;color:#1e293b;margin:1px 0;line-height:1.3;}

    h1{font-size:24px;margin:15px 0 20px;font-weight:800;text-align:center;text-transform:uppercase;color:#000;letter-spacing:0.02em;}
    h2{font-size:15px;margin:20px 0 10px;font-weight:700;color:#1e293b;}
    .muted{color:#64748b;font-size:12px;margin-bottom:10px;}

    table{border-collapse:collapse;width:100%;max-width:100%;margin-top:8px;table-layout:fixed;}
    th,td{border:1px solid #94a3b8;padding:6px 8px;text-align:left;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word;}
    th{background:#f2f2f2;font-weight:700;font-size:12px;text-transform:uppercase;color:#000;height:30px;}
    td{font-size:13px;color:#000;}
    .num{text-align:right;font-variant-numeric:tabular-nums;}

    table.kv{margin-top:12px;border:none;}
    table.kv th,table.kv td{border:none;padding:3px 0;}
    table.kv th{background:none;width:6rem;font-size:13px;font-weight:700;color:#1e293b;text-align:left;text-transform:uppercase;}
    table.kv td{font-size:13px;font-weight:500;}

    tfoot tr{font-weight:700;background:#f8fafc;}
    .total-row td{font-size:13px;padding:10px 8px;}

    @media print{
      html,body{max-width:100%!important;width:100%!important;margin:0!important;padding:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      @page{margin:10mm 12mm 10mm 10mm;size:A4 portrait;}
      .report-header-table{margin-bottom:15px;}
    }
  </style></head><body><div class="print-root">
    <table class="report-header-table">
      <tr>
        <td class="company-box">
          <div class="company-name">CÔNG TY TNHH KTSMILE</div>
          <div class="company-info">Địa chỉ: 447/10 Đường Tân Sơn, Phường An Hội Tây, TP.Hồ Chí Minh</div>
          <div class="company-info">MST: 0318968071 · SĐT: 0906353568</div>
          <div class="company-info">STK: 886978683 Ngân hàng Thương mại cổ phần Quân Đội</div>
        </td>
        <td class="logo-box">
          <img src="${escapeHtml(BRAND_LOGO_PUBLIC_PATH)}" alt="Logo" class="logo"/>
        </td>
      </tr>
    </table>
    ${innerBodyHtml}
  </div></body></html>`;
}

/**
 * Khung HTML tối ưu cho html2canvas / html2pdf.js.
 * Khác buildPrintShell: width cố định 794px (A4 @96dpi), không dùng @media print,
 * ép màu nền và viền bằng !important để html2canvas chụp đúng.
 */
export function buildDownloadShell(title: string, innerBodyHtml: string): string {
  const t = escapeHtml(title);
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>${t}</title><style>
    /* ── Reset ── */
    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Body: cố định 794px = A4 tại 96dpi ── */
    html, body {
      width: 794px !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: "Times New Roman", Times, serif !important;
      font-size: 13px !important;
      color: #111 !important;
      line-height: 1.45 !important;
      padding: 28px 32px !important;
    }
    .print-root { width: 100% !important; }

    /* ── Header: table-layout fixed để logo không đè lên chữ ── */
    .report-header-table {
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      border: none !important;
      border-bottom: 2.5px solid #1d4ed8 !important;
      padding-bottom: 12px !important;
      margin-bottom: 18px !important;
    }
    .report-header-table td { border: none !important; padding: 0 !important; vertical-align: middle !important; }
    .company-box { width: 70% !important; text-align: left !important; }
    .logo-box    { width: 30% !important; text-align: right !important; }
    .logo { max-width: 150px !important; max-height: 80px !important; height: auto !important; display: inline-block !important; }
    .company-name { font-size: 16px !important; font-weight: 800 !important; color: #1d4ed8 !important; text-transform: uppercase !important; margin-bottom: 4px !important; }
    .company-info { font-size: 11.5px !important; color: #1e293b !important; line-height: 1.55 !important; }

    /* ── Tiêu đề ── */
    h1 { font-size: 22px !important; font-weight: 900 !important; text-align: center !important; text-transform: uppercase !important; color: #0f172a !important; margin: 16px 0 8px !important; }
    h2 { font-size: 14px !important; font-weight: 700 !important; color: #1e293b !important; margin: 14px 0 8px !important; }
    .muted { font-size: 11px !important; color: #64748b !important; margin-bottom: 8px !important; }

    /* ── Bảng dữ liệu: không dùng overflow:hidden để tránh mất chữ dài ── */
    table:not(.report-header-table) {
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      margin-top: 8px !important;
      margin-bottom: 8px !important;
    }
    /* Chỉ áp dụng border cho bảng DỮ LIỆU, không áp dụng cho header table */
    table:not(.report-header-table) th,
    table:not(.report-header-table) td {
      border: 1px solid #475569 !important;
      padding: 5px 4px !important;
      text-align: left !important;
      vertical-align: middle !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
    }
    /* Nền đậm + chữ trắng — ép màu để html2canvas chụp đúng */
    table:not(.report-header-table) th {
      background-color: #1e3a5f !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      font-size: 11px !important;
      text-transform: uppercase !important;
      text-align: center !important;
      -webkit-print-color-adjust: exact !important;
    }
    table:not(.report-header-table) td { font-size: 12px !important; color: #111 !important; }
    .num { text-align: right !important; font-variant-numeric: tabular-nums !important; }

    /* ── Width từng cột hoá đơn Labo (tổng ≈ 730px = 794 - 64px padding) ── */
    table:not(.report-header-table) th:nth-child(1),  table:not(.report-header-table) td:nth-child(1)  { width: 28px !important;  text-align: center !important; } /* STT */
    table:not(.report-header-table) th:nth-child(2),  table:not(.report-header-table) td:nth-child(2)  { width: 72px !important;  text-align: center !important; } /* Ngày nhận */
    table:not(.report-header-table) th:nth-child(3),  table:not(.report-header-table) td:nth-child(3)  { width: 78px !important; }                                  /* Nha khoa */
    table:not(.report-header-table) th:nth-child(4),  table:not(.report-header-table) td:nth-child(4)  { width: 88px !important;  font-weight: 700 !important; }    /* Bệnh nhân */
    table:not(.report-header-table) th:nth-child(5),  table:not(.report-header-table) td:nth-child(5)  { width: 92px !important; }                                  /* Số đơn */
    table:not(.report-header-table) th:nth-child(6),  table:not(.report-header-table) td:nth-child(6)  { width: 105px !important; }                                 /* Sản phẩm */
    table:not(.report-header-table) th:nth-child(7),  table:not(.report-header-table) td:nth-child(7)  { width: 105px !important; }                                 /* Vị trí răng */
    table:not(.report-header-table) th:nth-child(8),  table:not(.report-header-table) td:nth-child(8)  { width: 28px !important;  text-align: center !important; } /* SL */
    table:not(.report-header-table) th:nth-child(9),  table:not(.report-header-table) td:nth-child(9)  { width: 82px !important;  text-align: right !important; font-weight: 700 !important; } /* Thành tiền */
    table:not(.report-header-table) th:nth-child(10), table:not(.report-header-table) td:nth-child(10) { width: 52px !important; }                                  /* Ghi chú */

    /* ── Dòng chẵn lẻ xen kẽ ── */
    table:not(.report-header-table) tbody tr:nth-child(even) td {
      background-color: #f8fafc !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* ── Bảng key-value ── */
    table.kv { border: none !important; margin-top: 10px !important; }
    table.kv th, table.kv td { border: none !important; padding: 2px 0 !important; }
    table.kv th { background: none !important; width: 7rem !important; font-size: 12px !important; font-weight: 700 !important; color: #1e293b !important; text-align: left !important; text-transform: uppercase !important; }
    table.kv td { font-size: 13px !important; font-weight: 500 !important; }

    /* ── Tổng cuối bảng (tfoot) ── */
    tfoot tr td { font-weight: 700 !important; background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact !important; }
    tfoot tr:last-child td { background-color: #dbeafe !important; color: #1e3a5f !important; font-size: 13.5px !important; }
    .total-row td { padding: 8px 4px !important; }
  </style></head><body><div class="print-root">
    <table class="report-header-table">
      <tr>
        <td class="company-box">
          <div class="company-name">CÔNG TY TNHH KTSMILE</div>
          <div class="company-info">Địa chỉ: 447/10 Đường Tân Sơn, Phường An Hội Tây, TP.Hồ Chí Minh</div>
          <div class="company-info">MST: 0318968071 · SĐT: 0906353568</div>
          <div class="company-info">STK: 886978683 Ngân hàng Thương mại cổ phần Quân Đội</div>
        </td>
        <td class="logo-box">
          <img src="${escapeHtml(BRAND_LOGO_PUBLIC_PATH)}" alt="Logo" class="logo"/>
        </td>
      </tr>
    </table>
    ${innerBodyHtml}
  </div></body></html>`;
}

/** Ghi toàn bộ tài liệu HTML vào tab đã mở (không gọi in). */
export function writeHtmlToWindow(w: Window, fullDocumentHtml: string): boolean {
  try {
    w.document.open();
    w.document.write(fullDocumentHtml);
    w.document.close();
    return true;
  } catch {
    try {
      w.close();
    } catch {
      /* ignore */
    }
    return false;
  }
}

/**
 * Ghi HTML vào tab đã mở rồi gọi in.
 */
export function writeAndPrintToWindow(w: Window, fullDocumentHtml: string): void {
  if (!writeHtmlToWindow(w, fullDocumentHtml)) return;
  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  w.addEventListener("load", () => setTimeout(runPrint, 350), { once: true });
  if (w.document.readyState === "complete") {
    setTimeout(runPrint, 350);
  }
  setTimeout(runPrint, 900);
}

/**
 * Mở tab mới, ghi HTML, gọi hộp thoại in.
 */
export function openPrintableHtml(fullDocumentHtml: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("about:blank", "_blank");
  if (!w) {
    window.alert(PRINT_POPUP_BLOCKED_MESSAGE);
    return;
  }
  writeAndPrintToWindow(w, fullDocumentHtml);
}

/** Mở tab trống ngay trong handler click (đồng bộ). */
export function openBlankPrintTab(): Window | null {
  if (typeof window === "undefined") return null;
  return window.open("about:blank", "_blank");
}
