"use client";

import { cn } from "@/lib/utils/cn";

export type DetailTabItem = { id: string; label: string };

export function DetailTabStrip({
  items,
  value,
  onChange,
  className,
}: {
  items: DetailTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  if (items.length <= 1) return null;
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "flex flex-wrap gap-0.5 border-b border-[var(--border-ghost)]",
        className,
      )}
    >
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "-mb-px rounded-t-[var(--radius-md)] px-3 py-2 text-sm font-semibold transition",
              active
                ? "border border-b-0 border-[var(--border-ghost)] bg-[var(--surface-card)] text-[var(--on-surface)] shadow-[inset_0_-2px_0_0_var(--primary)]"
                : "border border-transparent text-[var(--on-surface-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--on-surface)]",
            )}
            onClick={() => onChange(it.id)}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
