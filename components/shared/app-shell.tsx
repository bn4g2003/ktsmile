"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { demoLogout } from "@/lib/actions/demo-auth";
import { DEMO_LOGIN_EMAIL } from "@/lib/auth/demo-session";
import { cn } from "@/lib/utils/cn";
import { AppHeader } from "@/components/shared/app-header";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";

const groups: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Tổng quan",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Danh mục",
    items: [
      { href: "/master/partners", label: "Khách & NCC" },
      { href: "/master/products", label: "SP & NVL" },
      { href: "/master/employees", label: "Nhân sự" },
      { href: "/master/prices", label: "Giá theo KH" },
    ],
  },
  {
    title: "Vận hành",
    items: [
      { href: "/orders", label: "Đơn hàng" },
      { href: "/orders/review", label: "Kiểm tra đơn" },
      { href: "/inventory/documents", label: "Kho — Phiếu" },
      { href: "/inventory/stock", label: "Tồn kho" },
    ],
  },
  {
    title: "Kế toán",
    items: [
      { href: "/accounting/sales", label: "Doanh số & GBTT" },
      { href: "/accounting/cash", label: "Sổ quỹ" },
      { href: "/accounting/debt", label: "Công nợ" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);

  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className="min-h-screen">
      <div
        role="presentation"
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setNavOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(100%,260px)] max-w-[85vw] flex-col bg-[var(--surface-sidebar)] shadow-[var(--shadow-sidebar)] transition-transform duration-200 ease-out",
          navOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        )}
        aria-label="Điều hướng chính"
      >
        <div className="border-b border-[var(--border-ghost)] px-5 py-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo size={44} priority />
            <div className="min-w-0">
              <span className="text-lg font-bold tracking-tight text-[var(--primary)]">KT Smile Lab</span>
              <span className="mt-0.5 block text-xs font-medium text-[var(--on-surface-muted)]">
                Hệ điều hành lab
              </span>
            </div>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--on-surface-faint)]">
                {g.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex min-h-11 items-center rounded-[var(--radius-lg)] px-3 text-sm font-medium transition",
                          active
                            ? "bg-[var(--primary-muted)] font-semibold text-[var(--primary)]"
                            : "text-[var(--on-surface-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--on-surface)]",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--border-ghost)] p-4">
          <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-muted)] text-sm font-bold text-[var(--primary)]">
                U
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--on-surface)]">updev</p>
                <p className="truncate text-xs text-[var(--on-surface-muted)]">{DEMO_LOGIN_EMAIL}</p>
              </div>
            </div>
            <form action={demoLogout}>
              <Button type="submit" variant="ghost" size="sm" className="h-8 w-full text-xs">
                Đăng xuất
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-0 md:pl-[260px]">
        <AppHeader onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
          <div className="mx-auto max-w-[min(100%,112rem)]">{children}</div>
        </main>
      </div>
    </div>
  );
}
