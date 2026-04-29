import { cookies } from "next/headers";
import { cache } from "react";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/session";

export type CurrentUser = {
  employee_id: string;
  code: string;
  full_name: string;
  email: string | null;
  permissions: string | null;
  /** Có khi employees.app_role_id trỏ tới app_roles và truy vấn path thành công; ưu tiên cho sidebar. */
  nav_allowed_paths: string[] | null;
  /** Tên vai trò từ app_roles (hiển thị thay cho preset permissions khi có). */
  app_role_label: string | null;
  /** Mã vai trò từ app_roles. */
  app_role_code: string | null;
  /** Phạm vi xem lương lấy từ app_roles.description: payroll:all | payroll:self */
  payroll_scope: "all" | "self" | null;
  /** Phạm vi chấm công lấy từ app_roles.description: attendance:all | attendance:self */
  attendance_scope: "all" | "self" | null;
};

function parseScopeFromRoleDescription(
  description: string | null | undefined,
  domain: "payroll" | "attendance",
): "all" | "self" | null {
  const d = String(description ?? "");
  const m = new RegExp("\\b" + domain + "\\s*:\\s*(all|self)\\b", "i").exec(d);
  if (!m) return null;
  return m[1]?.toLowerCase() === "all" ? "all" : "self";
}

/** Gộp truy vấn trong cùng một request RSC (layout + page); không dùng unstable_cache để tránh lệch cache sau refresh/mutation. */
const loadCurrentUserByEmployeeId = cache(async (employeeId: string): Promise<CurrentUser | null> => {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("employees")
    .select("id, code, full_name, email, permissions, is_active, app_role_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) return null;
  if (!data || !Boolean(data["is_active"])) return null;

  let nav_allowed_paths: string[] | null = null;
  let app_role_label: string | null = null;
  let app_role_code: string | null = null;
  let payroll_scope: "all" | "self" | null = null;
  let attendance_scope: "all" | "self" | null = null;
  const appRoleId = (data["app_role_id"] as string | null) ?? null;
  if (appRoleId) {
    const [pathsRes, roleRes] = await Promise.all([
      supabase.from("app_role_nav_paths").select("path").eq("role_id", appRoleId),
      supabase.from("app_roles").select("name, code, description").eq("id", appRoleId).maybeSingle(),
    ]);
    if (!pathsRes.error && pathsRes.data) {
      nav_allowed_paths = pathsRes.data.map((r) => r.path as string);
    }
    if (!roleRes.error && roleRes.data) {
      app_role_label = roleRes.data.name as string;
      app_role_code = (roleRes.data.code as string | null) ?? null;
      payroll_scope = parseScopeFromRoleDescription(
        (roleRes.data.description as string | null) ?? null,
        "payroll",
      );
      attendance_scope = parseScopeFromRoleDescription(
        (roleRes.data.description as string | null) ?? null,
        "attendance",
      );
    }
  }

  return {
    employee_id: data["id"] as string,
    code: data["code"] as string,
    full_name: data["full_name"] as string,
    email: (data["email"] as string | null) ?? null,
    permissions: (data["permissions"] as string | null) ?? null,
    nav_allowed_paths,
    app_role_label,
    app_role_code,
    payroll_scope,
    attendance_scope,
  };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const employeeId = jar.get(AUTH_SESSION_COOKIE)?.value ?? null;
  if (!employeeId) return null;
  return loadCurrentUserByEmployeeId(employeeId);
}
