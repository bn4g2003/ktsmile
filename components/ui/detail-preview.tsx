import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type DetailPreviewField = {
  label: string;
  value: React.ReactNode;
  /** Occupies the full row on sm screens and larger */
  span?: "full";
  /** Optional icon to display next to the label */
  icon?: React.ReactNode;
};

export type DetailPreviewGroup = {
  title: string;
  fields: DetailPreviewField[];
};

export function DetailPreview({ 
  fields, 
  groups 
}: { 
  fields?: DetailPreviewField[];
  groups?: DetailPreviewGroup[];
}) {
  const renderFields = (items: DetailPreviewField[]) => (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:[grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
      {items.map((f, i) => (
        <div
          key={i}
          className={cn("flex flex-col gap-0.5", f.span === "full" && "col-span-full")}
        >
          <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-faint)]">
            {f.icon && <span className="opacity-70">{f.icon}</span>}
            {f.label}
          </dt>
          <dd className="min-h-[1.25rem] text-[15px] font-bold leading-tight text-[var(--on-surface)] break-words">
            {f.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );

  if (groups) {
    return (
      <div className="space-y-5 py-0">
        {groups.map((g, gi) => (
          <div key={gi} className="space-y-2.5">
            <h3 className="text-[12px] font-bold tracking-wide text-[var(--on-surface-muted)] border-b border-[var(--border-ghost)] pb-1">
              {g.title}
            </h3>
            {renderFields(g.fields)}
          </div>
        ))}
      </div>
    );
  }

  return fields ? renderFields(fields) : null;
}
