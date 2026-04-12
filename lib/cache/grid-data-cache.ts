"use client";

/**
 * Cache in-memory cho lưới ExcelDataGrid (cùng session tab).
 * Giảm gọi server action lặp; gộp request song song trùng khóa.
 * invalidateListCache(moduleId) khi reloadSignal / sau chỉnh sửa.
 */

type ListArgsLike = {
  page: number;
  pageSize: number;
  globalSearch: string;
  filters: Record<string, string>;
};

type ListSummaryLine = { label: string; value: string | number };

type Entry<T> = { result: { rows: T[]; total: number; summary?: ListSummaryLine[] }; expires: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_KEYS = 220;

function stableFiltersKey(filters: Record<string, string>) {
  const keys = Object.keys(filters).sort();
  const o: Record<string, string> = {};
  for (const k of keys) {
    const v = filters[k];
    if (v) o[k] = v;
  }
  return JSON.stringify(o);
}

export function listCacheKey(
  moduleId: string,
  args: ListArgsLike,
  prependFilters?: Record<string, string>,
): string {
  const merged = prependFilters ? { ...prependFilters, ...args.filters } : args.filters;
  return [
    moduleId,
    "p=" + args.page,
    "ps=" + args.pageSize,
    "g=" + args.globalSearch.trim(),
    "f=" + stableFiltersKey(merged),
  ].join("|");
}

export function invalidateListCache(moduleId: string): void {
  const prefix = moduleId + "|";
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
  for (const k of [...inflight.keys()]) {
    if (k.startsWith(prefix)) inflight.delete(k);
  }
}

function trimStore(): void {
  while (store.size > MAX_KEYS) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
}

export type FetchListOptions = {
  ttlMs: number;
  bypassCache: boolean;
};

export async function fetchListWithCache<T>(
  moduleId: string,
  args: ListArgsLike,
  prependFilters: Record<string, string> | undefined,
  fetcher: (args: ListArgsLike) => Promise<{ rows: T[]; total: number; summary?: ListSummaryLine[] }>,
  options: FetchListOptions,
): Promise<{ rows: T[]; total: number; summary?: ListSummaryLine[] }> {
  if (options.bypassCache) {
    return fetcher(args);
  }

  const now = Date.now();
  const key = listCacheKey(moduleId, args, prependFilters);

  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) {
    return hit.result;
  }

  let p = inflight.get(key) as Promise<{ rows: T[]; total: number; summary?: ListSummaryLine[] }> | undefined;
  if (p) return p;

  p = fetcher(args)
    .then((result) => {
      store.set(key, { result, expires: Date.now() + options.ttlMs } as Entry<unknown>);
      trimStore();
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}
