import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "min-h-[var(--touch-min)] w-full cursor-pointer appearance-none rounded-[var(--radius-sm)] bg-[var(--surface-card)] px-3.5 pr-10 text-[var(--on-surface)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]",
        "border border-[var(--border-ghost)] focus:border-[color-mix(in_srgb,var(--primary)_35%,var(--border-ghost))] focus:ring-0",
        "bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235a6274'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
