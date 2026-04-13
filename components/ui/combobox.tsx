"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Input } from "./input";

export type ComboboxProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function Combobox({ options, value, onChange, placeholder, className }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState(value);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setSearch(value);
  }, [value]);

  const filtered = React.useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return options;
    return options.filter((o) => o.toLowerCase().includes(s));
  }, [options, search]);

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [search]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        const selected = filtered[activeIndex]!;
        onChange(selected);
        setSearch(selected);
        setOpen(false);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onSelect = (val: string) => {
    onChange(val);
    setSearch(val);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg
            className="h-3.5 w-3.5 text-[var(--on-surface-faint)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-10"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className={cn("h-4 w-4 text-[var(--on-surface-faint)] transition-transform", open && "rotate-180")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {open && (
        <div 
          ref={listRef}
          className="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--border-ghost)] bg-white p-1 shadow-[var(--shadow-float)] outline-none"
        >
          {filtered.length > 0 ? (
            filtered.map((opt, idx) => (
              <div
                key={opt}
                className={cn(
                  "flex min-h-[var(--touch-min)] cursor-pointer items-center rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors",
                  idx === activeIndex
                    ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--on-surface)]"
                    : opt === value
                    ? "bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] font-semibold text-[var(--primary)]"
                    : "text-[var(--on-surface)] hover:bg-[var(--surface-muted)]",
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onSelect(opt)}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="px-3 py-4 text-center">
               <p className="text-sm text-[var(--on-surface-muted)]">Không tìm thấy "{search}"</p>
               <p className="mt-1 text-xs text-[var(--on-surface-faint)]">Nhấn Enter để dùng giá trị này</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
