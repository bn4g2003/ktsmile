"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { narrowIsActiveFilter } from "@/lib/grid/multi-filter";

export type ProductUsage = "both" | "inventory" | "sales";

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  unit_price: number;
  warranty_years: number | null;
  is_active: boolean;
  product_usage: ProductUsage;
  quantity_on_hand: number;
  primary_supplier_id: string | null;
  primary_supplier_code: string | null;
  primary_supplier_name: string | null;
  supplier_link_count: number;
  created_at: string;
  updated_at: string;
};

export async function listProducts(args: ListArgs): Promise<ListResult<ProductRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("v_products_admin_grid").select("*", { count: "exact" });

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("code.ilike." + p + ",name.ilike." + p);
  }
  const activeOnly = narrowIsActiveFilter(filters.is_active);
  if (activeOnly !== null) q = q.eq("is_active", activeOnly);
  if (filters.code?.trim()) q = q.ilike("code", "%" + filters.code.trim() + "%");
  if (filters.name?.trim()) q = q.ilike("name", "%" + filters.name.trim() + "%");
  const pu = filters.product_usage?.trim();
  if (pu === "both" || pu === "inventory" || pu === "sales") q = q.eq("product_usage", pu);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("code", { ascending: true }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r["id"] as string,
    code: r["code"] as string,
    name: r["name"] as string,
    unit: r["unit"] as string,
    unit_price: Number(r["unit_price"]),
    warranty_years: (r["warranty_years"] as number | null) ?? null,
    is_active: Boolean(r["is_active"]),
    product_usage: (r["product_usage"] as ProductUsage) ?? "both",
    quantity_on_hand: Number(r["quantity_on_hand"] ?? 0),
    primary_supplier_id: (r["primary_supplier_id"] as string | null) ?? null,
    primary_supplier_code: (r["primary_supplier_code"] as string | null) ?? null,
    primary_supplier_name: (r["primary_supplier_name"] as string | null) ?? null,
    supplier_link_count: Number(r["supplier_link_count"] ?? 0),
    created_at: r["created_at"] as string,
    updated_at: r["updated_at"] as string,
  }));
  return { rows, total: count ?? 0 };
}

const schema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  unit: z.string().min(1).max(50),
  unit_price: z.coerce.number().min(0),
  warranty_years: z.coerce.number().int().min(0).optional().nullable(),
  is_active: z.boolean().optional(),
  product_usage: z.enum(["both", "inventory", "sales"]).default("both"),
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
  revalidatePath("/inventory/stock");
}

export async function updateProduct(id: string, input: z.infer<typeof schema>) {
  const supabase = createSupabaseAdmin();
  const row = schema.parse(input);
  const { error } = await supabase.from("products").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
}

export async function deleteProduct(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
}

export async function listProductPicker(opts?: { forInventory?: boolean }) {
  const supabase = createSupabaseAdmin();
  let q = supabase.from("products").select("id, code, name, unit_price, product_usage");
  if (opts?.forInventory) {
    q = q.in("product_usage", ["both", "inventory"]);
  }
  const { data, error } = await q.order("code", { ascending: true }).limit(3000);
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    code: string;
    name: string;
    unit_price: number;
    product_usage?: ProductUsage;
  }[];
}

