"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { finiteNumber } from "@/lib/billing/order-grand-total";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isSupabaseSchemaDriftError } from "@/lib/supabase/schema-drift";
import type { CashReceiptPrintPayload } from "@/lib/reports/cash-receipt-html";
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
  supplier_id: string | null;
  payer_name: string | null;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
};

const cashSchema = z.object({
  transaction_date: z.string().min(1),
  /** Để trống khi tạo mới → server cấp PT-yyyymmdd-xxx / PC-yyyymmdd-xxx */
  doc_number: z.string().max(200),
  payment_channel: z.string().min(1).max(100),
  direction: z.enum(["receipt", "payment"]),
  business_category: z.string().min(1).max(200),
  amount: z.coerce.number().positive(),
  partner_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  payer_name: z.string().max(500).optional().nullable(),
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
    supplier_id: row.supplier_id ?? null,
    payer_name: row.payer_name?.trim() ? row.payer_name.trim() : null,
    description: row.description ?? null,
    reference_type: row.reference_type ?? null,
    reference_id: row.reference_id ?? null,
  };
}

/** Có `payer_name` (migration 20260419120000). */
const CASH_LIST_SELECT_FULL =
  "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, supplier_id, payer_name, description, reference_type, reference_id, created_at, updated_at, partners!cash_transactions_partner_id_fkey(code,name), suppliers!cash_transactions_supplier_id_fkey(code,name)";

/** Schema ban đầu, chưa có cột payer_name. */
const CASH_LIST_SELECT_LEGACY =
  "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, supplier_id, description, reference_type, reference_id, created_at, updated_at, partners!cash_transactions_partner_id_fkey(code,name), suppliers!cash_transactions_supplier_id_fkey(code,name)";

/** Không nhúng partners (tránh lỗi embed hiếm gặp). */
const CASH_LIST_SELECT_NO_EMBED =
  "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, supplier_id, payer_name, description, reference_type, reference_id, created_at, updated_at";

/** Vừa không embed vừa chưa có cột payer_name (migration chưa chạy + FK embed lỗi). */
const CASH_LIST_SELECT_MINIMAL =
  "id, transaction_date, doc_number, payment_channel, direction, business_category, amount, partner_id, supplier_id, description, reference_type, reference_id, created_at, updated_at";

function mapCashListRow(r: Record<string, unknown>): CashRow {
  const partners = r["partners"] as { code?: string; name?: string } | null;
  const suppliers = r["suppliers"] as { code?: string; name?: string } | null;
  return {
    id: r["id"] as string,
    transaction_date: r["transaction_date"] as string,
    doc_number: r["doc_number"] as string,
    payment_channel: r["payment_channel"] as string,
    direction: r["direction"] as "receipt" | "payment",
    business_category: r["business_category"] as string,
    amount: finiteNumber(r["amount"]),
    partner_id: (r["partner_id"] as string | null) ?? null,
    supplier_id: (r["supplier_id"] as string | null) ?? null,
    payer_name: (r["payer_name"] as string | null) ?? null,
    description: (r["description"] as string | null) ?? null,
    reference_type: (r["reference_type"] as string | null) ?? null,
    reference_id: (r["reference_id"] as string | null) ?? null,
    created_at: r["created_at"] as string,
    updated_at: r["updated_at"] as string,
    partner_code: partners?.code ?? null,
    partner_name: partners?.name ?? null,
    supplier_code: suppliers?.code ?? null,
    supplier_name: suppliers?.name ?? null,
  };
}

