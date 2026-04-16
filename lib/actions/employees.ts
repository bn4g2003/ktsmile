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

export async function listEmployees(args: ListArgs): Promise<ListResult<EmployeeRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("employees").select("*", { count: "exact" });

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
  return { rows: (data ?? []) as EmployeeRow[], total: count ?? 0 };
}

const schema = z.object({
  code: z.string().min(1).max(100),
  full_name: z.string().min(1).max(500),
  role: z.string().min(1).max(200),
  permissions: z.string().max(3000).optional().nullable(),
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
  const patch = {
    ...row,
    permissions: row.permissions?.trim() ? row.permissions.trim() : null,
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
  const patch = {
    ...row,
    permissions: row.permissions?.trim() ? row.permissions.trim() : null,
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
