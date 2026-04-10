import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[5.5rem] w-full resize-y rounded-[var(--radius-sm)] bg-[var(--surface-card)] px-3.5 py-2.5 text-[var(--on-surface)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-[var(--on-surface-faint)]",
      "border border-[var(--border-ghost)] focus:border-[color-mix(in_srgb,var(--primary)_35%,var(--border-ghost))] focus:ring-0",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
