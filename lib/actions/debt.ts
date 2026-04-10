"use server";

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

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function listDebtReport(args: ListArgs): Promise<ListResult<DebtRow>> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const y = Number(args.filters.year) || now.getUTCFullYear();
  const m = Number(args.filters.month) || now.getUTCMonth() + 1;
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

  const g = args.globalSearch.trim().toLowerCase();
  let rows: DebtRow[] = (partners ?? []).map((p) => {
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

  if (g) {
    rows = rows.filter(
      (r) =>
        r.partner_code.toLowerCase().includes(g) ||
        r.partner_name.toLowerCase().includes(g),
    );
  }

  const total = rows.length;
  const from = (args.page - 1) * args.pageSize;
  const slice = rows.slice(from, from + args.pageSize);
  return { rows: slice, total };
}
