import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Nhỏ gọn — toolbar lưới, hàng phụ */
  size?: "default" | "sm";
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "default",
      type = "button",
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
          size === "default" &&
            "min-h-[var(--touch-min)] gap-2 px-5 text-sm",
          size === "sm" && "min-h-8 gap-1.5 px-3 text-xs",
          variant === "primary" &&
            cn(
              "rounded-[var(--radius-pill)] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
              size === "default" &&
                "shadow-[0_4px_14px_color-mix(in_srgb,var(--primary)_35%,transparent)]",
              size === "sm" &&
                "shadow-[0_2px_8px_color-mix(in_srgb,var(--primary)_28%,transparent)]",
            ),
          variant === "secondary" &&
            "rounded-[var(--radius-pill)] bg-[var(--surface-card)] text-[var(--on-surface)] shadow-[var(--shadow-card)] ring-1 ring-[var(--border-ghost)] hover:bg-[var(--surface-muted)]",
          variant === "ghost" &&
            "rounded-[var(--radius-pill)] bg-transparent text-[var(--on-surface-muted)] hover:bg-[color-mix(in_srgb,var(--on-surface)_6%,transparent)] hover:text-[var(--on-surface)]",
          variant === "danger" &&
            "rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,#ef4444_12%,#fff)] text-[#b91c1c] ring-1 ring-[color-mix(in_srgb,#ef4444_20%,transparent)] hover:bg-[color-mix(in_srgb,#ef4444_18%,#fff)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
