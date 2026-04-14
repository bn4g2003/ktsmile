"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";

function relationMissing(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("material_suppliers") || m.includes("materials") || m.includes("does not exist");
}

async function resolveMaterialIdByLegacyProductId(productId: string): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("materials")
    .select("id")
    .eq("legacy_product_id", productId)
    .maybeSingle();
  if (error) {
    if (relationMissing(error)) return null;
    throw new Error(error.message);
  }
  return (data?.["id"] as string | undefined) ?? null;
}

export type ProductSupplierLinkRow = {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_code: string | null;
  supplier_name: string | null;
  supplier_sku: string | null;
  reference_purchase_price: number | null;
  lead_time_days: number | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export async function listProductSupplierLinks(productId: string): Promise<ProductSupplierLinkRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("product_suppliers")
    .select("*, suppliers:supplier_id(code,name)")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const s = r["suppliers"] as { code?: string; name?: string } | null;
    return {
      id: r["id"] as string,
      product_id: r["product_id"] as string,
      supplier_id: r["supplier_id"] as string,
      supplier_code: s?.code ?? null,
      supplier_name: s?.name ?? null,
      supplier_sku: (r["supplier_sku"] as string | null) ?? null,
      reference_purchase_price:
        r["reference_purchase_price"] != null ? Number(r["reference_purchase_price"]) : null,
      lead_time_days: r["lead_time_days"] != null ? Number(r["lead_time_days"]) : null,
      notes: (r["notes"] as string | null) ?? null,
      is_primary: Boolean(r["is_primary"]),
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
    };
  });
}

const linkSchema = z.object({
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_sku: z.string().max(200).optional().nullable(),
  reference_purchase_price: z.coerce.number().min(0).optional().nullable(),
  lead_time_days: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  is_primary: z.boolean().optional(),
});

export async function upsertProductSupplierLink(input: z.infer<typeof linkSchema>) {
  const row = linkSchema.parse(input);
  const supabase = createSupabaseAdmin();
  if (row.is_primary) {
    const { error: e1 } = await supabase
      .from("product_suppliers")
      .update({ is_primary: false })
      .eq("product_id", row.product_id);
    if (e1) throw new Error(e1.message);
  }
  const { error } = await supabase.from("product_suppliers").upsert(
    {
      product_id: row.product_id,
      supplier_id: row.supplier_id,
      supplier_sku: row.supplier_sku?.trim() || null,
      reference_purchase_price: row.reference_purchase_price ?? null,
      lead_time_days: row.lead_time_days ?? null,
      notes: row.notes?.trim() || null,
      is_primary: row.is_primary ?? false,
    },
    { onConflict: "product_id,supplier_id" },
  );
  if (error) throw new Error(error.message);

  const materialId = await resolveMaterialIdByLegacyProductId(row.product_id);
  if (materialId) {
    if (row.is_primary) {
      const { error: me1 } = await supabase
        .from("material_suppliers")
        .update({ is_primary: false })
        .eq("material_id", materialId);
      if (me1 && !relationMissing(me1)) throw new Error(me1.message);
    }
    const { error: me2 } = await supabase.from("material_suppliers").upsert(
      {
        material_id: materialId,
        supplier_id: row.supplier_id,
        supplier_sku: row.supplier_sku?.trim() || null,
        reference_purchase_price: row.reference_purchase_price ?? null,
        lead_time_days: row.lead_time_days ?? null,
        notes: row.notes?.trim() || null,
        is_primary: row.is_primary ?? false,
      },
      { onConflict: "material_id,supplier_id" },
    );
    if (me2 && !relationMissing(me2)) throw new Error(me2.message);
  }

  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/documents");
}

