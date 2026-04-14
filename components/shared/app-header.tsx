"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/** Nhãn cho đường dẫn đầy đủ (trang cụ thể). */
const ROUTE_LABELS: Record<string, string> = {
  "/master/partners": "Đối tác",
  "/master/products": "SP & NVL",
  "/master/employees": "Nhân sự",
  "/master/prices": "Giá theo KH",
  "/orders": "Đơn hàng",
  "/orders/review": "Kiểm tra đơn",
  "/inventory/documents": "Kho — Phiếu",
  "/inventory/stock": "Tồn kho",
  "/accounting/sales": "Doanh số & GBTT",
  "/accounting/cash": "Sổ quỹ",
  "/accounting/debt": "Công nợ",
};

/** Nhãn phân nhóm cho phần đầu path (khi chưa có ROUTE_LABELS khớp). */
const PARENT_SEGMENT_LABELS: Record<string, string> = {
  master: "Danh mục",
  inventory: "Kho",
  accounting: "Kế toán",
  orders: "Đơn hàng",
};

function breadcrumbsForPath(pathname: string): { href: string; label: string }[] {
  const normalized = pathname.split("?")[0] || "/";
  const crumbs: { href: string; label: string }[] = [{ href: "/", label: "Tổng quan" }];
  if (normalized === "/") return crumbs;

  const parts = normalized.split("/").filter(Boolean);
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc += "/" + parts[i];
    const seg = parts[i];
    let label: string;
    if (ROUTE_LABELS[acc]) {
      label = ROUTE_LABELS[acc];
    } else if (i === parts.length - 1) {
      label = "Chi tiết";
    } else {
      label = PARENT_SEGMENT_LABELS[seg] ?? seg;
    }
    crumbs.push({ href: acc, label });
  }
  return crumbs;
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 shrink-0 text-[var(--on-surface-faint)]", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function AppHeader({ onOpenNav }: { onOpenNav?: () => void }) {
  const pathname = usePathname();
  const crumbs = breadcrumbsForPath(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-[color-mix(in_srgb,var(--surface-canvas)_88%,#fff)] px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-[min(100%,112rem)] items-center gap-3">
        {onOpenNav ? (
          <Button
            variant="ghost"
            type="button"
            className="min-h-11 min-w-11 shrink-0 px-0 md:hidden"
            onClick={onOpenNav}
            aria-label="Mở menu điều hướng"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
        ) : null}

        <nav aria-label="Vị trí trang" className="min-w-0 flex-1">
          <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-0.5 p-0 text-sm">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <li key={c.href} className="flex min-w-0 items-center gap-1">
                  {i > 0 ? <ChevronRight /> : null}
                  {isLast ? (
                    <span
                      className="truncate font-semibold text-[var(--on-surface)]"
                      aria-current="page"
                    >
                      {c.label}
                    </span>
                  ) : (
                    <Link
                      href={c.href}
                      className="truncate text-[var(--on-surface-muted)] transition hover:text-[var(--on-surface)] hover:underline"
                    >
                      {c.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" type="button" className="min-h-11 min-w-11 px-0" aria-label="Thông báo">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </Button>
          <Button variant="secondary" type="button" className="hidden min-h-10 sm:inline-flex" asChild>
            <Link href="/orders">Đơn hàng</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
