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

export async function listPartnerPricesByProductId(
  productId: string,
  limit = 60,
): Promise<PartnerPriceRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_product_prices")
    .select(
      "id, partner_id, product_id, unit_price, created_at, updated_at, partners:partner_id(code,name), products:product_id(code,name)",
    )
    .eq("product_id", productId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => {
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

export async function getPriceMatrix() {
  const supabase = createSupabaseAdmin();
  const [pRes, prRes, oRes] = await Promise.all([
    // Chỉ lấy khách hàng (customer_clinic, customer_labo), không lấy supplier
    supabase
      .from("partners")
      .select("id, code, name")
      .in("partner_type", ["customer_clinic", "customer_labo"])
      .eq("is_active", true)
      .order("name")
      .limit(5000),
    // Chỉ lấy sản phẩm (sales, both), không lấy nguyên vật liệu (inventory)
    supabase
      .from("products")
      .select("id, code, name, unit_price")
      .in("product_usage", ["sales", "both"])
      .eq("is_active", true)
      .order("name")
      .limit(5000),
    supabase.from("partner_product_prices").select("id, partner_id, product_id, unit_price").limit(10000),
  ]);

  if (pRes.error) throw new Error(pRes.error.message);
  if (prRes.error) throw new Error(prRes.error.message);
  if (oRes.error) throw new Error(oRes.error.message);

  return {
    partners: pRes.data || [],
    products: prRes.data || [],
    overrides: oRes.data || [],
  };
}

export async function getPriceQuotePayload(partnerId: string) {
  const supabase = createSupabaseAdmin();
  
  // Lấy thông tin khách hàng
  const { data: partner, error: pErr } = await supabase
    .from("partners")
    .select("code, name")
    .eq("id", partnerId)
    .single();
  if (pErr || !partner) throw new Error("Không tìm thấy khách hàng");

  // Lấy danh sách sản phẩm
  const { data: products, error: prErr } = await supabase
    .from("products")
    .select("id, code, name, unit, unit_price")
    .in("product_usage", ["sales", "both"])
    .eq("is_active", true)
    .order("name")
    .limit(5000);
  if (prErr) throw new Error(prErr.message);

  // Lấy giá riêng của khách hàng
  const { data: overrides, error: oErr } = await supabase
    .from("partner_product_prices")
    .select("product_id, unit_price")
    .eq("partner_id", partnerId);
  if (oErr) throw new Error(oErr.message);

  const overrideMap = new Map<string, number>();
  for (const o of overrides ?? []) {
    overrideMap.set(o.product_id as string, Number(o.unit_price));
  }

  return {
    partner_code: partner.code as string,
    partner_name: partner.name as string,
    generated_at: new Date().toLocaleString("vi-VN"),
    products: (products ?? []).map((p) => {
      const basePrice = Number(p.unit_price);
      const partnerPrice = overrideMap.get(p.id as string) ?? null;
      const discountPercent = partnerPrice !== null 
        ? Math.round((1 - partnerPrice / basePrice) * 100)
        : 0;
      
      return {
        product_code: p.code as string,
        product_name: p.name as string,
        unit: (p.unit as string) || "",
        base_price: basePrice,
        partner_price: partnerPrice,
        discount_percent: discountPercent,
      };
    }),
  };
}
