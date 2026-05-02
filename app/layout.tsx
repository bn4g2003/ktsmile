import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { BRAND_LOGO_PUBLIC_PATH } from "@/lib/brand/logo-public-path";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-vn",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KT Smile Lab",
  description: "Quản lý lab nha khoa",
  icons: {
    icon: "/logobaocao.ico",
    shortcut: "/logobaocao.ico",
    apple: BRAND_LOGO_PUBLIC_PATH,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${beVietnam.variable} min-h-dvh antialiased`}>
      {/* suppressHydrationWarning: tiện ích trình duyệt (vd. Bitwarden) hay chèn attribut vào body → tránh báo hydration lệch */}
      <body className="flex min-h-dvh flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
