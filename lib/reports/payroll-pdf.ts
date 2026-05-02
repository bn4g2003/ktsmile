import type { Html2PdfOptions, Html2PdfWorker } from "html2pdf.js";

import type { PayrollSlipOptions, PayrollSlipRow } from "@/lib/reports/payroll-slip-html";
import {
  buildPayrollBatchPrintHtml,
  buildPayrollSlipHtml,
  getPayrollSlipStylesForHtml2PdfParent,
  PAYROLL_SLIP_PAGE_HEIGHT_MM,
  PAYROLL_SLIP_PAGE_WIDTH_MM,
} from "@/lib/reports/payroll-slip-html";

const PAYROLL_HTML2PDF_PARENT_STYLE_ID = "ktsmile-payroll-html2pdf-mount-styles";

function attachPayrollHtml2PdfStylesToMainDocument(): HTMLStyleElement {
  document.getElementById(PAYROLL_HTML2PDF_PARENT_STYLE_ID)?.remove();
  const el = document.createElement("style");
  el.id = PAYROLL_HTML2PDF_PARENT_STYLE_ID;
  el.setAttribute("media", "all");
  el.textContent = getPayrollSlipStylesForHtml2PdfParent();
  document.head.appendChild(el);
  return el;
}

function detachPayrollHtml2PdfStyles(styleEl?: HTMLStyleElement | null): void {
  if (styleEl?.parentNode) styleEl.parentNode.removeChild(styleEl);
  document.getElementById(PAYROLL_HTML2PDF_PARENT_STYLE_ID)?.remove();
}

/**
 * Xuất PDF phiếu lương (client, html2pdf.js + html2canvas).
 * Khổ A4; lề khớp `@page` trong `payroll-slip-html.ts`.
 */

/** Top, right, bottom, left (mm); đồng bộ `@media print`. */
const PAYROLL_PDF_MARGIN_MM: [number, number, number, number] = [10, 10, 11, 10];

/** Gói tùy chọn html2pdf — tách riêng để đổi và audit một chỗ. */
function buildPayrollHtml2PdfOptions(filename: string): Html2PdfOptions {
  return {
    filename,
    margin: PAYROLL_PDF_MARGIN_MM,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      letterRendering: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
    },
    jsPDF: {
      unit: "mm" as const,
      format: "a4" as const,
      orientation: "portrait" as const,
    },
    pagebreak: { mode: ["css", "legacy"] },
  };
}

/** Tên file tải về ASCII/VN-safe, luôn kết thúc `.pdf`. */
export function sanitizePayrollPdfDownloadName(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "").replace(/[^\w.\- ()\u00C0-\u024F]/gi, "_");
  return `${base || "Phieu_luong"}.pdf`;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Để ảnh `/…` trong `srcDoc`/iframe giải đúng origin của app. */
function injectPayrollPdfBaseHref(fullHtml: string, origin: string): string {
  const baseHref = `${origin.replace(/\/$/, "")}/`;
  const baseTag = `<base href="${escapeHtmlAttr(baseHref)}" />`;
  if (/<head\b[^>]*>/i.test(fullHtml)) {
    return fullHtml.replace(/<head\b[^>]*>/i, (m) => `${m}\n${baseTag}\n`);
  }
  return fullHtml;
}

const HIDDEN_IFRAME_STYLE =
  `position:fixed!important;left:-10000px!important;top:0!important;width:${PAYROLL_SLIP_PAGE_WIDTH_MM}mm!important;` +
  `min-height:${PAYROLL_SLIP_PAGE_HEIGHT_MM}mm!important;border:0!important;margin:0!important;padding:0!important;` +
  "visibility:hidden!important;pointer-events:none!important;";

function detachIframeSafe(iframe: HTMLIFrameElement) {
  if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
}

async function resolveHtml2Pdf(): Promise<() => Html2PdfWorker> {
  const mod = await import("html2pdf.js");
  const html2pdf = mod.default as unknown;
  if (typeof html2pdf !== "function") throw new Error("Thư viện html2pdf.js không khả dụng.");
  return html2pdf as () => Html2PdfWorker;
}