export async function setPrimaryProductSupplier(productId: string, supplierId: string) {
  const supabase = createSupabaseAdmin();
  const { error: e1 } = await supabase
    .from("product_suppliers")
    .update({ is_primary: false })
    .eq("product_id", productId);
  if (e1) throw new Error(e1.message);
  const { data: setRow, error: e2 } = await supabase
    .from("product_suppliers")
    .update({ is_primary: true })
    .eq("product_id", productId)
    .eq("supplier_id", supplierId)
    .select("id")
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (!setRow) throw new Error("Chưa có liên kết NCC này cho sản phẩm — thêm NCC trước.");

  const materialId = await resolveMaterialIdByLegacyProductId(productId);
  if (materialId) {
    const { error: me1 } = await supabase
      .from("material_suppliers")
      .update({ is_primary: false })
      .eq("material_id", materialId);
    if (me1 && !relationMissing(me1)) throw new Error(me1.message);
    const { data: meSet, error: me2 } = await supabase
      .from("material_suppliers")
      .update({ is_primary: true })
      .eq("material_id", materialId)
      .eq("supplier_id", supplierId)
      .select("id")
      .maybeSingle();
    if (me2 && !relationMissing(me2)) throw new Error(me2.message);
    if (me2 == null && !meSet) {
      throw new Error("NVL chưa có liên kết NCC này ở bảng material_suppliers.");
    }
  }

  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/documents");
}

