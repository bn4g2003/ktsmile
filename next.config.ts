import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["@sparticuz/chromium"],
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/pdf': ['./node_modules/@sparticuz/chromium/bin/**/*'],
  },
};

export default nextConfig;
