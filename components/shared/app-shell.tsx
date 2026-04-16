"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { demoLogout } from "@/lib/actions/demo-auth";
import { DEMO_LOGIN_EMAIL } from "@/lib/auth/demo-session";
import { cn } from "@/lib/utils/cn";
import { AppHeader } from "@/components/shared/app-header";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  NavIconCash,
  NavIconCatalog,
  NavIconChart,
  NavIconDashboard,
  NavIconDebt,
  NavIconOrders,
  NavIconPartners,
  NavIconPriceTag,
  NavIconReview,
  NavIconStock,
  NavIconTeam,
  NavIconWarehouseDoc,
} from "@/components/shared/nav-icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  NAV_PERMISSION_RULES,
  PERMISSION_PRESETS,
  type PermissionPresetId,
} from "@/lib/auth/permission-presets";

type NavIcon = React.ComponentType<{ className?: string }>;
type NavItem = { href: string; label: string; Icon: NavIcon };

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Tổng quan",
    items: [{ href: "/", label: "Dashboard", Icon: NavIconDashboard }],
  },
  {
    title: "Danh mục",
    items: [
      { href: "/master/partners", label: "Khách & NCC", Icon: NavIconPartners },
      { href: "/master/products", label: "SP & NVL", Icon: NavIconCatalog },
      { href: "/master/employees", label: "Nhân sự", Icon: NavIconTeam },
      { href: "/master/prices", label: "Giá theo KH", Icon: NavIconPriceTag },
    ],
  },
  {
    title: "Vận hành",
    items: [
      { href: "/orders", label: "Đơn hàng", Icon: NavIconOrders },
      { href: "/orders/review", label: "Kiểm tra đơn", Icon: NavIconReview },
      { href: "/inventory/documents", label: "Kho — Phiếu", Icon: NavIconWarehouseDoc },
      { href: "/inventory/stock", label: "Tồn kho", Icon: NavIconStock },
    ],
  },
  {
    title: "Kế toán",
    items: [
      { href: "/accounting/sales", label: "Doanh số & GBTT", Icon: NavIconChart },
      { href: "/accounting/cash", label: "Sổ quỹ", Icon: NavIconCash },
      { href: "/accounting/debt", label: "Công nợ", Icon: NavIconDebt },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const [navPermission, setNavPermission] = React.useState<PermissionPresetId>("admin");

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

  React.useEffect(() => {
    const saved = window.localStorage.getItem("ktsmile-nav-permission");
    if (!saved) return;
    if (PERMISSION_PRESETS.some((p) => p.id === saved)) {
      setNavPermission(saved as PermissionPresetId);
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem("ktsmile-nav-permission", navPermission);
  }, [navPermission]);

  const visibleGroups = React.useMemo(() => {
    const allowed = NAV_PERMISSION_RULES[navPermission] ?? [];
    const allowAll = allowed.includes("*");
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => allowAll || allowed.includes(it.href)),
      }))
      .filter((g) => g.items.length > 0);
  }, [navPermission]);

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
          {visibleGroups.map((g) => (
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
                  const Icon = item.Icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-[var(--radius-lg)] px-3 text-sm font-medium transition",
                          active
                            ? "bg-[var(--primary-muted)] font-semibold text-[var(--primary)]"
                            : "text-[var(--on-surface-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--on-surface)]",
                        )}
                      >
                        <Icon className={active ? "opacity-100" : "opacity-70"} />
                        <span className="min-w-0 truncate">{item.label}</span>
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
            <div className="grid gap-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--on-surface-faint)]">
                Quyền điều hướng
              </p>
              <Select
                value={navPermission}
                onChange={(e) => setNavPermission(e.target.value as PermissionPresetId)}
                className="h-9 text-xs"
              >
                {PERMISSION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
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
