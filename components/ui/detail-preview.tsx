import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type DetailPreviewField = {
  label: string;
  value: React.ReactNode;
  /** Chiếm cả hàng trên màn hình ≥ sm (textarea, ghi chú dài) */
  span?: "full";
};

export function DetailPreview({ fields }: { fields: DetailPreviewField[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {fields.map((f, i) => (
        <div
          key={i}
          className={cn("space-y-1", f.span === "full" && "sm:col-span-2")}
        >
          <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--on-surface-muted)]">
            {f.label}
          </dt>
          <dd className="text-sm leading-relaxed text-[var(--on-surface)] break-words">
            {f.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
