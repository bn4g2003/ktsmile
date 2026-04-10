import * as React from "react";
import { cn } from "@/lib/utils/cn";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  className?: string;
  accent?: "default" | "purple";
};

export function StatCard({
  label,
  value,
  hint,
  className,
  accent = "default",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] p-5 shadow-[var(--shadow-card)]",
        accent === "purple"
          ? "bg-gradient-to-br from-[var(--accent-purple)] to-[color-mix(in_srgb,var(--accent-purple)_85%,#312e81)] text-white"
          : "bg-[var(--surface-card)] text-[var(--on-surface)]",
        className,
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.08em]",
          accent === "purple" ? "text-white/80" : "text-[var(--on-surface-muted)]",
        )}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      {hint ? (
        <p
          className={cn(
            "mt-1 text-sm",
            accent === "purple" ? "text-white/75" : "text-[var(--on-surface-muted)]",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
