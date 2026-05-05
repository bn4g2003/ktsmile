/**
 * Khai báo tối thiểu cho import động trong `app/api/pdf/route.ts`.
 * Giải quyết TS2307 khi IDE/tsconfig không resolve được typings từ package
 * hoặc khi `node_modules` chưa cài đầy trong môi trường phân tích.
 */
declare module "@sparticuz/chromium" {
  const chromium: {
    executablePath(): Promise<string>;
    args: string[];
  };
  export default chromium;
}

declare module "puppeteer-core" {
  interface PdfPage {
    setViewport(options: Record<string, unknown>): Promise<void>;
    setContent(html: string, options?: Record<string, unknown>): Promise<void>;
    pdf(options?: Record<string, unknown>): Promise<Uint8Array>;
  }
  interface PdfBrowser {
    newPage(): Promise<PdfPage>;
    close(): Promise<void>;
  }
  const puppeteer: {
    launch(options: Record<string, unknown>): Promise<PdfBrowser>;
  };
  export default puppeteer;
}
