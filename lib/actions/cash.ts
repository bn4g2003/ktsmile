"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { finiteNumber } from "@/lib/billing/order-grand-total";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isSupabaseSchemaDriftError } from "@/lib/supabase/schema-drift";
import type { CashReceiptPrintPayload } from "@/lib/reports/cash-receipt-html";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { decodeMultiFilter } from "@/lib/grid/multi-filter";
import { CASH_FUND_CHANNEL_DEFAULTS, formatCashPaymentChannel } from "@/lib/cash/cash-channel-labels";

/** Chuỗi rỗng / không phải UUID → null (tránh ZodError khó đọc trên production). */
function preprocessOptionalUuid(val: unknown): string | null {
  if (val === "" || val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s) return null;
  const p = z.string().uuid().safeParse(s);
  return p.success ? p.data : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  partner_id: z.preprocess(preprocessOptionalUuid, z.union([z.string().uuid(), z.null()])),
  supplier_id: z.preprocess(preprocessOptionalUuid, z.union([z.string().uuid(), z.null()])),
  payer_name: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  reference_type: z.string().max(100).optional().nullable(),
  reference_id: z.preprocess(preprocessOptionalUuid, z.union([z.string().uuid(), z.null()])),
});

function parseCashPayload(input: unknown): z.infer<typeof cashSchema> {
  const r = cashSchema.safeParse(input);
  if (r.success) return r.data;
  const msg = r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  throw new Error("Dữ liệu chứng từ không hợp lệ: " + msg);
}

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

    q = q
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);
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

function compactEntityKey(raw: string | null | undefined, fallback: string): string {
  const s = String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (s) return s;
  return fallback.toUpperCase();
}

/** Số chứng từ tự động: PT/PC-<IDKH|IDNCC>-<YYYYMMDD>-<001> (theo ngày chứng từ, không kèm giờ). */
export async function allocateNextCashDocNumber(
  transactionDate: string,
  direction: "receipt" | "payment",
  partnerId?: string | null,
  supplierId?: string | null,
): Promise<string> {
  const d = transactionDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Ngày chứng từ không hợp lệ.");
  }
  const ymd = d.replace(/-/g, "");
  const prefix = direction === "receipt" ? "PT" : "PC";
  const supabase = createSupabaseAdmin();
  let entity = "";
  if (direction === "receipt") {
    if (partnerId?.trim()) {
      const { data: p } = await supabase
        .from("partners")
        .select("code")
        .eq("id", partnerId.trim())
        .maybeSingle();
      entity = compactEntityKey((p as { code?: string } | null)?.code ?? partnerId.trim().slice(0, 8), "KH");
    } else {
      entity = "KH";
    }
  } else {
    if (supplierId?.trim()) {
      const { data: s } = await supabase
        .from("suppliers")
        .select("code")
        .eq("id", supplierId.trim())
        .maybeSingle();
      entity = compactEntityKey((s as { code?: string } | null)?.code ?? supplierId.trim().slice(0, 8), "NCC");
    } else {
      entity = "NCC";
    }
  }
  const stem = `${prefix}-${entity}-${ymd}`;
  const { data, error } = await supabase
    .from("cash_transactions")
    .select("doc_number")
    .like("doc_number", `${stem}-%`)
    .limit(1000);
  if (error) throw new Error(error.message);
  const re = new RegExp(`^${escapeRegExp(stem)}-(\\d+)$`);
  let max = 0;
  for (const r of data ?? []) {
    const doc = String((r as { doc_number: string }).doc_number ?? "");
    const m = doc.match(re);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `${stem}-${String(max + 1).padStart(3, "0")}`;
}

const listCashFundChannelsCached = unstable_cache(
  async (): Promise<{ value: string; label: string }[]> => {
    const defaults = [...CASH_FUND_CHANNEL_DEFAULTS];
    const seen = new Set(defaults.map((x) => x.value.toLowerCase()));
    const extras: { value: string; label: string }[] = [];
    const supabase = createSupabaseAdmin();

    const { data: tx } = await supabase
      .from("cash_transactions")
      .select("payment_channel")
      .order("created_at", { ascending: false })
      .limit(4000);
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
  },
  ["cash-fund-channels-v1"],
  { revalidate: 60, tags: ["cash-fund-channels"] },
);

/** Quỹ / kênh thanh toán: mặc định + đã dùng trên chứng từ & số dư đầu kỳ. */
export async function listCashFundChannels(): Promise<{ value: string; label: string }[]> {
  return listCashFundChannelsCached();
}

export async function createCashTransaction(input: z.infer<typeof cashSchema>): Promise<{ id: string }> {
  const supabase = createSupabaseAdmin();
  const parsed = parseCashPayload(input);
  const doc_number =
    parsed.doc_number.trim() ||
    (await allocateNextCashDocNumber(
      parsed.transaction_date,
      parsed.direction,
      parsed.partner_id,
      parsed.supplier_id,
    ));
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
  revalidateTag("cash-fund-channels", "max");
  return { id: data["id"] as string };
}

export async function updateCashTransaction(
  id: string,
  input: z.infer<typeof cashSchema>,
) {
  const supabase = createSupabaseAdmin();
  const row = parseCashPayload(input);
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
  revalidateTag("cash-fund-channels", "max");
}

