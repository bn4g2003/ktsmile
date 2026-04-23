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
  partner_type: "customer_clinic" | "customer_labo";
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

function intersectPartnerTypes(
  grid: string[],
  scope: PartnerRow["partner_type"][],
): PartnerRow["partner_type"][] {
  const allowed = new Set(scope);
  if (grid.length === 0) return [...scope];
  const hit = grid.filter((x) => allowed.has(x as PartnerRow["partner_type"])) as PartnerRow["partner_type"][];
  return hit.length ? hit : [...scope];
}

async function listPartnersScoped(
  args: ListArgs,
  scope: PartnerRow["partner_type"][] | null,
): Promise<ListResult<PartnerRow>> {
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

  const ptGrid = decodeMultiFilter(filters.partner_type);
  if (scope) {
    const useTypes = intersectPartnerTypes(ptGrid, scope);
    if (useTypes.length === 1) q = q.eq("partner_type", useTypes[0]!);
    else q = q.in("partner_type", useTypes);
  } else {
    if (ptGrid.length === 1) q = q.eq("partner_type", ptGrid[0]!);
    else if (ptGrid.length > 1) q = q.in("partner_type", ptGrid);
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
  return { rows: (data ?? []) as PartnerRow[], total: count ?? 0 };
}

/** Tất cả đối tác khách hàng (phòng khám/labo). */
export async function listPartners(args: ListArgs): Promise<ListResult<PartnerRow>> {
  return listPartnersScoped(args, ["customer_clinic", "customer_labo"]);
}

/** Chỉ khách phòng khám & labo — dùng tab Khách hàng. */
export async function listCustomerPartners(args: ListArgs): Promise<ListResult<PartnerRow>> {
  return listPartnersScoped(args, ["customer_clinic", "customer_labo"]);
}

const partnerSchema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  partner_type: z.enum(["customer_clinic", "customer_labo"]),
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
  return listCustomerPartnerPicker();
}

/** Một dòng khách trong combobox — thêm địa chỉ/SĐT/MST phục vụ in hóa đơn báo phí. */
export type CustomerPartnerPickerRow = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
};

/** Chỉ khách (phòng khám / labo) — đơn phục hình không chọn NCC. */
export async function listCustomerPartnerPicker(): Promise<CustomerPartnerPickerRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("partners")
    .select("id, code, name, phone, address, tax_id")
    .in("partner_type", ["customer_clinic", "customer_labo"])
    .order("code", { ascending: true })
    .limit(3000);
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerPartnerPickerRow[];
}

