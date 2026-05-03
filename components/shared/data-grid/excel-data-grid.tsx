"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type Column,
  type ColumnDef,
  type Row,
  type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import {
  DataGridMenuViewItem,
  DataGridRowActionsMenu,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchListWithCache, invalidateListCache } from "@/lib/cache/grid-data-cache";
import { decodeMultiFilter, encodeMultiFilter } from "@/lib/grid/multi-filter";
import { cn } from "@/lib/utils/cn";

export type ListSummaryLine = { label: string; value: string | number };

function dataGridColumnLabel<T>(col: Column<T, unknown>): string {
  const h = col.columnDef.header;
  if (typeof h === "string") return h;
  return String(col.id);
}

export type ListArgs = {
  page: number;
  pageSize: number;
  globalSearch: string;
  filters: Record<string, string>;
};

export type ListResult<T> = { rows: T[]; total: number; summary?: ListSummaryLine[] };

function formatSummaryValue(v: string | number): string {
  if (typeof v === "number" && Number.isFinite(v)) return v.toLocaleString("vi-VN");
  return String(v);
}

function GridMultiSelectFilter({
  filterKey,
  options,
  valueRaw,
  onCommit,
  triggerId,
  renderOption,
}: {
  filterKey: string;
  options: { value: string; label: string }[];
  valueRaw: string;
  onCommit: (key: string, encoded: string) => void;
  triggerId: string;
  renderOption?: (option: { value: string; label: string }) => React.ReactNode;
}) {
  const selected = React.useMemo(() => new Set(decodeMultiFilter(valueRaw)), [valueRaw]);
  const toggle = (val: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(val);
    else next.delete(val);
    onCommit(filterKey, encodeMultiFilter([...next]));
  };
  const labelText = React.useMemo(() => {
    if (selected.size === 0) return "Tất cả";
    if (selected.size <= 2) {
      return [...selected]
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    return String(selected.size) + " giá trị";
  }, [selected, options]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={triggerId}
          variant="secondary"
          type="button"
          size="sm"
          className="h-9 min-h-9 w-full max-w-full justify-between gap-1 truncate px-2 text-left text-xs font-normal"
          aria-label={"Lọc " + filterKey}
        >
          <span className="min-w-0 truncate">{labelText}</span>
          <svg
            className="h-3.5 w-3.5 shrink-0 opacity-60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-[min(100vw-2rem,16rem)] overflow-y-auto"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            className="text-sm"
            checked={selected.has(o.value)}
            onCheckedChange={(c) => toggle(o.value, c === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {renderOption ? renderOption(o) : o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GridStatsBar({
  total,
  page,
  pageCount,
  extraLines,
}: {
  total: number;
  page: number;
  pageCount: number;
  /** Tối đa 2 dòng từ server (đã slice ở caller). */
  extraLines: ListSummaryLine[];
}) {
  const chip =
    "inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs shadow-[inset_0_0_0_1px_var(--border-ghost)]";
  return (
    <div
      className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end"
      aria-label="Số liệu lưới"
    >
      <span className={cn(chip, "tabular-nums text-[var(--on-surface)]")}>
        <span className="font-medium text-[var(--on-surface-muted)]">Tổng</span>
        <span className="font-semibold">{formatSummaryValue(total)}</span>
      </span>
      <span className={cn(chip, "tabular-nums text-[var(--on-surface)]")}>
        <span className="font-medium text-[var(--on-surface-muted)]">Trang</span>
        <span className="font-semibold">
          {page}/{pageCount}
        </span>
      </span>
      {extraLines.map((s, i) => (
        <span
          key={"ex-" + i}
          className={cn(chip, "min-w-0 max-w-[min(100%,14rem)]")}
          title={s.label + ": " + formatSummaryValue(s.value)}
        >
          <span className="min-w-0 truncate font-medium text-[var(--on-surface-muted)]">{s.label}</span>
          <span className="shrink-0 font-semibold tabular-nums text-[var(--on-surface)]">
            {formatSummaryValue(s.value)}
          </span>
        </span>
      ))}
    </div>
  );
}

type ExcelDataGridProps<T> = {
  prependFilters?: Record<string, string>;
  moduleId: string;
  title: string;
  columns: ColumnDef<T, unknown>[];
  list: (args: ListArgs) => Promise<ListResult<T>>;
  toolbarExtra?: React.ReactNode;
  initialPageSize?: number;
  getRowId?: (row: T) => string;
  /** Tăng sau khi lưu/xóa để tải lại dữ liệu (router.refresh không cập nhật state client của lưới). */
  reloadSignal?: number;
  /** TTL cache client (ms), mặc định 60s. Đặt 0 để tắt cache (luôn gọi server). */
  listCacheTtlMs?: number;
  /** Bỏ qua cache (luôn gọi server). */
  disableListCache?: boolean;
  /** Nội dung modal chỉ đọc khi bấm "Xem" (mở rộng sau này). */
  renderRowDetail?: (row: T) => React.ReactNode;
  /** Mục menu bổ sung trong cột Thao tác (menu dấu ba chấm). */
  renderRowActions?: (row: T) => React.ReactNode;
  rowDetailTitle?: (row: T) => string;
  /** Class thêm vào từng dòng (desktop `tr`, mobile `li`). */
  getRowClassName?: (row: T) => string | undefined;
  // External filter state
  filters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
  globalSearch?: string;
  onGlobalSearchChange?: (search: string) => void;
};

export function ExcelDataGrid<T>({
  moduleId,
  title,
  columns,
  list,
  toolbarExtra,
  initialPageSize = 25,
  getRowId,
  prependFilters,
  reloadSignal = 0,
  listCacheTtlMs = 60_000,
  disableListCache = false,
  renderRowDetail,
  renderRowActions,
  rowDetailTitle,
  getRowClassName,
  filters: propsFilters,
  onFiltersChange,
  globalSearch: propsGlobalSearch,
  onGlobalSearchChange,
}: ExcelDataGridProps<T>) {
  const [data, setData] = React.useState<T[]>([]);
  const [viewRow, setViewRow] = React.useState<T | null>(null);
  const [total, setTotal] = React.useState(0);
  const [listSummary, setListSummary] = React.useState<ListSummaryLine[]>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const [internalGlobalSearch, setInternalGlobalSearch] = React.useState("");
  const globalSearch = propsGlobalSearch ?? internalGlobalSearch;
  const setGlobalSearch = (v: string) => {
    if (onGlobalSearchChange) onGlobalSearchChange(v);
    else setInternalGlobalSearch(v);
  };

  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  const [internalFilters, setInternalFilters] = React.useState<Record<string, string>>({});
  const filters = propsFilters ?? internalFilters;
  const setFilters = (v: React.SetStateAction<Record<string, string>>) => {
    if (onFiltersChange) {
      const next = typeof v === "function" ? v(filters) : v;
      onFiltersChange(next);
    } else {
      setInternalFilters(v);
    }
  };

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  // Bump the key so old hidden-column preferences do not keep columns hidden by default.
  // Users can still hide columns again through the visibility menu.
  const storageKey = "dg:" + moduleId + ":vis:v2";

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => {
      if (typeof window === "undefined") return {};
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? (JSON.parse(raw) as VisibilityState) : {};
      } catch {
        return {};
      }
    });

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(globalSearch), 350);
    return () => clearTimeout(t);
  }, [globalSearch]);

  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch {
      /* ignore */
    }
  }, [columnVisibility, storageKey]);

  const prevReloadSignal = React.useRef(reloadSignal);
  React.useEffect(() => {
    if (reloadSignal !== prevReloadSignal.current) {
      invalidateListCache(moduleId);
      prevReloadSignal.current = reloadSignal;
    }
  }, [reloadSignal, moduleId]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const listArgs = {
      page,
      pageSize,
      globalSearch: debouncedSearch.trim(),
      filters: { ...prependFilters, ...filters },
    };
    try {
      const bypass = disableListCache || listCacheTtlMs === 0;
      const res = await fetchListWithCache(moduleId, listArgs, undefined, (a) => list(a), {
        ttlMs: bypass ? 60_000 : listCacheTtlMs,
        bypassCache: bypass,
      });
      setData(res.rows);
      setTotal(res.total);
      setListSummary(res.summary ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
      setData([]);
      setTotal(0);
      setListSummary([]);
    } finally {
      setLoading(false);
    }
  }, [
    list,
    moduleId,
    page,
    pageSize,
    debouncedSearch,
    filters,
    prependFilters,
    reloadSignal,
    listCacheTtlMs,
    disableListCache,
  ]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);

  const summaryExtra = React.useMemo(() => (listSummary ?? []).slice(0, 2), [listSummary]);

  const hasActiveFilters = React.useMemo(() => {
    if (globalSearch.trim()) return true;
    return Object.values(filters).some((v) => String(v ?? "").trim() !== "");
  }, [globalSearch, filters]);

  const clearAllFilters = React.useCallback(() => {
    setFilters({});
    setGlobalSearch("");
    setDebouncedSearch("");
  }, []);

  const columnsResolved = React.useMemo(() => {
    let base = [...columns];
    if (renderRowDetail) {
      const hasActions = base.some((c) => c.id === "actions");
      if (!hasActions) {
        base.push({
          id: "actions",
          header: "Thao tác",
          size: 64,
          minSize: 52,
          maxSize: 80,
          enableHiding: false,
          meta: { filterType: "none" as const },
          cell: ({ row }: CellContext<T, unknown>) => (
            <DataGridRowActionsMenu>
              <DataGridMenuViewItem onSelect={() => setViewRow(row.original)}>Xem</DataGridMenuViewItem>
              {renderRowActions ? renderRowActions(row.original) : null}
            </DataGridRowActionsMenu>
          ),
        });
      } else {
        base = base.map((col) => {
          if (col.id !== "actions") return col;
          const prevCell = col.cell;
          return {
            ...col,
            cell: (info: CellContext<T, unknown>) => (
              <DataGridRowActionsMenu>
                <DataGridMenuViewItem onSelect={() => setViewRow(info.row.original)}>Xem</DataGridMenuViewItem>
                {renderRowActions ? renderRowActions(info.row.original) : null}
                {prevCell ? flexRender(prevCell, info) : null}
              </DataGridRowActionsMenu>
            ),
          };
        });
      }
    }
    // Always move actions to the end
    const actionsIdx = base.findIndex(c => c.id === "actions");
    if (actionsIdx !== -1 && actionsIdx !== base.length - 1) {
      const [actionsCol] = base.splice(actionsIdx, 1);
      base.push(actionsCol);
    }
    return base.map((col) => {
      if (col.id !== "actions") return col;
      const prevSize = typeof col.size === "number" ? col.size : 150;
      return {
        ...col,
        size: Math.min(prevSize, 68),
        minSize: typeof col.minSize === "number" ? Math.min(col.minSize, 52) : 52,
        maxSize: typeof col.maxSize === "number" ? Math.min(col.maxSize, 80) : 80,
      };
    });
  }, [columns, renderRowDetail, renderRowActions]);

  const hasColumnFilters = React.useMemo(() => {
    return columnsResolved.some((c) => {
      const fk = c.meta?.filterKey;
      const ft = c.meta?.filterType ?? "text";
      return !!fk && ft !== "none";
    });
  }, [columnsResolved]);

  /**
   * Must match TanStack `row.id` (used as React keys for rows). If a custom `getRowId` returns ""
   * or whitespace, TanStack still uses that for every row → duplicate keys.
   */
  const tableGetRowId = React.useCallback(
    (originalRow: T, index: number, parent?: Row<T>) => {
      if (getRowId) {
        const raw = getRowId(originalRow);
        const s = raw != null ? String(raw).trim() : "";
        if (s) return s;
      }
      return parent ? `${parent.id}.${index}` : String(index);
    },
    [getRowId],
  );

  const table = useReactTable({
    data,
    columns: columnsResolved,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    getRowId: tableGetRowId,
  });

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (!value) delete next[key];
      return next;
    });
  };

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    let rows: T[] = [];
    const exportArgs = {
      page: 1,
      pageSize: 10000,
      globalSearch: debouncedSearch.trim(),
      filters: { ...prependFilters, ...filters },
    };
    try {
      const bypass = disableListCache || listCacheTtlMs === 0;
      const res = await fetchListWithCache(moduleId, exportArgs, undefined, (a) => list(a), {
        ttlMs: bypass ? 60_000 : listCacheTtlMs,
        bypassCache: bypass,
      });
      rows = res.rows;
    } catch {
      rows = data;
    }

    const visible = table.getVisibleLeafColumns();
    const headers: string[] = [];
    const keys: string[] = [];
    for (const col of visible) {
      const id = String(col.id);
      if (id === "actions") continue;
      const h = col.columnDef.header;
      headers.push(typeof h === "string" ? h : id);
      keys.push(id);
    }

    const aoa: (string | number | null)[][] = [headers];
    for (const row of rows) {
      const r = keys.map((k) => {
        const v = (row as Record<string, unknown>)[k];
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return v as string | number;
      });
      aoa.push(r);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, moduleId.slice(0, 31));
    XLSX.writeFile(wb, moduleId + "-export.xlsx");
  };

  return (
    <div className="w-full max-w-full overflow-hidden space-y-4 sm:space-y-6">
      <div className="w-full max-w-full overflow-hidden rounded-[var(--radius-xl)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-[var(--on-surface)] sm:text-2xl md:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-xs text-[var(--on-surface-muted)] sm:text-sm">
                Lọc cột, tìm trong bảng, ẩn/hiện cột và xuất Excel.
              </p>
            </div>
            <GridStatsBar
              total={total}
              page={page}
              pageCount={pageCount}
              extraLines={summaryExtra}
            />
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:max-w-md lg:flex-1">
              <Input
                placeholder="Tìm trong bảng…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="min-h-10 w-full min-w-0 py-2 text-sm"
                aria-label="Tìm kiếm trong bảng"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-10 w-full shrink-0 sm:w-auto"
                disabled={!hasActiveFilters}
                onClick={clearAllFilters}
              >
                Xóa bộ lọc
              </Button>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-1 sm:flex-wrap sm:items-center sm:gap-1.5 lg:flex-none">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" type="button" size="sm" className="min-h-10 w-full sm:w-auto">
                    Cột hiển thị
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                  {table.getAllLeafColumns().map((col) => {
                    if (!col.getCanHide()) return null;
                    return (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onCheckedChange={(v) => col.toggleVisibility(!!v)}
                      >
                        {typeof col.columnDef.header === "string"
                          ? col.columnDef.header
                          : col.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="secondary"
                type="button"
                size="sm"
                className="min-h-10 w-full sm:w-auto"
                onClick={() => void exportXlsx()}
              >
                Xuất Excel
              </Button>
              {toolbarExtra ? (
                <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:contents">{toolbarExtra}</div>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <div
            className="mt-4 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,#ef4444_10%,#fff)] px-4 py-3 text-sm text-[#991b1b]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {hasColumnFilters ? (
          <details className="group mt-4 md:hidden rounded-[var(--radius-lg)] bg-[var(--surface-muted)] shadow-[inset_0_0_0_1px_var(--border-ghost)] [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-left">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--on-surface-faint)]">
                Bộ lọc
              </span>
              <svg
                className="h-4 w-4 shrink-0 text-[var(--on-surface-muted)] transition-transform duration-200 group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-[var(--border-ghost)] px-4 pb-4 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {table.getVisibleLeafColumns().map((col) => {
                  const fk = col.columnDef.meta?.filterKey;
                  const ft = col.columnDef.meta?.filterType ?? "text";
                  if (!fk || ft === "none") return null;
                  const label = dataGridColumnLabel(col);
                  return (
                    <div key={col.id} className="min-w-0 space-y-1.5">
                      <label
                        htmlFor={"dg-filter-" + String(col.id)}
                        className="block text-xs font-semibold text-[var(--on-surface-muted)]"
                      >
                        {label}
                      </label>
                      {ft === "select" ? (
                        <GridMultiSelectFilter
                          filterKey={fk}
                          options={col.columnDef.meta?.filterOptions ?? []}
                          valueRaw={filters[fk] ?? ""}
                          onCommit={setFilter}
                          triggerId={"dg-filter-" + String(col.id)}
                          renderOption={col.columnDef.meta?.renderFilterOption}
                        />
                      ) : ft === "date_range" ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={filters[fk + "_from"] ?? ""}
                            onChange={(e) => setFilter(fk + "_from", e.target.value)}
                            className="h-9 py-1 text-xs"
                          />
                          <span className="text-[var(--on-surface-faint)]">—</span>
                          <Input
                            type="date"
                            value={filters[fk + "_to"] ?? ""}
                            onChange={(e) => setFilter(fk + "_to", e.target.value)}
                            className="h-9 py-1 text-xs"
                          />
                        </div>
                      ) : ft === "date" ? (
                        <Input
                          type="date"
                          value={filters[fk] ?? ""}
                          onChange={(e) => setFilter(fk, e.target.value)}
                          className="h-9 py-1 text-xs"
                        />
                      ) : (
                        <Input
                          id={"dg-filter-" + String(col.id)}
                          value={filters[fk] ?? ""}
                          onChange={(e) => setFilter(fk, e.target.value)}
                          placeholder="Lọc…"
                          aria-label={"Lọc " + fk}
                          className="min-h-10 w-full"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        ) : null}

        <div className="mt-6 space-y-3 md:space-y-0">
          <div className="md:hidden">
            {loading ? (
              <div className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-4 py-10 text-center text-sm text-[var(--on-surface-muted)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
                Đang tải…
              </div>
            ) : data.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-4 py-10 text-center text-sm text-[var(--on-surface-muted)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
                Không có dữ liệu.
              </div>
            ) : (
              <ul className="flex list-none flex-col gap-3 p-0">
                {table.getRowModel().rows.map((row, i) => {
                  const cells = row.getVisibleCells();
                  const actionCells = cells.filter((c) => c.column.id === "actions");
                  const dataCells = cells.filter((c) => c.column.id !== "actions");
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        "rounded-[var(--radius-lg)] p-4 shadow-[inset_0_0_0_1px_var(--border-ghost)]",
                        i % 2 === 1 ? "bg-[var(--surface-row-b)]" : "bg-[var(--surface-card)]",
                        getRowClassName?.(row.original),
                      )}
                    >
                      <dl className="m-0 space-y-2.5">
                        {dataCells.map((cell) => (
                          <div
                            key={cell.id}
                            className="grid grid-cols-[minmax(0,6.5rem)_1fr] gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[minmax(0,8rem)_1fr]"
                          >
                            <dt className="break-words text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">
                              {dataGridColumnLabel(cell.column)}
                            </dt>
                            <dd className="m-0 min-w-0 break-words text-[var(--on-surface)]">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {actionCells.length > 0 ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-ghost)] pt-3.5">
                          {actionCells.map((cell) => {
                            // On mobile, we try to render the action content directly if possible,
                            // but since it's often a DropdownMenu, we'll keep it but ensure it's well-contained.
                            // To avoid the white screen, we ensure the render happens in a safe container.
                            return (
                              <div key={cell.id} className="min-w-0 contents">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="w-full overflow-x-auto rounded-[var(--radius-lg)] bg-[var(--surface-card)] shadow-[inset_0_0_0_1px_var(--border-ghost)] md:block scrollbar-thin scrollbar-thumb-[var(--border-ghost)] scrollbar-track-transparent">
            <table className="w-full min-w-[1280px] border-collapse text-sm table-fixed">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-[var(--border-ghost)]">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        style={{ width: h.column.getSize() }}
                        className={cn(
                          "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--on-surface-faint)] first:pl-4 last:pr-4",
                          h.column.id === "actions" &&
                            "sticky right-0 z-20 w-[68px] max-w-[68px] !px-2 text-center text-[10px] leading-tight bg-[var(--surface-card)] shadow-[-6px_0_12px_rgba(0,0,0,0.1)] border-l border-[var(--border-ghost)]",
                        )}
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
                <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)]">
                  {table.getVisibleLeafColumns().map((col) => {
                    const fk = col.columnDef.meta?.filterKey;
                    const ft = col.columnDef.meta?.filterType ?? "text";
                    if (!fk || ft === "none") {
                      const header = col.columnDef.header;
                      const summaryItem =
                        typeof header === "string" ? listSummary.find((s) => s.label === header) : null;

                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "px-3 py-2 first:pl-4 last:pr-4",
                            col.id === "actions" &&
                              "sticky right-0 z-20 w-[68px] max-w-[68px] !px-2 bg-[var(--surface-muted)] shadow-[-4px_0_8px_rgba(0,0,0,0.05)]",
                          )}
                        >
                          {summaryItem ? (
                            <div className="flex h-9 items-center px-1 text-xs font-bold text-[var(--on-surface)] tabular-nums">
                              {formatSummaryValue(summaryItem.value)}
                            </div>
                          ) : (
                            <span className="sr-only">filter</span>
                          )}
                        </td>
                      );
                    }
                    if (ft === "select") {
                      const opts = col.columnDef.meta?.filterOptions ?? [];
                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "min-w-[9.5rem] px-3 py-2 align-top first:pl-4 last:pr-4",
                            col.id === "actions" &&
                              "sticky right-0 z-20 w-[68px] max-w-[68px] !min-w-0 !px-2 bg-[var(--surface-muted)] shadow-[-6px_0_12px_rgba(0,0,0,0.1)] border-l border-[var(--border-ghost)]",
                          )}
                        >
                          <GridMultiSelectFilter
                            filterKey={fk}
                            options={opts}
                            valueRaw={filters[fk] ?? ""}
                            onCommit={setFilter}
                            triggerId={"dg-th-" + String(col.id)}
                            renderOption={col.columnDef.meta?.renderFilterOption}
                          />
                        </td>
                      );
                    }
                    if (ft === "date_range") {
                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "px-3 py-2 first:pl-4 last:pr-4",
                            col.id === "actions" &&
                              "sticky right-0 z-20 w-[68px] max-w-[68px] !min-w-0 !px-2 bg-[var(--surface-muted)] shadow-[-4px_0_8px_rgba(0,0,0,0.05)]",
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <Input
                              type="date"
                              value={filters[fk + "_from"] ?? ""}
                              onChange={(e) => setFilter(fk + "_from", e.target.value)}
                              className="h-9 px-1 text-[10px]"
                            />
                            <span className="text-[var(--on-surface-faint)] text-[10px]">—</span>
                            <Input
                              type="date"
                              value={filters[fk + "_to"] ?? ""}
                              onChange={(e) => setFilter(fk + "_to", e.target.value)}
                              className="h-9 px-1 text-[10px]"
                            />
                          </div>
                        </td>
                      );
                    }
                    if (ft === "date") {
                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "min-w-[7.5rem] px-3 py-2 first:pl-4 last:pr-4",
                            col.id === "actions" &&
                              "sticky right-0 z-20 w-[68px] max-w-[68px] !min-w-0 !px-2 bg-[var(--surface-muted)] shadow-[-4px_0_8px_rgba(0,0,0,0.05)]",
                          )}
                        >
                          <Input
                            type="date"
                            value={filters[fk] ?? ""}
                            onChange={(e) => setFilter(fk, e.target.value)}
                            className="h-9 w-full min-w-0 px-1 text-[10px]"
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.id}
                        className={cn(
                          "px-3 py-2 first:pl-4 last:pr-4",
                          col.id === "actions" &&
                            "sticky right-0 z-20 w-[68px] max-w-[68px] !min-w-0 !px-2 bg-[var(--surface-muted)] shadow-[-4px_0_8px_rgba(0,0,0,0.05)]",
                        )}
                      >
                        <Input
                          value={filters[fk] ?? ""}
                          onChange={(e) => setFilter(fk, e.target.value)}
                          placeholder="Lọc…"
                          aria-label={"Lọc " + fk}
                        />
                      </td>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={table.getVisibleLeafColumns().length}
                      className="px-4 py-10 text-center text-[var(--on-surface-muted)]"
                    >
                      Đang tải…
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={table.getVisibleLeafColumns().length}
                      className="px-4 py-10 text-center text-[var(--on-surface-muted)]"
                    >
                      Không có dữ liệu.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-[var(--border-ghost)] transition-colors last:border-b-0",
                        "hover:bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface-card))]",
                        i % 2 === 1 ? "bg-[var(--surface-row-b)]" : "bg-[var(--surface-card)]",
                        getRowClassName?.(row.original),
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className={cn(
                            "px-3 py-3 align-middle text-[var(--on-surface)] first:pl-4 last:pr-4 transition-colors",
                            cell.column.id === "actions" &&
                              "sticky right-0 z-10 w-[68px] max-w-[68px] !px-2 text-center shadow-[-6px_0_12px_rgba(0,0,0,0.1)] border-l border-[var(--border-ghost)]",
                            cell.column.id === "actions" && (i % 2 === 1 ? "bg-[var(--surface-row-b)]" : "bg-[var(--surface-card)]"),
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs text-[var(--on-surface-muted)] sm:text-sm">
          {total === 0
            ? "0"
            : String((page - 1) * pageSize + 1) +
            "–" +
            String(Math.min(page * pageSize, total))}{" "}
          / {total} dòng
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-8 min-h-8 w-auto min-w-[4.5rem] py-0 text-xs"
            aria-label="Số dòng mỗi trang"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/trang
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            type="button"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <span className="text-xs text-[var(--on-surface-muted)] sm:text-sm">
            Trang {page} / {pageCount}
          </span>
          <Button
            variant="secondary"
            type="button"
            size="sm"
            disabled={page >= pageCount || total === 0}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      </div>

      {renderRowDetail ? (
        <Dialog open={viewRow != null} onOpenChange={(o) => !o && setViewRow(null)}>
          <DialogContent
            size="2xl"
            className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-4 sm:p-5"
          >
            <DialogHeader className="shrink-0 space-y-1 pb-3">
              <DialogTitle>
                {viewRow
                  ? (rowDetailTitle?.(viewRow) ?? "Chi tiết dòng")
                  : "Chi tiết"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Xem thông tin, các tab liên quan (đơn hàng, công nợ, dòng chi tiết…) tải khi bạn chọn tab.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              {viewRow ? renderRowDetail(viewRow) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
