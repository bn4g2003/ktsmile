"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import {
  FDI_LOWER_LEFT,
  FDI_LOWER_RIGHT,
  FDI_UPPER_LEFT,
  FDI_UPPER_RIGHT,
  ALL_FDI_PERMANENT,
  formatTeethSelection,
  parseToothPositionsToSet,
  detectArchConnection,
} from "@/lib/dental/fdi-teeth";

type LabToothPickerProps = {
  id?: string;
  value: string;
  onChange: (toothPositions: string) => void;
  className?: string;
};

function ToothBtn({
  num,
  selected,
  onToggle,
}: {
  num: number;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded text-xs font-semibold tabular-nums transition-all",
        selected
          ? "bg-[var(--primary)] text-white shadow-sm ring-2 ring-[var(--primary)] ring-offset-1"
          : "bg-white text-[var(--on-surface-muted)] ring-1 ring-[var(--border-ghost)] hover:bg-[var(--surface)] hover:text-[var(--on-surface)] hover:ring-[var(--primary)]",
      )}
      aria-pressed={selected}
      title={`Răng ${num}`}
    >
      {num}
    </button>
  );
}

function QuadrantRow({
  teeth,
  set,
  toggle,
  align = "left",
}: {
  teeth: readonly number[];
  set: Set<number>;
  toggle: (n: number) => void;
  align?: "left" | "right";
}) {
  const teethArray = align === "right" ? [...teeth].reverse() : [...teeth];
  return (
    <div className="flex gap-1">
      {teethArray.map((n) => (
        <ToothBtn key={n} num={n} selected={set.has(n)} onToggle={() => toggle(n)} />
      ))}
    </div>
  );
}

export function LabToothPicker({ id, value, onChange, className }: LabToothPickerProps) {
  const set = React.useMemo(() => parseToothPositionsToSet(value), [value]);
  const archConnection = React.useMemo(() => detectArchConnection(set), [set]);

  const toggle = React.useCallback(
    (n: number) => {
      const next = new Set(set);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      onChange(formatTeethSelection(next));
    },
    [set, onChange],
  );

  const clear = React.useCallback(() => onChange(""), [onChange]);

  return (
    <div
      id={id}
      className={cn(
        "space-y-2 rounded-[var(--radius-md)] border border-[var(--border-ghost)] bg-[var(--surface-muted)] p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="mr-1.5 text-xs font-semibold text-[var(--on-surface)]">Chọn răng</p>
          {[
            { label: "Toàn bộ", teeth: ALL_FDI_PERMANENT },
            { label: "Hàm trên", teeth: [...FDI_UPPER_RIGHT, ...FDI_UPPER_LEFT] },
            { label: "Hàm dưới", teeth: [...FDI_LOWER_RIGHT, ...FDI_LOWER_LEFT] },
          ].map((cluster) => (
            <button
              key={cluster.label}
              type="button"
              onClick={() => {
                const next = new Set(set);
                cluster.teeth.forEach((t: number) => next.add(t));
                onChange(formatTeethSelection(next));
              }}
              className="rounded bg-white px-2 py-1 text-[10px] font-medium text-[var(--on-surface-muted)] ring-1 ring-[var(--border-ghost)] transition hover:bg-[var(--surface)] hover:text-[var(--primary)] hover:ring-[var(--primary)]"
            >
              {cluster.label}
            </button>
          ))}
          <div className="mx-1 h-3 w-px bg-[var(--border-ghost)]" />
          {[
            { label: "Cung 1", teeth: FDI_UPPER_RIGHT },
            { label: "Cung 2", teeth: FDI_UPPER_LEFT },
            { label: "Cung 3", teeth: FDI_LOWER_LEFT },
            { label: "Cung 4", teeth: FDI_LOWER_RIGHT },
          ].map((cluster) => (
            <button
              key={cluster.label}
              type="button"
              onClick={() => {
                const next = new Set(set);
                cluster.teeth.forEach((t: number) => next.add(t));
                onChange(formatTeethSelection(next));
              }}
              className="rounded bg-white px-2 py-1 text-[10px] font-medium text-[var(--on-surface-muted)] ring-1 ring-[var(--border-ghost)] transition hover:bg-[var(--surface)] hover:text-[var(--primary)] hover:ring-[var(--primary)]"
            >
              Q{cluster.label.at(-1)}
            </button>
          ))}
        </div>
        {set.size > 0 && (
          <button
            type="button"
            className="rounded bg-[var(--primary-muted)] px-2.5 py-1 text-[10px] font-bold text-[var(--primary)] transition hover:bg-[var(--primary)] hover:text-white"
            onClick={clear}
          >
            Xóa ({set.size})
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {value.trim() && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-[var(--primary)] px-2 py-0.5 text-[10px] font-semibold text-white">
              {value}
            </span>
            {set.size > 0 && archConnection === "bridge" && (
              <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                CẦU RĂNG (CR)
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-1.5 rounded-[var(--radius-sm)] bg-white p-2.5 shadow-sm">
        {/* Hàm trên */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto">
          <QuadrantRow teeth={FDI_UPPER_RIGHT} set={set} toggle={toggle} align="right" />
          <div className="h-9 w-px shrink-0 bg-[var(--border-ghost)]" />
          <QuadrantRow teeth={FDI_UPPER_LEFT} set={set} toggle={toggle} align="left" />
        </div>
        
        {/* Đường phân cách hàm */}
        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-[var(--border-ghost)]" />
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-faint)]">
            Hàm trên / dưới
          </span>
          <div className="h-px flex-1 bg-[var(--border-ghost)]" />
        </div>
        
        {/* Hàm dưới */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto">
          <QuadrantRow teeth={FDI_LOWER_RIGHT} set={set} toggle={toggle} align="right" />
          <div className="h-9 w-px shrink-0 bg-[var(--border-ghost)]" />
          <QuadrantRow teeth={FDI_LOWER_LEFT} set={set} toggle={toggle} align="left" />
        </div>
      </div>
      
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] text-[var(--on-surface-muted)]">
          Click để chọn/bỏ chọn răng. {archConnection === "bridge" && set.size > 0 ? (
            <strong className="text-amber-600">Phát hiện cầu răng tự động.</strong>
          ) : "Số răng theo chuẩn FDI (11-48)."}
        </p>
      </div>
    </div>
  );
}
