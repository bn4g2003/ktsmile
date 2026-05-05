import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium"],
  /**
   * Không dùng `output: "standalone"` mặc định: nhiều môi trường Hostinger/VPS chỉ chạy
   * `npm run build` + `npm run start` với cả `.next` + `node_modules`. Standalone bắt buộc
   * copy `public` + `.next/static` vào thư mục standalone — sai bước dễ 503.
   * (Docker / image tối giản: bật lại standalone + quy trình copy trong Dockerfile.)
   */
  outputFileTracingIncludes: {
    "/api/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
