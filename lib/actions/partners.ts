"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { decodeMultiFilter, narrowIsActiveFilter } from "@/lib/grid/multi-filter";

export type PartnerRow = {
  id: string;
  code: string;
  name: string;
  partner_type: "customer_clinic" | "customer_labo" | "supplier";
  representative_name: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  default_discount_percent: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listPartners(args: ListArgs): Promise<ListResult<PartnerRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("partners").select("*", { count: "exact" });

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g.replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";
    q = q.or(
      "code.ilike." +
        p +
        ",name.ilike." +
        p +
        ",phone.ilike." +
        p +
        ",representative_name.ilike." +
        p,
    );
  }

  const pt = decodeMultiFilter(filters.partner_type);
  if (pt.length === 1) q = q.eq("partner_type", pt[0]!);
  else if (pt.length > 1) q = q.in("partner_type", pt);
  const activeOnly = narrowIsActiveFilter(filters.is_active);
  if (activeOnly !== null) q = q.eq("is_active", activeOnly);
  if (filters.code?.trim()) q = q.ilike("code", "%" + filters.code.trim() + "%");
  if (filters.name?.trim()) q = q.ilike("name", "%" + filters.name.trim() + "%");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("code", { ascending: true }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as PartnerRow[], total: count ?? 0 };
}

const partnerSchema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  partner_type: z.enum(["customer_clinic", "customer_labo", "supplier"]),
  representative_name: z.string().max(500).optional().nullable(),
  phone: z.string().max(100).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  tax_id: z.string().max(100).optional().nullable(),
  default_discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function createPartner(input: z.infer<typeof partnerSchema>) {
  const supabase = createSupabaseAdmin();
  const row = partnerSchema.parse(input);
  const { error } = await supabase.from("partners").insert({
    ...row,
    default_discount_percent: row.default_discount_percent ?? 0,
    is_active: row.is_active ?? true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/master/partners");
}

export async function updatePartner(
  id: string,
  input: z.infer<typeof partnerSchema>,
) {
  const supabase = createSupabaseAdmin();
  const row = partnerSchema.parse(input);
  const { error } = await supabase.from("partners").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/partners");
}

export async function deletePartner(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/partners");
}

export async function listPartnerPicker() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("partners")
    .select("id, code, name")
    .order("code", { ascending: true })
    .limit(3000);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; code: string; name: string }[];
}

