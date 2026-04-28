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
  NavIconSidebarCollapse,
  NavIconSidebarExpand,
} from "@/components/shared/nav-icons";
import { Button } from "@/components/ui/button";
import {
  NAV_PERMISSION_RULES,
  permissionPresetLabel,
  resolvePermissionPreset,
} from "@/lib/auth/permission-presets";
import { SHELL_NAV_GROUPS_META } from "@/lib/nav/shell-nav-catalog";

type NavIcon = React.ComponentType<{ className?: string }>;
type NavItem = { href: string; label: string; Icon: NavIcon };

const HREF_ICONS: Record<string, NavIcon> = {
  "/": NavIconDashboard,
  "/orders": NavIconOrders,
  "/orders/review": NavIconReview,
  "/master/partners": NavIconPartners,
  "/master/prices": NavIconPriceTag,
  "/master/products": NavIconCatalog,
  "/inventory/stock": NavIconStock,
  "/inventory/documents": NavIconWarehouseDoc,
  "/accounting/sales": NavIconChart,
  "/accounting/cash": NavIconCash,
  "/accounting/debt": NavIconDebt,
  "/accounting/summary": NavIconChart,
  "/master/employees": NavIconTeam,
  "/hr/attendance": NavIconTeam,
  "/hr/payroll": NavIconPayroll,
};

const GROUP_ICONS: Record<string, NavIcon> = {
  "TỔNG QUAN": NavIconDashboard,
  "KINH DOANH": NavIconOrders,
  "KHO HÀNG": NavIconStock,
  "TÀI CHÍNH": NavIconChart,
  "NHÂN SỰ": NavIconTeam,
};

const groups: { title: string; Icon: NavIcon; items: NavItem[] }[] = SHELL_NAV_GROUPS_META.map((g) => ({
  title: g.title,
  Icon: GROUP_ICONS[g.title] ?? NavIconDashboard,
  items: g.items.map((it) => ({
    href: it.href,
    label: it.label,
    Icon: HREF_ICONS[it.href] ?? NavIconDashboard,
  })),
}));

export function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [expandedGroup, setExpandedGroup] = React.useState<string | null>(null);
  const navPermission = resolvePermissionPreset(currentUser.permissions);
  const allowedPathList =
    currentUser.nav_allowed_paths ??
    (NAV_PERMISSION_RULES[navPermission] ?? []);

  // Initialize sidebar state from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setSidebarCollapsed(true);
  }, []);

  const toggleSidebar = () => {
    const newVal = !sidebarCollapsed;
    setSidebarCollapsed(newVal);
    localStorage.setItem("sidebar-collapsed", String(newVal));
  };

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
    const allowAll = allowedPathList.includes("*");
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => allowAll || allowedPathList.includes(it.href)),
      }))
      .filter((g) => g.items.length > 0);
  }, [allowedPathList]);
  const visibleItems = React.useMemo(
    () => visibleGroups.flatMap((g) => g.items),
    [visibleGroups],
  );

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
          "fixed inset-y-0 left-0 z-50 mt-16 flex flex-col border-r border-slate-200 bg-slate-50 shadow-sm transition-all duration-300 ease-in-out",
          navOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
          sidebarCollapsed ? "md:w-[88px]" : "md:w-64 w-64 max-w-[85vw]",
        )}
        aria-label="Điều hướng chính"
      >
        <div className={cn("px-6 py-6", sidebarCollapsed && "px-3")}>
          <Link href="/" className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}>
            <BrandLogo size={40} className="rounded-lg ring-1 ring-slate-200" />
            {!sidebarCollapsed && (
              <div>
                <h2 className="text-2xl font-bold leading-none tracking-tight text-[#0f4c81]">
                  <span className="text-[#0f4c81]">KT</span> <span className="text-[#1f2937]">Smile Lab</span>
                </h2>
                <p className="mt-1 text-[10px] text-slate-500">Hệ thống quản lý vận hành</p>
              </div>
            )}
          </Link>
        </div>
        <nav className={cn("flex flex-1 flex-col gap-1 overflow-y-auto px-4 pb-6 transition-all duration-300", sidebarCollapsed ? "pt-2" : "pt-0")}>
          {visibleItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all",
                  active
                    ? "bg-white font-bold text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  sidebarCollapsed && "justify-center px-0",
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span className="min-w-0 truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="space-y-1">
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900",
                sidebarCollapsed && "justify-center px-0",
              )}
              title="Cài đặt"
              type="button"
            >
              <NavIconChart className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && <span>Cài đặt</span>}
            </button>
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-auto w-full justify-start gap-3 rounded-lg px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700",
                  sidebarCollapsed && "justify-center px-0",
                )}
              >
                <NavIconSidebarExpand className="h-5 w-5" />
                {!sidebarCollapsed && <span>Đăng xuất</span>}
              </Button>
            </form>
          </div>
          <button
            onClick={toggleSidebar}
            className="mt-4 hidden h-10 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:flex"
            title={sidebarCollapsed ? "Mở rộng" : "Thu gọn"}
          >
            {sidebarCollapsed ? (
              <NavIconSidebarExpand className="h-5 w-5" />
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium">
                <NavIconSidebarCollapse className="h-4 w-4" />
                <span>Thu gọn</span>
              </div>
            )}
          </button>
        </div>
      </aside>

      <div className={cn(
        "flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out pl-0",
        sidebarCollapsed ? "md:pl-[88px]" : "md:pl-64"
      )}>
        <AppHeader onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
          <div className="mx-auto max-w-[min(100%,112rem)]">{children}</div>
        </main>
      </div>
    </div>
  );
}
