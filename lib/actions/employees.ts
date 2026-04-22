"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { narrowIsActiveFilter } from "@/lib/grid/multi-filter";

export type EmployeeRow = {
  id: string;
  code: string;
  full_name: string;
  role: string;
  permissions: string | null;
  app_role_id: string | null;
  app_role_code: string | null;
  app_role_name: string | null;
  base_salary: number;
  phone: string | null;
  email: string | null;
  address: string | null;
  username: string | null;
  password_plain: string | null;
  notes: string | null;
  auth_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapEmployeeRow(raw: Record<string, unknown>): EmployeeRow {
  const nested = raw["app_roles"];
  const ar = (Array.isArray(nested) ? nested[0] : nested) as { code?: string; name?: string } | null | undefined;
  return {
    id: raw["id"] as string,
    code: raw["code"] as string,
    full_name: raw["full_name"] as string,
    role: raw["role"] as string,
    permissions: (raw["permissions"] as string | null) ?? null,
    app_role_id: (raw["app_role_id"] as string | null) ?? null,
    app_role_code: ar?.code ?? null,
    app_role_name: ar?.name ?? null,
    base_salary: Number(raw["base_salary"] ?? 0),
    phone: (raw["phone"] as string | null) ?? null,
    email: (raw["email"] as string | null) ?? null,
    address: (raw["address"] as string | null) ?? null,
    username: (raw["username"] as string | null) ?? null,
    password_plain: (raw["password_plain"] as string | null) ?? null,
    notes: (raw["notes"] as string | null) ?? null,
    auth_user_id: (raw["auth_user_id"] as string | null) ?? null,
    is_active: Boolean(raw["is_active"]),
    created_at: String(raw["created_at"] ?? ""),
    updated_at: String(raw["updated_at"] ?? ""),
  };
}

export async function listEmployees(args: ListArgs): Promise<ListResult<EmployeeRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase
    .from("employees")
    .select("*, app_roles(code, name)", { count: "exact" });

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("code.ilike." + p + ",full_name.ilike." + p + ",role.ilike." + p);
  }
  const activeOnly = narrowIsActiveFilter(filters.is_active);
  if (activeOnly !== null) q = q.eq("is_active", activeOnly);
  if (filters.code?.trim()) q = q.ilike("code", "%" + filters.code.trim() + "%");
  if (filters.full_name?.trim())
    q = q.ilike("full_name", "%" + filters.full_name.trim() + "%");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("code", { ascending: true }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []).map((r) => mapEmployeeRow(r as Record<string, unknown>)), total: count ?? 0 };
}

const schema = z.object({
  code: z.string().min(1).max(100),
  full_name: z.string().min(1).max(500),
  app_role_id: z.string().uuid({ message: "Chọn vai trò đăng nhập" }),
  base_salary: z.coerce.number().min(0),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  username: z.string().max(100).optional().nullable(),
  password_plain: z.string().max(255).optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function createEmployee(input: z.infer<typeof schema>) {
  const supabase = createSupabaseAdmin();
  const row = schema.parse(input);
  const { data: ar, error: arErr } = await supabase
    .from("app_roles")
    .select("name, code")
    .eq("id", row.app_role_id)
    .eq("is_active", true)
    .maybeSingle();
  if (arErr) throw new Error(arErr.message);
  if (!ar) throw new Error("Vai trò không tồn tại hoặc đã ngưng dùng.");
  const roleName = String(ar["name"] ?? "").trim();
  const roleCode = String(ar["code"] ?? "").trim();
  const patch = {
    code: row.code.trim(),
    full_name: row.full_name.trim(),
    role: roleName || roleCode,
    app_role_id: row.app_role_id,
    permissions: roleCode || null,
    base_salary: row.base_salary,
    phone: row.phone?.trim() ? row.phone.trim() : null,
    email: row.email?.trim() ? row.email.trim() : null,
    address: row.address?.trim() ? row.address.trim() : null,
    username: row.username?.trim() ? row.username.trim() : null,
    password_plain: row.password_plain?.trim() ? row.password_plain : null,
    notes: row.notes?.trim() ? row.notes.trim() : null,
  };
  const { error } = await supabase.from("employees").insert({
    ...patch,
    is_active: row.is_active ?? true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/master/employees");
}

export async function updateEmployee(id: string, input: z.infer<typeof schema>) {
  const supabase = createSupabaseAdmin();
  const row = schema.parse(input);
  const { data: ar, error: arErr } = await supabase
    .from("app_roles")
    .select("name, code")
    .eq("id", row.app_role_id)
    .eq("is_active", true)
    .maybeSingle();
  if (arErr) throw new Error(arErr.message);
  if (!ar) throw new Error("Vai trò không tồn tại hoặc đã ngưng dùng.");
  const roleName = String(ar["name"] ?? "").trim();
  const roleCode = String(ar["code"] ?? "").trim();
  const patch = {
    code: row.code.trim(),
    full_name: row.full_name.trim(),
    role: roleName || roleCode,
    app_role_id: row.app_role_id,
    permissions: roleCode || null,
    base_salary: row.base_salary,
    phone: row.phone?.trim() ? row.phone.trim() : null,
    email: row.email?.trim() ? row.email.trim() : null,
    address: row.address?.trim() ? row.address.trim() : null,
    username: row.username?.trim() ? row.username.trim() : null,
    password_plain: row.password_plain?.trim() ? row.password_plain : null,
    notes: row.notes?.trim() ? row.notes.trim() : null,
  };
  const { error } = await supabase.from("employees").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/employees");
}

export async function deleteEmployee(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/employees");
}

export type EmployeePickerRow = {
  id: string;
  code: string;
  full_name: string;
  base_salary: number;
  is_active: boolean;
};

export async function listEmployeePicker(activeOnly = true): Promise<EmployeePickerRow[]> {
  const supabase = createSupabaseAdmin();
  let q = supabase
    .from("employees")
    .select("id, code, full_name, base_salary, is_active")
    .order("code", { ascending: true })
    .limit(500);
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r["id"] as string,
    code: r["code"] as string,
    full_name: r["full_name"] as string,
    base_salary: Number(r["base_salary"] ?? 0),
    is_active: Boolean(r["is_active"]),
  }));
}
