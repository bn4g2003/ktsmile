/** Kiểu tối thiểu cho chuỗi `.set().from().save()` của html2pdf.js (bundle không kèm typings). */
declare module "html2pdf.js" {
  export interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement): Html2PdfWorker;
    /** Trả Promise ở bản ≥0.9 khi không truyền callback. */
    save(): Promise<void>;
  }

  export type Html2PdfOptions = Record<string, unknown>;

  export default function html2pdf(): Html2PdfWorker;
}
