"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import {
  FDI_LOWER_LEFT,
  FDI_LOWER_RIGHT,
  FDI_UPPER_LEFT,
  FDI_UPPER_RIGHT,
  formatTeethSelection,
  parseToothPositionsToSet,
} from "@/lib/dental/fdi-teeth";

type LabToothPickerProps = {
  id?: string;
  value: string;
  onChange: (toothPositions: string) => void;
  className?: string;
};

function ToothGlyph({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-3 w-3", selected ? "text-white" : "text-[var(--on-surface-muted)]")}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 3c-1.9 0-3.7.4-5 1.1-1.5.9-2.4 2.3-2.6 4-.3 2.2.5 4.4 1.4 6.4l.2.5c1.3 2.9 2 5 2.4 6.1.4 1.1 1.1 1.9 2.2 1.9 1.2 0 1.6-1 2-2.7.1-.4.2-.9.3-1.4.1.5.2 1 .3 1.4.4 1.7.8 2.7 2 2.7 1.1 0 1.8-.8 2.2-1.9.4-1.1 1.1-3.2 2.4-6.1l.2-.5c.9-2 1.7-4.2 1.4-6.4-.2-1.7-1.1-3.1-2.6-4-1.3-.7-3.1-1.1-5-1.1z" />
    </svg>
  );
}

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
        "flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded text-[9px] font-semibold tabular-nums transition-colors",
        selected
          ? "bg-[color-mix(in_srgb,var(--primary)_85%,white)] text-white ring-1 ring-[var(--primary)]"
          : "bg-[var(--surface-card)] text-[var(--on-surface)] ring-1 ring-[var(--border-ghost)] hover:bg-[var(--surface)]",
      )}
      aria-pressed={selected}
    >
      <ToothGlyph selected={selected} />
      <span>{num}</span>
    </button>
  );
}

function ArchRow({
  label,
  teeth,
  set,
  toggle,
}: {
  label: string;
  teeth: readonly number[];
  set: Set<number>;
  toggle: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">{label}</p>
      <div className="flex flex-wrap justify-center gap-1">
        {teeth.map((n) => (
          <ToothBtn key={n} num={n} selected={set.has(n)} onToggle={() => toggle(n)} />
        ))}
      </div>
    </div>
  );
}

export function LabToothPicker({ id, value, onChange, className }: LabToothPickerProps) {
  const set = React.useMemo(() => parseToothPositionsToSet(value), [value]);

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
        "space-y-3 rounded-[var(--radius-md)] border border-[var(--border-ghost)] bg-[var(--surface-muted)] p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--on-surface)]">Sơ đồ răng (FDI)</p>
        <button
          type="button"
          className="text-xs font-medium text-[var(--primary)] underline-offset-2 hover:underline"
          onClick={clear}
        >
          Xóa chọn
        </button>
      </div>
      <div className="space-y-2 rounded-[var(--radius-sm)] bg-white p-2 ring-1 ring-[var(--border-ghost)]">
        <ArchRow label="Hàm trên · Phải → Trái" teeth={FDI_UPPER_RIGHT} set={set} toggle={toggle} />
        <ArchRow label="Hàm trên · Trái" teeth={FDI_UPPER_LEFT} set={set} toggle={toggle} />
        <div className="border-t border-[var(--border-ghost)] pt-2" />
        <ArchRow label="Hàm dưới · Trái" teeth={FDI_LOWER_LEFT} set={set} toggle={toggle} />
        <ArchRow label="Hàm dưới · Phải" teeth={FDI_LOWER_RIGHT} set={set} toggle={toggle} />
      </div>
      <p className="text-[11px] text-[var(--on-surface-muted)]">
        Chọn bằng hình răng + số FDI. Đang chọn:{" "}
        <strong className="text-[var(--on-surface)]">{value.trim() ? value : "—"}</strong> (đồng bộ ô «Vị trí răng»)
      </p>
    </div>
  );
}