export async function listCashTransactions(
  args: ListArgs,
): Promise<ListResult<CashRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let partnerIdsByFilter: string[] | null = null;
  if (args.filters.partner_code?.trim() || args.filters.partner_name?.trim()) {
    let pq = supabase.from("partners").select("id").limit(5000);
    if (args.filters.partner_code?.trim()) {
      pq = pq.ilike("code", "%" + args.filters.partner_code.trim() + "%");
    }
    if (args.filters.partner_name?.trim()) {
      pq = pq.ilike("name", "%" + args.filters.partner_name.trim() + "%");
    }
    const { data, error } = await pq;
    if (error) throw new Error(error.message);
    partnerIdsByFilter = (data ?? []).map((r) => r.id as string);
    if (!partnerIdsByFilter.length) return { rows: [], total: 0 };
  }
  let supplierIdsByFilter: string[] | null = null;
  if (args.filters.supplier_code?.trim() || args.filters.supplier_name?.trim()) {
    let sq = supabase.from("suppliers").select("id").limit(5000);
    if (args.filters.supplier_code?.trim()) {
      sq = sq.ilike("code", "%" + args.filters.supplier_code.trim() + "%");
    }
    if (args.filters.supplier_name?.trim()) {
      sq = sq.ilike("name", "%" + args.filters.supplier_name.trim() + "%");
    }
    const { data, error } = await sq;
    if (error) throw new Error(error.message);
    supplierIdsByFilter = (data ?? []).map((r) => r.id as string);
    if (!supplierIdsByFilter.length) return { rows: [], total: 0 };
  }

  const selects = [
    CASH_LIST_SELECT_FULL,
    CASH_LIST_SELECT_LEGACY,
    CASH_LIST_SELECT_NO_EMBED,
    CASH_LIST_SELECT_MINIMAL,
  ];
  let lastMessage = "";
  for (let i = 0; i < selects.length; i++) {
    const sel = selects[i]!;
    let q = supabase.from("cash_transactions").select(sel, { count: "exact" });

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
    if (filters.doc_number?.trim())
      q = q.ilike("doc_number", "%" + filters.doc_number.trim() + "%");
    if (filters.business_category?.trim())
      q = q.ilike("business_category", "%" + filters.business_category.trim() + "%");
    if (filters.payer_name?.trim()) q = q.ilike("payer_name", "%" + filters.payer_name.trim() + "%");
    if (partnerIdsByFilter) q = q.in("partner_id", partnerIdsByFilter);
    if (supplierIdsByFilter) q = q.in("supplier_id", supplierIdsByFilter);
    if (filters.transaction_date_from?.trim())
      q = q.gte("transaction_date", filters.transaction_date_from.trim());
    if (filters.transaction_date_to?.trim())
      q = q.lte("transaction_date", filters.transaction_date_to.trim());
    if (filters.transaction_date_eq?.trim())
      q = q.eq("transaction_date", filters.transaction_date_eq.trim());

    q = q.order("transaction_date", { ascending: false }).range(from, to);
    const { data, error, count } = await q;
    if (!error) {
      const rows: CashRow[] = (data ?? []).map((row) =>
        mapCashListRow(row as unknown as Record<string, unknown>),
      );
      return { rows, total: count ?? 0 };
    }
    lastMessage = error.message;
    const retry = i < selects.length - 1 && isSupabaseSchemaDriftError(error.message);
    if (!retry) {
      throw new Error(
        error.message +
          (isSupabaseSchemaDriftError(error.message)
            ? " — Chạy migration SQL trên Supabase (ví dụ 20260419120000_coord_review_billing_receipts.sql có cột payer_name trên cash_transactions)."
            : ""),
      );
    }
  }
  throw new Error(lastMessage || "Không tải được sổ quỹ.");
}

/** Số chứng từ tiếp theo trong ngày: PT-YYYYMMDD-001 (thu), PC-YYYYMMDD-001 (chi). */
export async function allocateNextCashDocNumber(
  transactionDate: string,
  direction: "receipt" | "payment",
): Promise<string> {
  const d = transactionDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Ngày chứng từ không hợp lệ.");
  }
  const ymd = d.replace(/-/g, "");
  const prefix = direction === "receipt" ? "PT" : "PC";
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("cash_transactions")
    .select("doc_number")
    .like("doc_number", `${prefix}-${ymd}-%`)
    .limit(1000);
  if (error) throw new Error(error.message);
  const re = new RegExp(`^${prefix}-${ymd}-(\\d+)$`);
  let max = 0;
  for (const r of data ?? []) {
    const doc = String((r as { doc_number: string }).doc_number ?? "");
    const m = doc.match(re);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `${prefix}-${ymd}-${String(max + 1).padStart(3, "0")}`;
}

