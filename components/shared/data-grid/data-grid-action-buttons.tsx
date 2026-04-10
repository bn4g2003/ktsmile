import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const compact =
  "inline-flex h-7 min-h-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] px-2.5 text-[11px] font-semibold leading-none transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

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
