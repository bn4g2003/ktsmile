"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";

export type CashRow = {
  id: string;
  transaction_date: string;
  doc_number: string;
  payment_channel: string;
  direction: "receipt" | "payment";
  business_category: string;
  amount: number;
  partner_id: string | null;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  contract_id: string | null;
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
  contract_number?: string | null;
  contract_title?: string | null;
};

export async function listCashTransactions(
  args: ListArgs,
): Promise<ListResult<CashRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("cash_transactions").select(
    "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, description, reference_type, reference_id, contract_id, created_at, updated_at, partners:partner_id(code,name), partner_contracts:contract_id(contract_number,title)",
    { count: "exact" },
  );

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or(
      "doc_number.ilike." +
        p +
        ",business_category.ilike." +
        p +
        ",description.ilike." +
        p +
        ",payment_channel.ilike." +
        p,
    );
  }
  if (filters.direction) q = q.eq("direction", filters.direction);
  if (filters.payment_channel?.trim())
    q = q.ilike("payment_channel", "%" + filters.payment_channel.trim() + "%");
  if (filters.business_category?.trim())
    q = q.ilike("business_category", "%" + filters.business_category.trim() + "%");
  if (filters.transaction_date_from?.trim())
    q = q.gte("transaction_date", filters.transaction_date_from.trim());
  if (filters.transaction_date_to?.trim())
    q = q.lte("transaction_date", filters.transaction_date_to.trim());

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("transaction_date", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows: CashRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const partners = r["partners"] as { code?: string; name?: string } | null;
    const ctr = r["partner_contracts"] as { contract_number?: string; title?: string } | null;
    return {
      id: r["id"] as string,
      transaction_date: r["transaction_date"] as string,
      doc_number: r["doc_number"] as string,
      payment_channel: r["payment_channel"] as string,
      direction: r["direction"] as "receipt" | "payment",
      business_category: r["business_category"] as string,
      amount: Number(r["amount"]),
      partner_id: (r["partner_id"] as string | null) ?? null,
      description: (r["description"] as string | null) ?? null,
      reference_type: (r["reference_type"] as string | null) ?? null,
      reference_id: (r["reference_id"] as string | null) ?? null,
      contract_id: (r["contract_id"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      partner_code: partners?.code,
      partner_name: partners?.name,
      contract_number: ctr?.contract_number,
      contract_title: ctr?.title,
    };
  });

  return { rows, total: count ?? 0 };
}

const cashSchema = z.object({
  transaction_date: z.string().min(1),
  doc_number: z.string().min(1).max(200),
  payment_channel: z.string().min(1).max(100),
  direction: z.enum(["receipt", "payment"]),
  business_category: z.string().min(1).max(200),
  amount: z.coerce.number().positive(),
  partner_id: z.string().uuid().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  reference_type: z.string().max(100).optional().nullable(),
  reference_id: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  contract_id: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

async function assertContractMatchesPartner(
  supabase: SupabaseClient,
  contractId: string | null,
  partnerId: string | null,
) {
  if (!contractId) return;
  if (!partnerId) {
    throw new Error("Chọn đối tượng khi gắn hợp đồng.");
  }
  const { data, error } = await supabase
    .from("partner_contracts")
    .select("partner_id")
    .eq("id", contractId)
    .single();
  if (error || !data) throw new Error("Hợp đồng không tồn tại.");
  if ((data as { partner_id: string }).partner_id !== partnerId) {
    throw new Error("Hợp đồng không thuộc đối tượng đã chọn.");
  }
}

export async function createCashTransaction(input: z.infer<typeof cashSchema>) {
  const supabase = createSupabaseAdmin();
  const row = cashSchema.parse(input);
  await assertContractMatchesPartner(supabase, row.contract_id, row.partner_id);
  const { error } = await supabase.from("cash_transactions").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting/cash");
}

export async function updateCashTransaction(
  id: string,
  input: z.infer<typeof cashSchema>,
) {
  const supabase = createSupabaseAdmin();
  const row = cashSchema.parse(input);
  await assertContractMatchesPartner(supabase, row.contract_id, row.partner_id);
  const { error } = await supabase.from("cash_transactions").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting/cash");
}

export async function deleteCashTransaction(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("cash_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting/cash");
}

export type CashFlowTotals = {
  receipt: number;
  payment: number;
  dateFrom: string;
  dateTo: string;
};

/** Tổng thu / chi trong khoảng ngày (YYYY-MM-DD). */
export async function getCashFlowTotalsForRange(
  dateFrom: string,
  dateTo: string,
): Promise<CashFlowTotals> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("cash_transactions")
    .select("direction, amount")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);
  if (error) throw new Error(error.message);
  let receipt = 0;
  let payment = 0;
  for (const r of data ?? []) {
    const row = r as { direction: string; amount: number };
    const a = Number(row.amount);
    if (row.direction === "receipt") receipt += a;
    else payment += a;
  }
  return { receipt, payment, dateFrom, dateTo };
}
