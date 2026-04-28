import { getCurrentUser } from "./current-user";
import { redirect } from "next/navigation";
import { resolvePermissionPreset, NAV_PERMISSION_RULES } from "./permission-presets";

/**
 * Kiểm tra quyền truy cập của User hiện tại đối với một đường dẫn cụ thể.
 * Nếu không có quyền, sẽ tự động chuyển hướng (redirect) về trang hợp lệ.
 */
export async function assertPathPermission(path: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Lấy danh sách path được phép (ưu tiên từ DB, sau đó mới đến bộ quyền mặc định trong code)
  const navPermission = resolvePermissionPreset(user.permissions);
  const allowedPaths = user.nav_allowed_paths ?? (NAV_PERMISSION_RULES[navPermission] ?? []);
  
  // 1. Nếu là Admin toàn quyền (*) -> Cho qua luôn
  if (allowedPaths.includes("*")) return;

  // 2. Kiểm tra quyền: Phải khớp hoàn toàn hoặc là trang con của trang được phép
  // Ví dụ: Cho phép "/orders" thì cũng sẽ cho phép "/orders/review" hoặc "/orders/123"
  const hasPermission = allowedPaths.some((allowed) => {
    if (allowed === "/") return path === "/"; // Trang chủ phải khớp chính xác
    return path === allowed || path.startsWith(allowed + "/");
  });
  
  if (!hasPermission) {
    // Nếu không có quyền, tìm trang đầu tiên hợp lệ trong danh sách để đẩy về
    // Ưu tiên đẩy về trang chức năng thay vì Dashboard nếu có thể
    const firstValidPath = allowedPaths.find(p => p !== "*" && p !== "/");
    redirect(firstValidPath || (allowedPaths.includes("/") ? "/" : "/login"));
  }
}
