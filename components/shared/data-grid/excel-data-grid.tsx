"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import {
  DataGridActionGroup,
  DataGridViewButton,
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
import { cn } from "@/lib/utils/cn";

export type ListArgs = {
  page: number;
  pageSize: number;
  globalSearch: string;
  filters: Record<string, string>;
};

export type ListResult<T> = { rows: T[]; total: number };

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
  rowDetailTitle?: (row: T) => string;
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
  rowDetailTitle,
}: ExcelDataGridProps<T>) {
  const [data, setData] = React.useState<T[]>([]);
  const [viewRow, setViewRow] = React.useState<T | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [globalSearch, setGlobalSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const storageKey = "dg:" + moduleId + ":vis";

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
      setData([]);
      setTotal(0);
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

  const columnsResolved = React.useMemo(() => {
    if (!renderRowDetail) return columns;
    const hasActions = columns.some((c) => c.id === "actions");
    if (!hasActions) {
      return [
        ...columns,
        {
          id: "actions",
          header: "Thao tác",
          enableHiding: false,
          meta: { filterType: "none" as const },
          cell: ({ row }: CellContext<T, unknown>) => (
            <DataGridActionGroup>
              <DataGridViewButton type="button" onClick={() => setViewRow(row.original)}>
                Xem
              </DataGridViewButton>
            </DataGridActionGroup>
          ),
        },
      ];
    }
    return columns.map((col) => {
      if (col.id !== "actions") return col;
      const prevCell = col.cell;
      return {
        ...col,
        cell: (info: CellContext<T, unknown>) => (
          <DataGridActionGroup>
            <DataGridViewButton type="button" onClick={() => setViewRow(info.row.original)}>
              Xem
            </DataGridViewButton>
            {prevCell ? flexRender(prevCell, info) : null}
          </DataGridActionGroup>
        ),
      };
    });
  }, [columns, renderRowDetail]);

  const table = useReactTable({
    data,
    columns: columnsResolved,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
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
    <div className="space-y-6">
      <div className="rounded-[var(--radius-xl)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--on-surface)] sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
              Lọc cột, tìm trong bảng, ẩn/hiện cột và xuất Excel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              placeholder="Tìm trong bảng…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="min-h-8 min-w-[10rem] max-w-xs py-1.5 text-sm"
              aria-label="Tìm kiếm trong bảng"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" type="button" size="sm">
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
            <Button variant="secondary" type="button" size="sm" onClick={() => void exportXlsx()}>
              Xuất Excel
            </Button>
            {toolbarExtra}
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

        <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] bg-[var(--surface-card)] p-3 sm:p-4 shadow-[inset_0_0_0_1px_var(--border-ghost)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[var(--border-ghost)]">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--on-surface-faint)] first:pl-4 last:pr-4"
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
                  return (
                    <td key={col.id} className="px-3 py-2 first:pl-4 last:pr-4">
                      <span className="sr-only">filter</span>
                    </td>
                  );
                }
                if (ft === "select") {
                  const opts = col.columnDef.meta?.filterOptions ?? [];
                  return (
                    <td key={col.id} className="px-3 py-2 first:pl-4 last:pr-4">
                      <Select
                        value={filters[fk] ?? ""}
                        onChange={(e) => setFilter(fk, e.target.value)}
                        aria-label={"Lọc " + fk}
                      >
                        <option value="">Tất cả</option>
                        {opts.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                  );
                }
                return (
                  <td key={col.id} className="px-3 py-2 first:pl-4 last:pr-4">
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
                  key={getRowId ? getRowId(row.original) : row.id}
                  className={cn(
                    "border-b border-[var(--border-ghost)] transition-colors last:border-b-0",
                    "hover:bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface-card))]",
                    i % 2 === 1 ? "bg-[var(--surface-row-b)]" : "bg-[var(--surface-card)]",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2 align-middle text-[var(--on-surface)] first:pl-4 last:pr-4"
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--on-surface-muted)] sm:text-sm">
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
          <DialogContent size="xl" className="max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>
                {viewRow
                  ? (rowDetailTitle?.(viewRow) ?? "Chi tiết dòng")
                  : "Chi tiết"}
              </DialogTitle>
              <DialogDescription>
                Xem nhanh toàn bộ trường; sau này có thể bổ sung tab, file đính kèm, lịch sử…
              </DialogDescription>
            </DialogHeader>
            {viewRow ? renderRowDetail(viewRow) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