export async function deleteProductSupplierLink(id: string) {
  const supabase = createSupabaseAdmin();
  const { data: prev, error: pe } = await supabase
    .from("product_suppliers")
    .select("product_id, supplier_id")
    .eq("id", id)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  const { error } = await supabase.from("product_suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);

  const productId = (prev?.["product_id"] as string | undefined) ?? null;
  const supplierId = (prev?.["supplier_id"] as string | undefined) ?? null;
  if (productId && supplierId) {
    const materialId = await resolveMaterialIdByLegacyProductId(productId);
    if (materialId) {
      const { error: me } = await supabase
        .from("material_suppliers")
        .delete()
        .eq("material_id", materialId)
        .eq("supplier_id", supplierId);
      if (me && !relationMissing(me)) throw new Error(me.message);
    }
  }

  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/documents");
}

export type ProductSupplyMatch = {
  has_link_for_document_supplier: boolean;
  primary_supplier_id: string | null;
  primary_supplier_code: string | null;
  primary_supplier_name: string | null;
  reference_purchase_price: number | null;
  supplier_sku: string | null;
};

/** Gợi ý khi lập phiếu nhập: NCC phiếu vs NCC chính & giá tham chiếu theo cặp (SP, NCC). */
export async function getProductSupplyMatch(
  productId: string,
  documentSupplierId: string | null,
): Promise<ProductSupplyMatch> {
  const supabase = createSupabaseAdmin();
  const materialId = await resolveMaterialIdByLegacyProductId(productId);

  let pr: Record<string, unknown> | null = null;
  if (materialId) {
    const { data: primM, error: peM } = await supabase
      .from("material_suppliers")
      .select("supplier_id, reference_purchase_price, supplier_sku, suppliers:supplier_id(code,name)")
      .eq("material_id", materialId)
      .eq("is_primary", true)
      .maybeSingle();
    if (peM && !relationMissing(peM)) throw new Error(peM.message);
    pr = (primM as Record<string, unknown> | null) ?? null;
  } else {
    const { data: prim, error: pe } = await supabase
      .from("product_suppliers")
      .select("supplier_id, reference_purchase_price, supplier_sku, suppliers:supplier_id(code,name)")
      .eq("product_id", productId)
      .eq("is_primary", true)
      .maybeSingle();
    if (pe) throw new Error(pe.message);
    pr = (prim as Record<string, unknown> | null) ?? null;
  }
  const sup = pr?.["suppliers"] as { code?: string; name?: string } | null;
  const primary_supplier_id = (pr?.["supplier_id"] as string | null) ?? null;
  const primary_supplier_code = sup?.code ?? null;
  const primary_supplier_name = sup?.name ?? null;

  let has_link_for_document_supplier = false;
  let reference_purchase_price: number | null = null;
  let supplier_sku: string | null = null;

  if (documentSupplierId) {
    let row: Record<string, unknown> | null = null;
    if (materialId) {
      const { data: rM, error: leM } = await supabase
        .from("material_suppliers")
        .select("reference_purchase_price, supplier_sku")
        .eq("material_id", materialId)
        .eq("supplier_id", documentSupplierId)
        .maybeSingle();
      if (leM && !relationMissing(leM)) throw new Error(leM.message);
      row = (rM as Record<string, unknown> | null) ?? null;
    } else {
      const { data: rP, error: le } = await supabase
        .from("product_suppliers")
        .select("reference_purchase_price, supplier_sku")
        .eq("product_id", productId)
        .eq("supplier_id", documentSupplierId)
        .maybeSingle();
      if (le) throw new Error(le.message);
      row = (rP as Record<string, unknown> | null) ?? null;
    }
    if (row) {
      has_link_for_document_supplier = true;
      reference_purchase_price =
        row["reference_purchase_price"] != null ? Number(row["reference_purchase_price"]) : null;
      supplier_sku = (row["supplier_sku"] as string | null) ?? null;
    }
  }

  return {
    has_link_for_document_supplier,
    primary_supplier_id,
    primary_supplier_code,
    primary_supplier_name,
    reference_purchase_price,
    supplier_sku,
  };
}

/** Vật tư đã gắn với NCC (dùng chọn dòng khi nhập hàng NVL từ NCC). */
export type SupplierPurchasableProduct = {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  product_usage: string;
  reference_purchase_price: number | null;
  supplier_sku: string | null;
  is_primary: boolean;
};

export async function listSupplierPurchasableProducts(
  supplierId: string,
): Promise<SupplierPurchasableProduct[]> {
  const supabase = createSupabaseAdmin();
  let data: Record<string, unknown>[] | null = null;
  let useMaterials = false;
  const rMat = await supabase
    .from("material_suppliers")
    .select(
      "reference_purchase_price, supplier_sku, is_primary, materials:material_id(legacy_product_id, code, name, unit)",
    )
    .eq("supplier_id", supplierId);
  if (rMat.error && !relationMissing(rMat.error)) throw new Error(rMat.error.message);
  if (!rMat.error) {
    data = (rMat.data as Record<string, unknown>[] | null) ?? [];
    useMaterials = true;
  } else {
    const rProd = await supabase
      .from("product_suppliers")
      .select(
        "reference_purchase_price, supplier_sku, is_primary, products:product_id(id, code, name, unit, product_usage)",
      )
      .eq("supplier_id", supplierId);
    if (rProd.error) throw new Error(rProd.error.message);
    data = (rProd.data as Record<string, unknown>[] | null) ?? [];
  }

  const rows: SupplierPurchasableProduct[] = (data ?? [])
    .map((r: Record<string, unknown>) => {
      const pr = (useMaterials ? r["materials"] : r["products"]) as {
        id?: string;
        legacy_product_id?: string;
        code?: string;
        name?: string;
        unit?: string;
        product_usage?: string;
      } | null;
      const productId = useMaterials ? pr?.legacy_product_id : pr?.id;
      if (!pr || !productId) return null;
      return {
        product_id: productId,
        product_code: String(pr.code ?? ""),
        product_name: String(pr.name ?? ""),
        unit: String(pr.unit ?? ""),
        product_usage: useMaterials ? "inventory" : String(pr.product_usage ?? "both"),
        reference_purchase_price:
          r["reference_purchase_price"] != null ? Number(r["reference_purchase_price"]) : null,
        supplier_sku: (r["supplier_sku"] as string | null) ?? null,
        is_primary: Boolean(r["is_primary"]),
      };
    })
    .filter((x): x is SupplierPurchasableProduct => x != null);
  rows.sort((a, b) => a.product_code.localeCompare(b.product_code, "vi"));
  return rows;
}
