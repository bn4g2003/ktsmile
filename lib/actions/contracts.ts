"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";

export type ContractRow = {
  id: string;
  partner_id: string;
  contract_number: string;
  title: string;
  signed_date: string | null;
  valid_from: string;
  valid_to: string | null;
  status: "draft" | "active" | "closed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
};

export async function listContracts(args: ListArgs): Promise<ListResult<ContractRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("partner_contracts").select(
    "id, partner_id, contract_number, title, signed_date, valid_from, valid_to, status, notes, created_at, updated_at, partners:partner_id(code,name)",
    { count: "exact" },
  );

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("contract_number.ilike." + p + ",title.ilike." + p + ",notes.ilike." + p);
  }
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.contract_number?.trim())
    q = q.ilike("contract_number", "%" + filters.contract_number.trim() + "%");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("valid_from", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows: ContractRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const pr = r["partners"] as { code?: string; name?: string } | null;
    return {
      id: r["id"] as string,
      partner_id: r["partner_id"] as string,
      contract_number: r["contract_number"] as string,
      title: r["title"] as string,
      signed_date: (r["signed_date"] as string | null) ?? null,
      valid_from: r["valid_from"] as string,
      valid_to: (r["valid_to"] as string | null) ?? null,
      status: r["status"] as ContractRow["status"],
      notes: (r["notes"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      partner_code: pr?.code,
      partner_name: pr?.name,
    };
  });

  return { rows, total: count ?? 0 };
}

/** Chọn hợp đồng trong form phiếu thu — lọc theo partner nếu có. */
export async function listContractPicker(partnerId?: string | null) {
  const supabase = createSupabaseAdmin();
  let q = supabase
    .from("partner_contracts")
    .select("id, contract_number, title, partner_id, status")
    .in("status", ["draft", "active"])
    .order("contract_number", { ascending: true });
  if (partnerId) q = q.eq("partner_id", partnerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    contract_number: string;
    title: string;
    partner_id: string;
    status: string;
  }[];
}

const contractSchema = z.object({
  partner_id: z.string().uuid(),
  contract_number: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  signed_date: z.string().max(30).nullable().optional(),
  valid_from: z.string().min(1),
  valid_to: z.string().max(30).nullable().optional(),
  status: z.enum(["draft", "active", "closed", "cancelled"]),
  notes: z.string().max(2000).nullable().optional(),
});

function normalizeContractRow(row: z.infer<typeof contractSchema>) {
  return {
    partner_id: row.partner_id,
    contract_number: row.contract_number,
    title: row.title,
    signed_date: row.signed_date?.trim() ? row.signed_date.trim() : null,
    valid_from: row.valid_from,
    valid_to: row.valid_to?.trim() ? row.valid_to.trim() : null,
    status: row.status,
    notes: row.notes?.trim() ? row.notes.trim() : null,
  };
}

export async function createContract(input: z.infer<typeof contractSchema>) {
  const supabase = createSupabaseAdmin();
  const row = normalizeContractRow(contractSchema.parse(input));
  const { error } = await supabase.from("partner_contracts").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/master/contracts");
}

export async function updateContract(id: string, input: z.infer<typeof contractSchema>) {
  const supabase = createSupabaseAdmin();
  const row = normalizeContractRow(contractSchema.parse(input));
  const { error } = await supabase.from("partner_contracts").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/contracts");
}

export async function deleteContract(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("partner_contracts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/contracts");
}
