"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { narrowIsActiveFilter } from "@/lib/grid/multi-filter";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type SupplierRow = {
  id: string;
  code: string;
  name: string;
  representative_name: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const supplierSchema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  representative_name: z.string().max(500).optional().nullable(),
  phone: z.string().max(100).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  tax_id: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function listSuppliers(args: ListArgs): Promise<ListResult<SupplierRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("suppliers").select("*", { count: "exact" });

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g.replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";
    q = q.or("code.ilike." + p + ",name.ilike." + p + ",phone.ilike." + p + ",representative_name.ilike." + p);
  }

  const activeOnly = narrowIsActiveFilter(filters.is_active);
  if (activeOnly !== null) q = q.eq("is_active", activeOnly);
  if (filters.code?.trim()) q = q.ilike("code", "%" + filters.code.trim() + "%");
  if (filters.name?.trim()) q = q.ilike("name", "%" + filters.name.trim() + "%");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.order("code", { ascending: true }).range(from, to);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as SupplierRow[], total: count ?? 0 };
}

export async function createSupplier(input: z.infer<typeof supplierSchema>) {
  const supabase = createSupabaseAdmin();
  const row = supplierSchema.parse(input);
  const { error } = await supabase.from("suppliers").insert({
    ...row,
    is_active: row.is_active ?? true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/master/partners");
}

export async function updateSupplier(id: string, input: z.infer<typeof supplierSchema>) {
  const supabase = createSupabaseAdmin();
  const row = supplierSchema.parse(input);
  const { error } = await supabase.from("suppliers").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/partners");
}

export async function deleteSupplier(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/partners");
}

export async function listSupplierPicker() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code", { ascending: true })
    .limit(3000);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; code: string; name: string }[];
}