/** Đợi document trong iframe và một nhịp paint trước khi đo/layout. */
function waitIframeLoaded(idoc: Document, win: Window, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (idoc.readyState === "complete") {
      resolve();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    win.addEventListener("load", finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

const IMAGE_DECODE_TIMEOUT_MS = 5000;
const EXTRA_LAYOUT_SETTLE_MS = 280;

async function waitForImagesInDocument(doc: Document): Promise<void> {
  const list = [...doc.images];
  if (list.length === 0) return;
  await Promise.all(
    list.map((img) => {
      if (img.complete) {
        if (img.naturalWidth > 0) return Promise.resolve();
        /** ảnh broken — vẫn tiếp tục */
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, IMAGE_DECODE_TIMEOUT_MS);
      });
    }),
  );
}

function settleAfterMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFontsAndPaint(idoc: Document, win: Window): Promise<void> {
  try {
    const waitDoc = typeof document.fonts?.ready?.then === "function" ? document.fonts.ready : Promise.resolve();
    await Promise.race([waitDoc, settleAfterMs(500)]);
    const waitFrame = typeof idoc.fonts?.ready?.then === "function" ? idoc.fonts.ready : Promise.resolve();
    await Promise.race([waitFrame, settleAfterMs(400)]);
  } catch {
    /* FontFaceSet không hỗ trợ hoặc lỗi tải font — tiếp tục PDF */
  }
  await waitDoubleRaf(win);
}

function waitDoubleRaf(win: Window): Promise<void> {
  return new Promise((resolve) => {
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()));
  });
}

/**
 * Sinh và tải file PDF (một cửa sổ ẩn, không có UI loading).
 * Cùng chuỗi HTML như cửa sổ «In», kèm class `payroll-pdf-capture` (CSS trong payroll-slip-html).
 */
export async function downloadPayrollPdfFromHtml(fullHtml: string, filename: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const safeName = sanitizePayrollPdfDownloadName(filename.trim() || "Phieu_luong.pdf");

  const origin = typeof window.location?.origin === "string" ? window.location.origin : "";
  const htmlToWrite = origin ? injectPayrollPdfBaseHref(fullHtml, origin) : fullHtml;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Khung render PDF phiếu lương");
  iframe.style.cssText = HIDDEN_IFRAME_STYLE;
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentDocument;
    const iwin = iframe.contentWindow;
    if (!idoc || !iwin) throw new Error("Không truy cập được nội dung iframe (PDF).");

    idoc.open();
    idoc.write(htmlToWrite);
    idoc.close();

    await waitIframeLoaded(idoc, iwin, 1200);
    await new Promise((r) => setTimeout(r, 80));

    await waitForImagesInDocument(idoc);

    idoc.documentElement.classList.add("payroll-pdf-capture");

    await waitForFontsAndPaint(idoc, iwin);
    await new Promise((r) => setTimeout(r, EXTRA_LAYOUT_SETTLE_MS));

    const root = idoc.querySelector(".payroll-slip-batch-root") as HTMLElement | null;
    if (!root || !root.innerHTML.trim()) throw new Error("Thiếu nội dung phiếu lương (.payroll-slip-batch-root).");

    /**
     * html2pdf.js clone node và đưa vào `document.body` của cửa sổ gọi `.from()` —
     * không copy `<style>` từ iframe, nên phải gắn CSS vào `<head>` trang chính trong lúc tạo PDF.
     */
    const mountStyle = attachPayrollHtml2PdfStylesToMainDocument();

    try {
      const html2pdf = await resolveHtml2Pdf();
      await html2pdf()
        .set(buildPayrollHtml2PdfOptions(safeName))
        .from(root)
        .save();
    } finally {
      detachPayrollHtml2PdfStyles(mountStyle);
    }
  } finally {
    detachIframeSafe(iframe);
  }
}

/**
 * Một phiếu: **cùng chuỗi HTML** với xem trước (`iframe`), In và CSS trong `payroll-slip-html.ts`
 * (`<style>` + `docShell` → `downloadPayrollPdfFromHtml`).
 */
export async function downloadPayrollSlipPdfFromTemplate(
  row: PayrollSlipRow,
  opts: PayrollSlipOptions,
  filename: string,
): Promise<void> {
  return downloadPayrollPdfFromHtml(buildPayrollSlipHtml(row, opts), filename);
}

/**
 * Nhiều phiếu trong một file PDF — **cùng HTML** như `buildPayrollBatchPrintHtml` (In hàng loạt / In chung).
 */
export async function downloadPayrollBatchSlipPdfFromTemplate(
  rows: PayrollSlipRow[],
  opts: PayrollSlipOptions,
  filename: string,
): Promise<void> {
  return downloadPayrollPdfFromHtml(buildPayrollBatchPrintHtml(rows, opts), filename);
}
