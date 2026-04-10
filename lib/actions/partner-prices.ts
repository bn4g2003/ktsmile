"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";

export type PartnerPriceRow = {
  id: string;
  partner_id: string;
  product_id: string;
  unit_price: number;
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
};

export async function listPartnerPrices(
  args: ListArgs,
): Promise<ListResult<PartnerPriceRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch } = args;
  let q = supabase
    .from("partner_product_prices")
    .select(
      "id, partner_id, product_id, unit_price, created_at, updated_at, partners:partner_id(code,name), products:product_id(code,name)",
      { count: "exact" },
    );

  const g = globalSearch.trim();
  if (g) {
    const supabase2 = createSupabaseAdmin();
    const p = "%" + g + "%";
    const { data: pRows } = await supabase2
      .from("partners")
      .select("id")
      .or("code.ilike." + p + ",name.ilike." + p);
    const { data: prRows } = await supabase2
      .from("products")
      .select("id")
      .or("code.ilike." + p + ",name.ilike." + p);
    const pids = (pRows ?? []).map((r) => r.id);
    const prodIds = (prRows ?? []).map((r) => r.id);
    const conds: string[] = [];
    if (pids.length) conds.push("partner_id.in.(" + pids.join(",") + ")");
    if (prodIds.length) conds.push("product_id.in.(" + prodIds.join(",") + ")");
    if (conds.length) q = q.or(conds.join(","));
    else q = q.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows: PartnerPriceRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const partners = r["partners"] as { code?: string; name?: string } | null;
    const products = r["products"] as { code?: string; name?: string } | null;
    return {
      id: r["id"] as string,
      partner_id: r["partner_id"] as string,
      product_id: r["product_id"] as string,
      unit_price: Number(r["unit_price"]),
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      partner_code: partners?.code,
      partner_name: partners?.name,
      product_code: products?.code,
      product_name: products?.name,
    };
  });

  return { rows, total: count ?? 0 };
}

const schema = z.object({
  partner_id: z.string().uuid(),
  product_id: z.string().uuid(),
  unit_price: z.coerce.number().min(0),
});

export async function createPartnerPrice(input: z.infer<typeof schema>) {
  const supabase = createSupabaseAdmin();
  const row = schema.parse(input);
  const { error } = await supabase.from("partner_product_prices").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/master/prices");
}

export async function updatePartnerPrice(
  id: string,
  input: z.infer<typeof schema>,
) {
  const supabase = createSupabaseAdmin();
  const row = schema.parse(input);
  const { error } = await supabase.from("partner_product_prices").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/prices");
}

export async function deletePartnerPrice(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("partner_product_prices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/prices");
}