export async function deleteCashTransaction(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("cash_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting/cash");
  revalidatePath("/accounting/debt");
  revalidateTag("cash-fund-channels", "max");
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
  if (channelKey === "(trống)") return "Chưa gán kênh";
  const d = displayRaw.trim();
  return formatCashPaymentChannel(d.length ? d : channelKey);
}

/**
 * Bảng thu–chi–tồn theo kênh thanh toán (mẫu «THU CHI VÀ TỒN QUỸ»).
 *
 * Tồn đầu kỳ ưu tiên dùng `cash_account_opening_balances` (số dư đầu kỳ do
 * người dùng nạp khi tạo tài khoản). Cụ thể, với mỗi kênh:
 *   - Tìm dòng OB mới nhất có (year, month) ≤ tháng của `dateFrom` → "anchor".
 *   - opening = anchor.opening_balance + Σ(net cash của kênh) trong khoảng
 *     [đầu tháng anchor, dateFrom-1]. Giao dịch trước "đầu tháng anchor" được
 *     coi như đã gói vào số dư đầu kỳ → bỏ qua để tránh đếm trùng.
 *   - Kênh không có dòng OB nào ≤ tháng `dateFrom` → fallback cộng dồn toàn
 *     bộ giao dịch trước `dateFrom` (giữ hành vi cũ để dữ liệu lịch sử không
 *     thay đổi đột ngột).
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

  const fy = Number(from.slice(0, 4));
  const fm = Number(from.slice(5, 7));
  const ymKey = (yy: number, mm: number) => yy * 12 + (mm - 1);
  const targetKey = ymKey(fy, fm);

  const obRes = await supabase
    .from("cash_account_opening_balances")
    .select("payment_channel, year, month, opening_balance");
  if (obRes.error) throw new Error(obRes.error.message);

  type Anchor = {
    key: string;
    display: string;
    ob: number;
    ymKey: number;
    year: number;
    month: number;
  };
  const anchorByKey = new Map<string, Anchor>();
  for (const raw of obRes.data ?? []) {
    const r = raw as { payment_channel: string; year: number; month: number; opening_balance: number };
    const rawCh = String(r.payment_channel ?? "").trim();
    const key = rawCh.toLowerCase() || "(trống)";
    const yy = Number(r.year);
    const mm = Number(r.month);
    if (!Number.isFinite(yy) || !Number.isFinite(mm)) continue;
    const k = ymKey(yy, mm);
    if (k > targetKey) continue;
    const ob = Number(r.opening_balance);
    if (!Number.isFinite(ob)) continue;
    const cur = anchorByKey.get(key);
    if (!cur || k > cur.ymKey) {
      anchorByKey.set(key, { key, display: rawCh || key, ob, ymKey: k, year: yy, month: mm });
    }
  }
  const anchorDateOf = (a: Anchor) => `${a.year}-${String(a.month).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("cash_transactions")
    .select("transaction_date, payment_channel, direction, amount")
    .lte("transaction_date", to);
  if (error) throw new Error(error.message);

  type Agg = { key: string; display: string; openR: number; openP: number; inR: number; inP: number };
  const byKey = new Map<string, Agg>();

  for (const [key, a] of anchorByKey) {
    byKey.set(key, { key, display: a.display, openR: 0, openP: 0, inR: 0, inP: 0 });
  }

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
      const anchor = anchorByKey.get(key);
      if (anchor && d < anchorDateOf(anchor)) continue;
      if (r.direction === "receipt") a.openR += amt;
      else a.openP += amt;
    } else {
      if (r.direction === "receipt") a.inR += amt;
      else a.inP += amt;
    }
  }

  const rows: CashLedgerChannelRow[] = [];
  for (const a of byKey.values()) {
    const anchor = anchorByKey.get(a.key);
    const obSeed = anchor?.ob ?? 0;
    const opening = roundMoney(obSeed + a.openR - a.openP);
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
  revalidateTag("cash-fund-channels", "max");
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

export type CashTransactionReferenceRow = {
  id: string;
  doc_number: string;
  transaction_date: string;
  payment_channel: string;
  payment_channel_label: string;
  direction: "receipt" | "payment";
  amount: number;
  description: string | null;
  created_at: string;
};

/**
 * Liệt kê các phiếu thu/chi đã link tới một chứng từ gốc (đơn hàng, phiếu nhập…).
 * Sắp xếp mới → cũ theo `transaction_date`, sau đó `created_at`.
 */
export async function listCashTransactionsByReference(
  referenceType: string,
  referenceId: string,
): Promise<CashTransactionReferenceRow[]> {
  const refType = referenceType.trim();
  const refId = referenceId.trim();
  if (!refType || !refId) return [];
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("cash_transactions")
    .select(
      "id, doc_number, transaction_date, payment_channel, direction, amount, description, created_at",
    )
    .eq("reference_type", refType)
    .eq("reference_id", refId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const ch = String((r as { payment_channel?: string }).payment_channel ?? "");
    return {
      id: (r as { id: string }).id,
      doc_number: String((r as { doc_number?: string }).doc_number ?? ""),
      transaction_date: String((r as { transaction_date?: string }).transaction_date ?? ""),
      payment_channel: ch,
      payment_channel_label: formatCashPaymentChannel(ch),
      direction: ((r as { direction?: string }).direction ?? "receipt") as "receipt" | "payment",
      amount: Number((r as { amount?: number }).amount ?? 0),
      description: ((r as { description?: string | null }).description ?? null) as string | null,
      created_at: String((r as { created_at?: string }).created_at ?? ""),
    };
  });
}