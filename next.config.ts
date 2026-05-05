import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium"],
  /**
   * Không bật `output: "standalone"` mặc định (Hostinger/VPS: `next build` + `node server.js`;
   * standalone cần copy `public` + `.next/static` đúng quy trình — dễ 503 nếu thiếu bước).
   * Gói Chromium cho `/api/pdf` chỉ nhét thêm vào trace khi build trên Vercel (có VERCEL=1).
   */
  ...(process.env.VERCEL
    ? {
        outputFileTracingIncludes: {
          "/api/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
        },
      }
    : {}),
};

export default nextConfig;
