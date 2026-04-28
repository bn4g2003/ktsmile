"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { SHELL_NAV_ALLOWED_PATHS, SHELL_NAV_STAR } from "@/lib/nav/shell-nav-catalog";

export type AppRoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const allowedPathSet = new Set<string>(SHELL_NAV_ALLOWED_PATHS);

function assertNavPaths(paths: string[]) {
  if (paths.includes(SHELL_NAV_STAR)) {
    if (paths.length !== 1) throw new Error("Toàn quyền menu chỉ được chọn một mình (*).");
    return;
  }
  for (const p of paths) {
    if (!allowedPathSet.has(p)) throw new Error("Đường dẫn menu không hợp lệ: " + p);
  }
}

export async function listAppRolesPicker(): Promise<Pick<AppRoleRow, "id" | "code" | "name">[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_roles")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<AppRoleRow, "id" | "code" | "name">[];
}

export async function listAppRolesAdmin(): Promise<AppRoleRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("app_roles").select("*").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AppRoleRow[];
}

export async function getAppRoleNavPaths(roleId: string): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("app_role_nav_paths").select("path").eq("role_id", roleId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.path as string);
}

export async function saveAppRoleNavPaths(roleId: string, paths: string[]) {
  const uniq = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  // Tự động lọc bỏ các đường dẫn cũ không còn tồn tại trong catalog để tránh lỗi validation
  const filtered = uniq.filter((p) => p === SHELL_NAV_STAR || allowedPathSet.has(p));
  assertNavPaths(filtered);
  const supabase = createSupabaseAdmin();
  const { error: delErr } = await supabase.from("app_role_nav_paths").delete().eq("role_id", roleId);
  if (delErr) throw new Error(delErr.message);
  if (filtered.length === 0) {
    revalidatePath("/master/employees");
    return;
  }
  const { error: insErr } = await supabase.from("app_role_nav_paths").insert(
    filtered.map((path) => ({ role_id: roleId, path })),
  );
  if (insErr) throw new Error(insErr.message);
  revalidatePath("/master/employees");
}

const roleSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Mã chỉ gồm chữ thường, số và gạch dưới"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function createAppRole(input: z.infer<typeof roleSchema>) {
  const supabase = createSupabaseAdmin();
  const row = roleSchema.parse(input);
  const { data, error } = await supabase
    .from("app_roles")
    .insert({
      code: row.code.trim().toLowerCase(),
      name: row.name.trim(),
      description: row.description?.trim() ? row.description.trim() : null,
      is_active: row.is_active ?? true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/master/employees");
  return data?.id as string;
}

export async function updateAppRole(
  id: string,
  input: z.infer<typeof roleSchema> & { is_active: boolean },
) {
  const supabase = createSupabaseAdmin();
  const row = roleSchema.extend({ is_active: z.boolean() }).parse(input);
  const { error } = await supabase
    .from("app_roles")
    .update({
      code: row.code.trim().toLowerCase(),
      name: row.name.trim(),
      description: row.description?.trim() ? row.description.trim() : null,
      is_active: row.is_active,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/employees");
}

export async function deleteAppRole(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("app_roles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/employees");
}
