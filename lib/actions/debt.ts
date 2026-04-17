"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";

export type DebtRow = {
  partner_id: string;
  partner_code: string;
  partner_name: string;
  opening: number;
  orders_month: number;
  receipts_month: number;
  closing: number;
};

/** Công nợ một KH theo tháng hiện tại (UTC), chỉ khách clinic/labo. */
export type PartnerDebtSnapshot = {
  partner_id: string;
  year: number;
  month: number;
  opening: number;
  orders_month: number;
  receipts_month: number;
  closing: number;
};

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

async function loadDebtRowsForMonth(y: number, m: number): Promise<DebtRow[]> {
  const supabase = createSupabaseAdmin();
  const { start, end } = monthBounds(y, m);

  const { data: partners, error: pe } = await supabase
    .from("partners")
    .select("id, code, name")
    .in("partner_type", ["customer_clinic", "customer_labo"])
    .order("code", { ascending: true });
  if (pe) throw new Error(pe.message);

  const { data: openings, error: oe } = await supabase
    .from("partner_opening_balances")
    .select("partner_id, opening_balance")
    .eq("year", y)
    .eq("month", m);
  if (oe) throw new Error(oe.message);
  const openMap = new Map<string, number>();
  for (const r of openings ?? []) {
    openMap.set(r.partner_id as string, Number(r.opening_balance));
  }

  const { data: orderMonth, error: ome } = await supabase
    .from("v_orders_by_partner_month")
    .select("partner_id, month, order_amount")
    .gte("month", start)
    .lt("month", end);
  if (ome) throw new Error(ome.message);
  const orderMap = new Map<string, number>();
  for (const r of orderMonth ?? []) {
    orderMap.set(r.partner_id as string, Number(r.order_amount));
  }

  const { data: cashMonth, error: ce } = await supabase
    .from("v_cash_by_partner_month")
    .select("partner_id, month, direction, total_amount")
    .eq("direction", "receipt")
    .gte("month", start)
    .lt("month", end);
  if (ce) throw new Error(ce.message);
  const receiptMap = new Map<string, number>();
  for (const r of cashMonth ?? []) {
    receiptMap.set(r.partner_id as string, Number(r.total_amount));
  }

  return (partners ?? []).map((p) => {
    const pid = p.id as string;
    const opening = openMap.get(pid) ?? 0;
    const orders_month = orderMap.get(pid) ?? 0;
    const receipts_month = receiptMap.get(pid) ?? 0;
    const closing = opening + orders_month - receipts_month;
    return {
      partner_id: pid,
      partner_code: p.code as string,
      partner_name: p.name as string,
      opening,
      orders_month,
      receipts_month,
      closing,
    };
  });
}

/** Ghi nợ đầu kỳ tháng sau = nợ cuối kỳ tháng hiện tại (toàn bộ KH clinic/labo). */
export async function carryForwardOpeningToNextMonth(year: number, month: number): Promise<{ nextYear: number; nextMonth: number; upserted: number }> {
  const supabase = createSupabaseAdmin();
  const y = Math.floor(year);
  const m = Math.floor(month);
  if (m < 1 || m > 12 || y < 2000 || y > 2100) throw new Error("Tháng/năm không hợp lệ.");
  const rows = await loadDebtRowsForMonth(y, m);
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  let upserted = 0;
  for (const r of rows) {
    const closing = Math.round(r.closing * 100) / 100;
    const { error } = await supabase.from("partner_opening_balances").upsert(
      {
        partner_id: r.partner_id,
        year: ny,
        month: nm,
        opening_balance: closing,
        notes: "Kết chuyển từ " + String(m) + "/" + String(y),
      },
      { onConflict: "partner_id,year,month" },
    );
    if (error) throw new Error(error.message);
    upserted += 1;
  }
  revalidatePath("/accounting/debt");
  return { nextYear: ny, nextMonth: nm, upserted };
}

export async function listDebtReport(args: ListArgs): Promise<ListResult<DebtRow>> {
  const now = new Date();
  const y = Number(args.filters.year) || now.getUTCFullYear();
  const m = Number(args.filters.month) || now.getUTCMonth() + 1;

  let rows = await loadDebtRowsForMonth(y, m);

  const g = args.globalSearch.trim().toLowerCase();
  if (g) {
    rows = rows.filter(
      (r) =>
        r.partner_code.toLowerCase().includes(g) ||
        r.partner_name.toLowerCase().includes(g),
    );
  }
  const codeFilter = args.filters.partner_code?.trim().toLowerCase() ?? "";
  if (codeFilter) rows = rows.filter((r) => r.partner_code.toLowerCase().includes(codeFilter));
  const nameFilter = args.filters.partner_name?.trim().toLowerCase() ?? "";
  if (nameFilter) rows = rows.filter((r) => r.partner_name.toLowerCase().includes(nameFilter));

  const total = rows.length;
  const sumClosing = rows.reduce((s, r) => s + r.closing, 0);
  const from = (args.page - 1) * args.pageSize;
  const slice = rows.slice(from, from + args.pageSize);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    rows: slice,
    total,
    summary: [{ label: "Tổng dư cuối (đã lọc)", value: round2(sumClosing) }],
  };
}

export async function getPartnerDebtSnapshot(partnerId: string): Promise<PartnerDebtSnapshot | null> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const { start, end } = monthBounds(y, m);

  const { data: p, error: pe } = await supabase
    .from("partners")
    .select("id, partner_type")
    .eq("id", partnerId)
    .maybeSingle();
  if (pe || !p) return null;
  const pt = p.partner_type as string;
  if (pt !== "customer_clinic" && pt !== "customer_labo") return null;

  const { data: openingRow } = await supabase
    .from("partner_opening_balances")
    .select("opening_balance")
    .eq("partner_id", partnerId)
    .eq("year", y)
    .eq("month", m)
    .maybeSingle();
  const opening = Number(openingRow?.opening_balance ?? 0);

  const { data: orderRows, error: oe } = await supabase
    .from("v_orders_by_partner_month")
    .select("order_amount")
    .eq("partner_id", partnerId)
    .gte("month", start)
    .lt("month", end);
  if (oe) throw new Error(oe.message);
  let orders_month = 0;
  for (const r of orderRows ?? []) orders_month += Number(r.order_amount);

  const { data: cashRows, error: ce } = await supabase
    .from("v_cash_by_partner_month")
    .select("total_amount")
    .eq("partner_id", partnerId)
    .eq("direction", "receipt")
    .gte("month", start)
    .lt("month", end);
  if (ce) throw new Error(ce.message);
  let receipts_month = 0;
  for (const r of cashRows ?? []) receipts_month += Number(r.total_amount);

  const closing = opening + orders_month - receipts_month;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    partner_id: partnerId,
    year: y,
    month: m,
    opening: round2(opening),
    orders_month: round2(orders_month),
    receipts_month: round2(receipts_month),
    closing: round2(closing),
  };
}