/** Quỹ / kênh thanh toán: mặc định + đã dùng trên chứng từ & số dư đầu kỳ. */
export async function listCashFundChannels(): Promise<{ value: string; label: string }[]> {
  const defaults: { value: string; label: string }[] = [
    { value: "cash", label: "Tiền mặt" },
    { value: "mbbank", label: "MB Bank (Quân đội)" },
    { value: "acb", label: "ACB" },
    { value: "chuyen_khoan", label: "Chuyển khoản" },
    { value: "vietcombank", label: "Vietcombank" },
    { value: "other", label: "Khác" },
  ];
  const seen = new Set(defaults.map((x) => x.value.toLowerCase()));
  const extras: { value: string; label: string }[] = [];
  const supabase = createSupabaseAdmin();

  const { data: tx } = await supabase.from("cash_transactions").select("payment_channel").limit(8000);
  for (const r of tx ?? []) {
    const ch = String((r as { payment_channel: string }).payment_channel ?? "").trim();
    if (!ch) continue;
    const k = ch.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    extras.push({ value: ch, label: ch });
  }

  const { data: ob } = await supabase
    .from("cash_account_opening_balances")
    .select("payment_channel")
    .limit(500);
  for (const r of ob ?? []) {
    const ch = String((r as { payment_channel: string }).payment_channel ?? "").trim();
    if (!ch) continue;
    const k = ch.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    extras.push({ value: ch, label: ch });
  }

  extras.sort((a, b) => a.label.localeCompare(b.label, "vi"));
  return [...defaults, ...extras];
}

export async function createCashTransaction(input: z.infer<typeof cashSchema>): Promise<{ id: string }> {
  const supabase = createSupabaseAdmin();
  const parsed = cashSchema.parse(input);
  const doc_number =
    parsed.doc_number.trim() ||
    (await allocateNextCashDocNumber(parsed.transaction_date, parsed.direction));
  const row = { ...parsed, doc_number };
  const payload = cashInsertPayload(row);
  let { data, error } = await supabase.from("cash_transactions").insert(payload).select("id").single();
  if (
    error &&
    isSupabaseSchemaDriftError(error.message) &&
    Object.prototype.hasOwnProperty.call(payload, "payer_name")
  ) {
    const { payer_name, ...legacyPayload } = payload;
    void payer_name;
    const r2 = await supabase.from("cash_transactions").insert(legacyPayload).select("id").single();
    data = r2.data;
    error = r2.error;
  }
  if (error || !data) throw new Error(error?.message ?? "Không tạo được chứng từ.");
  revalidatePath("/accounting/cash");
  revalidatePath("/accounting/debt");
  return { id: data["id"] as string };
}

export async function updateCashTransaction(
  id: string,
  input: z.infer<typeof cashSchema>,
) {
  const supabase = createSupabaseAdmin();
  const row = cashSchema.parse(input);
  if (!row.doc_number.trim()) {
    throw new Error("Số chứng từ không được để trống khi sửa.");
  }
  const payload = cashInsertPayload(row);
  let { error } = await supabase.from("cash_transactions").update(payload).eq("id", id);
  if (
    error &&
    isSupabaseSchemaDriftError(error.message) &&
    Object.prototype.hasOwnProperty.call(payload, "payer_name")
  ) {
    const { payer_name, ...legacyPayload } = payload;
    void payer_name;
    const r2 = await supabase.from("cash_transactions").update(legacyPayload).eq("id", id);
    error = r2.error;
  }
  if (error) throw new Error(error.message);
  revalidatePath("/accounting/cash");
  revalidatePath("/accounting/debt");
}

export async function deleteCashTransaction(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("cash_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting/cash");
  revalidatePath("/accounting/debt");
}

export type CashFlowTotals = {
  receipt: number;
  payment: number;
  dateFrom: string;
  dateTo: string;
};

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
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

const CASH_RECEIPT_SELECT_FULL =
  "doc_number, transaction_date, payment_channel, direction, business_category, amount, payer_name, description, partners!cash_transactions_partner_id_fkey(code,name), suppliers!cash_transactions_supplier_id_fkey(code,name)";

