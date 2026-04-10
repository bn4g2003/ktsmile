"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  unit_price: number;
  warranty_years: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listProducts(args: ListArgs): Promise<ListResult<ProductRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("products").select("*", { count: "exact" });

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("code.ilike." + p + ",name.ilike." + p);
  }
  if (filters.is_active === "true") q = q.eq("is_active", true);
  if (filters.is_active === "false") q = q.eq("is_active", false);
  if (filters.code?.trim()) q = q.ilike("code", "%" + filters.code.trim() + "%");
  if (filters.name?.trim()) q = q.ilike("name", "%" + filters.name.trim() + "%");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("code", { ascending: true }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as ProductRow[], total: count ?? 0 };
}

const schema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  unit: z.string().min(1).max(50),
  unit_price: z.coerce.number().min(0),
  warranty_years: z.coerce.number().int().min(0).optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function createProduct(input: z.infer<typeof schema>) {
  const supabase = createSupabaseAdmin();
  const row = schema.parse(input);
  const { error } = await supabase.from("products").insert({
    ...row,
    is_active: row.is_active ?? true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/master/products");
}

export async function updateProduct(id: string, input: z.infer<typeof schema>) {
  const supabase = createSupabaseAdmin();
  const row = schema.parse(input);
  const { error } = await supabase.from("products").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/products");
}

export async function deleteProduct(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/products");
}

export async function listProductPicker() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id, code, name, unit_price")
    .order("code", { ascending: true })
    .limit(3000);
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    code: string;
    name: string;
    unit_price: number;
  }[];
}

