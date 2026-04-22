"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { narrowIsActiveFilter } from "@/lib/grid/multi-filter";

export type MaterialRow = {
  id: string;
  legacy_product_id: string | null;
  code: string;
  name: string;
  unit: string;
  /** Đơn giá tham chiếu (lưu trên bản ghi products legacy). */
  unit_price: number;
  is_active: boolean;
  quantity_on_hand: number;
  primary_supplier_id: string | null;
  primary_supplier_code: string | null;
  primary_supplier_name: string | null;
  created_at: string;
  updated_at: string;
};

export async function listMaterials(args: ListArgs): Promise<ListResult<MaterialRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase
    .from("materials")
    .select("id, legacy_product_id, code, name, unit, is_active, created_at, updated_at", {
      count: "exact",
    });

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("code.ilike." + p + ",name.ilike." + p);
  }
  const activeOnly = narrowIsActiveFilter(filters.is_active);
  if (activeOnly !== null) q = q.eq("is_active", activeOnly);
  if (filters.code?.trim()) q = q.ilike("code", "%" + filters.code.trim() + "%");
  if (filters.name?.trim()) q = q.ilike("name", "%" + filters.name.trim() + "%");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("code", { ascending: true }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const materials = (data ?? []) as Record<string, unknown>[];
  const materialIds = materials.map((r) => r["id"] as string).filter(Boolean);
  const stockByMaterialId = new Map<string, Record<string, unknown>>();
  if (materialIds.length > 0) {
    const { data: stockRows, error: stockError } = await supabase
      .from("v_material_stock")
      .select("material_id, quantity_on_hand, primary_supplier_id, primary_supplier_code, primary_supplier_name")
      .in("material_id", materialIds);
    if (stockError) throw new Error(stockError.message);
    for (const s of (stockRows ?? []) as Record<string, unknown>[]) {
      const materialId = s["material_id"] as string | undefined;
      if (materialId) stockByMaterialId.set(materialId, s);
    }
  }

  const legacyIds = [
    ...new Set(
      materials
        .map((r) => r["legacy_product_id"] as string | null | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const unitPriceByLegacyId = new Map<string, number>();
  if (legacyIds.length > 0) {
    const { data: priceRows, error: priceErr } = await supabase
      .from("products")
      .select("id, unit_price")
      .in("id", legacyIds);
    if (priceErr) throw new Error(priceErr.message);
    for (const pr of (priceRows ?? []) as Record<string, unknown>[]) {
      const pid = pr["id"] as string;
      unitPriceByLegacyId.set(pid, Number(pr["unit_price"] ?? 0));
    }
  }

  const rows: MaterialRow[] = materials.map((r: Record<string, unknown>) => {
    const stock = stockByMaterialId.get(r["id"] as string) ?? null;
    const leg = (r["legacy_product_id"] as string | null) ?? null;
    return {
      id: r["id"] as string,
      legacy_product_id: leg,
      code: r["code"] as string,
      name: r["name"] as string,
      unit: r["unit"] as string,
      unit_price: leg ? (unitPriceByLegacyId.get(leg) ?? 0) : 0,
      is_active: Boolean(r["is_active"]),
      quantity_on_hand: Number(stock?.["quantity_on_hand"] ?? 0),
      primary_supplier_id: (stock?.["primary_supplier_id"] as string | null) ?? null,
      primary_supplier_code: (stock?.["primary_supplier_code"] as string | null) ?? null,
      primary_supplier_name: (stock?.["primary_supplier_name"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
    };
  });

  return { rows, total: count ?? 0 };
}

const schema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  unit: z.string().min(1).max(50),
  unit_price: z.coerce.number().min(0).optional().default(0),
  is_active: z.boolean().optional(),
});

export async function createMaterial(input: z.infer<typeof schema>) {
  const row = schema.parse(input);
  const supabase = createSupabaseAdmin();

  // Keep stock_lines FK compatibility by provisioning an internal legacy product row.
  const { data: prod, error: pe } = await supabase
    .from("products")
    .insert({
      code: row.code,
      name: row.name,
      unit: row.unit,
      unit_price: row.unit_price ?? 0,
      warranty_years: null,
      is_active: row.is_active ?? true,
      product_usage: "inventory",
    })
    .select("id")
    .single();
  if (pe || !prod) throw new Error(pe?.message ?? "Không tạo được legacy product.");

  const { error } = await supabase.from("materials").insert({
    legacy_product_id: prod["id"] as string,
    code: row.code,
    name: row.name,
    unit: row.unit,
    is_active: row.is_active ?? true,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
}

export async function updateMaterial(id: string, input: z.infer<typeof schema>) {
  const row = schema.parse(input);
  const supabase = createSupabaseAdmin();
  const { data: cur, error: ce } = await supabase
    .from("materials")
    .select("legacy_product_id")
    .eq("id", id)
    .single();
  if (ce || !cur) throw new Error(ce?.message ?? "Không tìm thấy NVL.");

  const legacyId = (cur["legacy_product_id"] as string | null) ?? null;
  const { error } = await supabase
    .from("materials")
    .update({
      code: row.code,
      name: row.name,
      unit: row.unit,
      is_active: row.is_active ?? true,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (legacyId) {
    const { error: pe } = await supabase
      .from("products")
      .update({
        code: row.code,
        name: row.name,
        unit: row.unit,
        unit_price: row.unit_price ?? 0,
        is_active: row.is_active ?? true,
        product_usage: "inventory",
      })
      .eq("id", legacyId);
    if (pe) throw new Error(pe.message);
  }

  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
}

export async function deleteMaterial(id: string) {
  const supabase = createSupabaseAdmin();
  const { data: cur, error: ce } = await supabase
    .from("materials")
    .select("legacy_product_id")
    .eq("id", id)
    .single();
  if (ce || !cur) throw new Error(ce?.message ?? "Không tìm thấy NVL.");
  const legacyId = (cur["legacy_product_id"] as string | null) ?? null;

  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (legacyId) {
    const { error: pe } = await supabase.from("products").delete().eq("id", legacyId);
    if (pe) throw new Error(pe.message);
  }

  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
}

export async function listMaterialPicker() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("materials")
    .select("legacy_product_id, code, name")
    .eq("is_active", true)
    .order("code", { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((r) => !!r["legacy_product_id"]);
  const legacyIds = [...new Set(rows.map((r) => r["legacy_product_id"] as string))];
  const unitPriceByLegacyId = new Map<string, number>();
  if (legacyIds.length > 0) {
    const { data: priceRows, error: priceErr } = await supabase
      .from("products")
      .select("id, unit_price")
      .in("id", legacyIds);
    if (priceErr) throw new Error(priceErr.message);
    for (const pr of (priceRows ?? []) as Record<string, unknown>[]) {
      unitPriceByLegacyId.set(pr["id"] as string, Number(pr["unit_price"] ?? 0));
    }
  }
  return rows.map((r) => {
    const lid = r["legacy_product_id"] as string;
    return {
      id: lid,
      code: r["code"] as string,
      name: r["name"] as string,
      unit_price: unitPriceByLegacyId.get(lid) ?? 0,
      product_usage: "inventory" as const,
    };
  });
}
