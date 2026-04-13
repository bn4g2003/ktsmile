"use client";

import Link from "next/link";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

const compact =
  "inline-flex h-7 min-h-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] px-2.5 text-[11px] font-semibold leading-none transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

/** Gắn vào nút in khi đặt trong `DropdownMenuItem asChild`. */
export const dataGridPrintMenuItemButtonClassName =
  "h-auto min-h-[var(--touch-min)] w-full justify-start rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm font-normal shadow-none ring-0 hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]";

/** Xem — xanh navy (primary), nền nhạt */
export function DataGridViewButton({
  className,
  children = "Xem",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        compact,
        "bg-[color-mix(in_srgb,var(--primary)_12%,#fff)] text-[var(--primary)] shadow-none ring-1 ring-[color-mix(in_srgb,var(--primary)_26%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_20%,#fff)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Sửa — amber, tách biệt với primary */
export function DataGridEditButton({
  className,
  children = "Sửa",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) {
  return (
    <button
      type={type}
      className={cn(
        compact,
        "bg-[color-mix(in_srgb,#d97706_10%,#fff)] text-[#9a3412] ring-1 ring-[color-mix(in_srgb,#d97706_24%,transparent)] hover:bg-[color-mix(in_srgb,#d97706_16%,#fff)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Điều hướng phụ (vd. Dòng SP) — trung tính */
export function DataGridAuxLink({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        compact,
        "bg-[var(--surface-card)] text-[var(--on-surface-muted)] ring-1 ring-[var(--border-ghost)] hover:bg-[var(--surface-muted)] hover:text-[var(--on-surface)]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/** Xóa — đỏ */
export function DataGridDeleteButton({
  className,
  children = "Xóa",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) {
  return (
    <button
      type={type}
      className={cn(
        compact,
        "bg-[color-mix(in_srgb,#ef4444_10%,#fff)] text-[#b91c1c] ring-1 ring-[color-mix(in_srgb,#ef4444_22%,transparent)] hover:bg-[color-mix(in_srgb,#ef4444_16%,#fff)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Hàng nút thao tác: căn đều, không tràn */
export function DataGridActionGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-1.5 sm:justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Nút ⋯ mở menu: dùng chung cho cột thao tác (nội dung menu là children). */
export function DataGridRowActionsMenu({
  className,
  align = "end",
  children,
}: {
  className?: string;
  align?: "start" | "end" | "center";
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            compact,
            "bg-[var(--surface-card)] text-[var(--on-surface-muted)] ring-1 ring-[var(--border-ghost)] hover:bg-[var(--surface-muted)] hover:text-[var(--on-surface)]",
            className,
          )}
          aria-label="Mở menu thao tác"
        >
          ⋯
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[11rem]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DataGridMenuViewItem({
  className,
  children = "Xem",
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn("font-medium text-[var(--primary)]", className)}
      {...props}
    >
      {children}
    </DropdownMenuItem>
  );
}

export function DataGridMenuEditItem({
  className,
  children = "Sửa",
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn("font-medium text-[#9a3412]", className)}
      {...props}
    >
      {children}
    </DropdownMenuItem>
  );
}

export function DataGridMenuDeleteItem({
  className,
  children = "Xóa",
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn("font-medium text-[#b91c1c]", className)}
      {...props}
    >
      {children}
    </DropdownMenuItem>
  );
}

/** Mục điều hướng trong menu (vd. Dòng SP). */
export function DataGridMenuLinkItem({
  href,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <DropdownMenuItem asChild>
      <Link
        href={href}
        className={cn(
          "cursor-pointer font-medium text-[var(--on-surface-muted)] no-underline data-[highlighted]:text-[var(--on-surface)]",
          className,
        )}
        {...props}
      >
        {children}
      </Link>
    </DropdownMenuItem>
  );
}
