import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "search";
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", variant = "default", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "min-h-[var(--touch-min)] w-full text-[var(--on-surface)] placeholder:text-[var(--on-surface-faint)] focus:ring-0",
        variant === "search" &&
          "rounded-[var(--radius-pill)] border-0 bg-[var(--surface-muted)] px-4 py-2.5 shadow-none ring-0 focus:bg-white focus:shadow-[var(--shadow-card)]",
        variant === "default" &&
          "rounded-[var(--radius-md)] border border-[var(--border-ghost)] bg-white px-3.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] focus:border-[color-mix(in_srgb,var(--primary)_35%,var(--border-ghost))]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
