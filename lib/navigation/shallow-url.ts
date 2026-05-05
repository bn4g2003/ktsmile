/**
 * Cập nhật URL mà không kích hoạt điều hướng App Router — tránh refetch RSC khi chỉ đổi tab
 * (dữ liệu đã lấy qua server actions trên client).
 */
export function replaceUrlQuietly(pathWithQuery: string): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state, "", pathWithQuery);
}
