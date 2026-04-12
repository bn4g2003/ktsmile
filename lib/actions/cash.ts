"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { decodeMultiFilter } from "@/lib/grid/multi-filter";

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
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
};

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
});

function cashInsertPayload(row: z.infer<typeof cashSchema>) {
  return {
    transaction_date: row.transaction_date,
    doc_number: row.doc_number,
    payment_channel: row.payment_channel,
    direction: row.direction,
    business_category: row.business_category,
    amount: row.amount,
    partner_id: row.partner_id ?? null,
    description: row.description ?? null,
    reference_type: row.reference_type ?? null,
    reference_id: row.reference_id ?? null,
  };
}

export async function listCashTransactions(
  args: ListArgs,
): Promise<ListResult<CashRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("cash_transactions").select(
    "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, description, reference_type, reference_id, created_at, updated_at, partners:partner_id(code,name)",
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
  const dirs = decodeMultiFilter(filters.direction);
  if (dirs.length === 1) q = q.eq("direction", dirs[0]!);
  else if (dirs.length > 1) q = q.in("direction", dirs);
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
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      partner_code: partners?.code ?? null,
      partner_name: partners?.name ?? null,
    };
  });

  return { rows, total: count ?? 0 };
}

export async function createCashTransaction(input: z.infer<typeof cashSchema>) {
  const supabase = createSupabaseAdmin();
  const row = cashSchema.parse(input);
  const { error } = await supabase.from("cash_transactions").insert(cashInsertPayload(row));
  if (error) throw new Error(error.message);
  revalidatePath("/accounting/cash");
}

export async function updateCashTransaction(
  id: string,
  input: z.infer<typeof cashSchema>,
) {
  const supabase = createSupabaseAdmin();
  const row = cashSchema.parse(input);
  const { error } = await supabase
    .from("cash_transactions")
    .update(cashInsertPayload(row))
    .eq("id", id);
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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CashLedgerChannelRow = {
  channelKey: string;
  label: string;
  /** Cùng nguồn với tồn đầu kỳ (số dư lũy kế trước kỳ báo cáo). */
  openingBook: number;
  openingPeriod: number;
  receiptInPeriod: number;
  paymentInPeriod: number;
  closing: number;
};

export type CashLedgerSummary = {
  dateFrom: string;
  dateTo: string;
  rows: CashLedgerChannelRow[];
  totals: {
    openingBook: number;
    openingPeriod: number;
    receiptInPeriod: number;
    paymentInPeriod: number;
    closing: number;
  };
};

function cashLedgerLabel(channelKey: string, displayRaw: string): string {
  if (channelKey === "cash") return "Tất cả Tiền mặt";
  const d = displayRaw.trim();
  return d.length ? d : channelKey;
}

/**
 * Bảng thu–chi–tồn theo kênh thanh toán (mẫu «THU CHI VÀ TỒN QUỸ»).
 * Tồn đầu kỳ = thu trừ chi trước ngày `dateFrom`; trong kỳ: [dateFrom, dateTo].
 */
export async function getCashLedgerSummary(
  dateFrom: string,
  dateTo: string,
): Promise<CashLedgerSummary> {
  const from = dateFrom.trim();
  const to = dateTo.trim();
  if (!from || !to) throw new Error("Thiếu khoảng ngày.");
  if (from > to) throw new Error("Từ ngày không được sau Đến ngày.");

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("cash_transactions")
    .select("transaction_date, payment_channel, direction, amount")
    .lte("transaction_date", to);
  if (error) throw new Error(error.message);

  type Agg = { key: string; display: string; openR: number; openP: number; inR: number; inP: number };
  const byKey = new Map<string, Agg>();

  for (const raw of data ?? []) {
    const r = raw as {
      transaction_date: string;
      payment_channel: string;
      direction: string;
      amount: number;
    };
    const rawCh = String(r.payment_channel ?? "").trim();
    const key = rawCh.toLowerCase() || "(trống)";
    let a = byKey.get(key);
    if (!a) {
      a = { key, display: rawCh || key, openR: 0, openP: 0, inR: 0, inP: 0 };
      byKey.set(key, a);
    }
    const amt = Number(r.amount);
    if (!Number.isFinite(amt)) continue;
    const d = r.transaction_date;
    if (d < from) {
      if (r.direction === "receipt") a.openR += amt;
      else a.openP += amt;
    } else {
      if (r.direction === "receipt") a.inR += amt;
      else a.inP += amt;
    }
  }

  const rows: CashLedgerChannelRow[] = [];
  for (const a of byKey.values()) {
    const opening = roundMoney(a.openR - a.openP);
    const receiptInPeriod = roundMoney(a.inR);
    const paymentInPeriod = roundMoney(a.inP);
    const closing = roundMoney(opening + receiptInPeriod - paymentInPeriod);
    rows.push({
      channelKey: a.key,
      label: cashLedgerLabel(a.key, a.display),
      openingBook: opening,
      openingPeriod: opening,
      receiptInPeriod,
      paymentInPeriod,
      closing,
    });
  }

  rows.sort((x, y) => {
    if (x.channelKey === "cash") return -1;
    if (y.channelKey === "cash") return 1;
    return x.label.localeCompare(y.label, "vi");
  });

  const totals = rows.reduce(
    (acc, r) => ({
      openingBook: roundMoney(acc.openingBook + r.openingBook),
      openingPeriod: roundMoney(acc.openingPeriod + r.openingPeriod),
      receiptInPeriod: roundMoney(acc.receiptInPeriod + r.receiptInPeriod),
      paymentInPeriod: roundMoney(acc.paymentInPeriod + r.paymentInPeriod),
      closing: roundMoney(acc.closing + r.closing),
    }),
    {
      openingBook: 0,
      openingPeriod: 0,
      receiptInPeriod: 0,
      paymentInPeriod: 0,
      closing: 0,
    },
  );

  return { dateFrom: from, dateTo: to, rows, totals };
}

/** Tổng thu / chi trong khoảng ngày (YYYY-MM-DD). */
export async function getCashFlowTotalsForRange(
  dateFrom: string,
  dateTo: string,
): Promise<CashFlowTotals> {
  const s = await getCashLedgerSummary(dateFrom, dateTo);
  return {
    receipt: s.totals.receiptInPeriod,
    payment: s.totals.paymentInPeriod,
    dateFrom: s.dateFrom,
    dateTo: s.dateTo,
  };
}
