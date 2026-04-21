"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { logout } from "@/lib/actions/auth";
import type { CurrentUser } from "@/lib/auth/current-user";
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
  NavIconPayroll,
  NavIconReview,
  NavIconStock,
  NavIconTeam,
  NavIconWarehouseDoc,
  NavIconChevronDown,
} from "@/components/shared/nav-icons";
import { Button } from "@/components/ui/button";
import {
  NAV_PERMISSION_RULES,
  permissionPresetLabel,
  resolvePermissionPreset,
} from "@/lib/auth/permission-presets";

type NavIcon = React.ComponentType<{ className?: string }>;
type NavItem = { href: string; label: string; Icon: NavIcon };

const groups: { title: string; Icon: NavIcon; items: NavItem[] }[] = [
  {
    title: "TỔNG QUAN",
    Icon: NavIconDashboard,
    items: [{ href: "/", label: "Dashboard", Icon: NavIconDashboard }],
  },
  {
    title: "KINH DOANH",
    Icon: NavIconOrders,
    items: [
      { href: "/orders", label: "Đơn hàng", Icon: NavIconOrders },
      { href: "/orders/review", label: "Kiểm tra đơn", Icon: NavIconReview },
      { href: "/master/partners", label: "Khách & NCC", Icon: NavIconPartners },
      { href: "/master/prices", label: "Giá theo KH", Icon: NavIconPriceTag },
    ],
  },
  {
    title: "KHO HÀNG",
    Icon: NavIconStock,
    items: [
      { href: "/master/products", label: "Sản phẩm & NVL", Icon: NavIconCatalog },
      { href: "/inventory/stock", label: "Tồn kho", Icon: NavIconStock },
      { href: "/inventory/documents", label: "Phiếu nhập xuất", Icon: NavIconWarehouseDoc },
    ],
  },
  {
    title: "TÀI CHÍNH",
    Icon: NavIconChart,
    items: [
      { href: "/accounting/cash", label: "Sổ quỹ", Icon: NavIconCash },
      { href: "/accounting/debt", label: "Công nợ khách hàng", Icon: NavIconDebt },
    ],
  },
  {
    title: "NHÂN SỰ",
    Icon: NavIconTeam,
    items: [
      { href: "/master/employees", label: "Hồ sơ nhân sự", Icon: NavIconTeam },
      { href: "/hr/attendance", label: "Chấm công", Icon: NavIconTeam },
      { href: "/hr/payroll", label: "Tính lương", Icon: NavIconPayroll },
    ],
  },
];

export function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const [expandedGroup, setExpandedGroup] = React.useState<string | null>(null);
  const navPermission = resolvePermissionPreset(currentUser.permissions);

  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Auto-expand the group containing the current pathname
  React.useEffect(() => {
    const activeGroup = groups.find((g) =>
      g.items.some((item) =>
        item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(item.href + "/"),
      ),
    );
    if (activeGroup) {
      setExpandedGroup(activeGroup.title);
    }
  }, [pathname]);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

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
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-[var(--surface-sidebar)] shadow-[var(--shadow-sidebar)] transition-transform duration-200 ease-out",
          navOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        )}
        aria-label="Điều hướng chính"
      >
        <div className="border-b border-[var(--border-ghost)] px-5 py-6">
          <Link href="/" className="flex items-center gap-3.5">
            <BrandLogo size={52} priority />
            <div className="min-w-0">
              <span className="text-xl font-bold tracking-tight text-[var(--primary)] uppercase">KT Smile Lab</span>
              <span className="mt-0.5 block text-xs font-semibold text-[var(--on-surface-muted)]">
                Hệ điều hành lab
              </span>
            </div>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
          {visibleGroups.map((g) => {
            const isExpanded = expandedGroup === g.title;
            const GroupIcon = g.Icon;
            return (
              <div key={g.title} className="flex flex-col">
                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : g.title)}
                  className={cn(
                    "flex min-h-[44px] w-full items-center gap-2.5 rounded-[var(--radius-lg)] px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-all",
                    isExpanded
                      ? "bg-[var(--surface-muted)] text-[var(--primary)]"
                      : "text-[var(--on-surface-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--on-surface)]",
                  )}
                >
                  <GroupIcon className={cn("h-5 w-5 shrink-0", isExpanded ? "opacity-100" : "opacity-70")} />
                  <span className="flex-1 text-left">{g.title}</span>
                  <NavIconChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      isExpanded ? "rotate-0" : "-rotate-90",
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-in-out",
                    isExpanded ? "grid-rows-[1fr] py-1" : "grid-rows-[0fr]",
                  )}
                >
                  <ul className="flex flex-col gap-0.5 overflow-hidden pl-7">
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
              </div>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border-ghost)] p-4">
          <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-muted)] text-sm font-bold text-[var(--primary)]">
                {currentUser.full_name.trim().charAt(0).toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--on-surface)]">{currentUser.full_name}</p>
                <p className="truncate text-xs text-[var(--on-surface-muted)]">
                  {currentUser.email ?? currentUser.code}
                </p>
                <p className="truncate text-[11px] text-[var(--on-surface-faint)]">
                  {permissionPresetLabel(currentUser.permissions)}
                </p>
              </div>
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm" className="h-8 w-full text-xs">
                Đăng xuất
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-0 md:pl-[280px]">
        <AppHeader onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
          <div className="mx-auto max-w-[min(100%,112rem)]">{children}</div>
        </main>
      </div>
    </div>
  );
}
