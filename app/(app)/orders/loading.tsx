export default function OrdersRouteLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-4 p-1" aria-busy="true" aria-label="Đang tải đơn hàng">
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-36 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-9 w-52 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      </div>
      <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      <div className="h-72 w-full animate-pulse rounded-xl bg-[var(--surface-muted)] shadow-[inset_0_0_0_1px_var(--border-ghost)]" />
      <div className="flex gap-2">
        <div className="h-8 w-24 animate-pulse rounded-md bg-[var(--surface-muted)]" />
        <div className="h-8 w-24 animate-pulse rounded-md bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}