const CASH_RECEIPT_SELECT_LEGACY =
  "doc_number, transaction_date, payment_channel, direction, business_category, amount, description, partners!cash_transactions_partner_id_fkey(code,name)";

const CASH_RECEIPT_SELECT_WITH_SUPPLIER_ONLY =
  "doc_number, transaction_date, payment_channel, direction, business_category, amount, payer_name, description, suppliers!cash_transactions_supplier_id_fkey(code,name)";

const CASH_RECEIPT_SELECT_NO_EMBED =
  "doc_number, transaction_date, payment_channel, direction, business_category, amount, payer_name, description";

const CASH_RECEIPT_SELECT_MINIMAL =
  "doc_number, transaction_date, payment_channel, direction, business_category, amount, description";

export async function getCashReceiptPrintPayload(id: string): Promise<CashReceiptPrintPayload> {
  const supabase = createSupabaseAdmin();
  const selects = [
    CASH_RECEIPT_SELECT_FULL,
    CASH_RECEIPT_SELECT_WITH_SUPPLIER_ONLY,
    CASH_RECEIPT_SELECT_LEGACY,
    CASH_RECEIPT_SELECT_NO_EMBED,
    CASH_RECEIPT_SELECT_MINIMAL,
  ];
  let lastMsg = "";
  for (let i = 0; i < selects.length; i++) {
    const sel = selects[i]!;
    const { data, error } = await supabase.from("cash_transactions").select(sel).eq("id", id).single();
    if (!error && data) {
      const row = data as unknown as Record<string, unknown>;
      const partners = row["partners"] as { code?: string; name?: string } | null | undefined;
      const suppliers = row["suppliers"] as { code?: string; name?: string } | null | undefined;
      return {
        doc_number: row["doc_number"] as string,
        transaction_date: row["transaction_date"] as string,
        payment_channel: row["payment_channel"] as string,
        direction: row["direction"] as string,
        business_category: row["business_category"] as string,
        amount: finiteNumber(row["amount"]),
        payer_name: (row["payer_name"] as string | null) ?? null,
        partner_code: partners?.code ?? null,
        partner_name: partners?.name ?? null,
        supplier_code: suppliers?.code ?? null,
        supplier_name: suppliers?.name ?? null,
        description: (row["description"] as string | null) ?? null,
      };
    }
    lastMsg = error?.message ?? "";
    const retry = i < selects.length - 1 && error && isSupabaseSchemaDriftError(error.message);
    if (!retry && error) throw new Error(error.message);
  }
  throw new Error(lastMsg || "Không tìm thấy chứng từ.");
}
export type CashAccountOpeningBalance = {
  id: string;
  payment_channel: string;
  year: number;
  month: number;
  opening_balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const openingBalanceSchema = z.object({
  payment_channel: z.string().min(1).max(100),
  year: z.coerce.number().int().min(1900).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  opening_balance: z.coerce.number(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function upsertCashAccountOpeningBalance(input: z.infer<typeof openingBalanceSchema>) {
  const supabase = createSupabaseAdmin();
  const row = openingBalanceSchema.parse(input);
  const { error } = await supabase.from("cash_account_opening_balances").upsert(
    {
      payment_channel: row.payment_channel,
      year: row.year,
      month: row.month,
      opening_balance: row.opening_balance,
      notes: row.notes?.trim() ?? null,
    },
    { onConflict: "payment_channel,year,month" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/accounting/cash");
}

export async function getCashAccountOpeningBalance(
  paymentChannel: string,
  year: number,
  month: number,
): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("cash_account_opening_balances")
    .select("opening_balance")
    .eq("payment_channel", paymentChannel)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.opening_balance ?? 0);
}

export async function listCashAccountOpeningBalances(
  year: number,
  month: number,
): Promise<CashAccountOpeningBalance[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("cash_account_opening_balances")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .order("payment_channel");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    payment_channel: r.payment_channel as string,
    year: r.year as number,
    month: r.month as number,
    opening_balance: Number(r.opening_balance),
    notes: r.notes as string | null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }));
}