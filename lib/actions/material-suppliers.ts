"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type MaterialSupplierLinkRow = {
  id: string;
  material_id: string;
  supplier_id: string;
  supplier_code: string | null;
  supplier_name: string | null;
  supplier_sku: string | null;
  reference_purchase_price: number | null;
  lead_time_days: number | null;
  notes: string | null;
  is_primary: boolean;
};

export async function listMaterialSupplierLinks(materialId: string): Promise<MaterialSupplierLinkRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("material_suppliers")
    .select("*, suppliers:supplier_id(code,name)")
    .eq("material_id", materialId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const s = r["suppliers"] as { code?: string; name?: string } | null;
    return {
      id: r["id"] as string,
      material_id: r["material_id"] as string,
      supplier_id: r["supplier_id"] as string,
      supplier_code: s?.code ?? null,
      supplier_name: s?.name ?? null,
      supplier_sku: (r["supplier_sku"] as string | null) ?? null,
      reference_purchase_price:
        r["reference_purchase_price"] != null ? Number(r["reference_purchase_price"]) : null,
      lead_time_days: r["lead_time_days"] != null ? Number(r["lead_time_days"]) : null,
      notes: (r["notes"] as string | null) ?? null,
      is_primary: Boolean(r["is_primary"]),
    };
  });
}

const linkSchema = z.object({
  material_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_sku: z.string().max(200).optional().nullable(),
  reference_purchase_price: z.coerce.number().min(0).optional().nullable(),
  lead_time_days: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  is_primary: z.boolean().optional(),
});

export async function upsertMaterialSupplierLink(input: z.infer<typeof linkSchema>) {
  const row = linkSchema.parse(input);
  const supabase = createSupabaseAdmin();
  if (row.is_primary) {
    const { error: e1 } = await supabase
      .from("material_suppliers")
      .update({ is_primary: false })
      .eq("material_id", row.material_id);
    if (e1) throw new Error(e1.message);
  }
  const { error } = await supabase.from("material_suppliers").upsert(
    {
      material_id: row.material_id,
      supplier_id: row.supplier_id,
      supplier_sku: row.supplier_sku?.trim() || null,
      reference_purchase_price: row.reference_purchase_price ?? null,
      lead_time_days: row.lead_time_days ?? null,
      notes: row.notes?.trim() || null,
      is_primary: row.is_primary ?? false,
    },
    { onConflict: "material_id,supplier_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/documents");
}

export async function setPrimaryMaterialSupplier(materialId: string, supplierId: string) {
  const supabase = createSupabaseAdmin();
  const { error: e1 } = await supabase
    .from("material_suppliers")
    .update({ is_primary: false })
    .eq("material_id", materialId);
  if (e1) throw new Error(e1.message);
  const { data: setRow, error: e2 } = await supabase
    .from("material_suppliers")
    .update({ is_primary: true })
    .eq("material_id", materialId)
    .eq("supplier_id", supplierId)
    .select("id")
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (!setRow) throw new Error("Chưa có liên kết NCC này cho NVL.");
  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/documents");
}

export async function deleteMaterialSupplierLink(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("material_suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/products");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/documents");
}
