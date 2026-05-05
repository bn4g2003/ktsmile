export default function AppSegmentLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col gap-4 p-1" aria-busy="true" aria-label="Đang tải">
      <div className="h-9 w-48 max-w-full animate-pulse rounded-lg bg-slate-200/80" />
      <div className="h-32 w-full animate-pulse rounded-xl bg-slate-100" />
      <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}
