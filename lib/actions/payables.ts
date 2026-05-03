"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";

export type PayableRow = {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  opening: number;
  inbound_month: number;
  payments_month: number;
  closing: number;
};

export type SupplierPayableSnapshot = {
  supplier_id: string;
  year: number;
  month: number;
  opening: number;
  inbound_month: number;
  payments_month: number;
  closing: number;
};

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function loadPayableRowsForMonth(y: number, m: number): Promise<PayableRow[]> {
  const supabase = createSupabaseAdmin();
  const { start, end } = monthBounds(y, m);

  const { data: suppliers, error: se } = await supabase
    .from("suppliers")
    .select("id, code, name")
    .order("code", { ascending: true });
  if (se) throw new Error(se.message);

  const { data: openings, error: oe } = await supabase
    .from("supplier_opening_balances")
    .select("supplier_id, opening_balance")
    .eq("year", y)
    .eq("month", m);
  if (oe) throw new Error(oe.message);
  const openingMap = new Map<string, number>();
  for (const row of openings ?? []) {
    openingMap.set(row.supplier_id as string, Number(row.opening_balance ?? 0));
  }

  const { data: inboundRows, error: ie } = await supabase
    .from("v_supplier_inbound_by_month")
    .select("supplier_id, month, inbound_amount")
    .gte("month", start)
    .lt("month", end);
  if (ie) throw new Error(ie.message);
  const inboundMap = new Map<string, number>();
  for (const row of inboundRows ?? []) {
    inboundMap.set(row.supplier_id as string, Number(row.inbound_amount ?? 0));
  }

  const { data: paymentRows, error: pe } = await supabase
    .from("v_supplier_payments_by_month")
    .select("supplier_id, month, payment_amount")
    .gte("month", start)
    .lt("month", end);
  if (pe) throw new Error(pe.message);
  const paymentMap = new Map<string, number>();
  for (const row of paymentRows ?? []) {
    paymentMap.set(row.supplier_id as string, Number(row.payment_amount ?? 0));
  }

  return (suppliers ?? []).map((s) => {
    const supplier_id = s.id as string;
    const opening = openingMap.get(supplier_id) ?? 0;
    const inbound_month = inboundMap.get(supplier_id) ?? 0;
    const payments_month = paymentMap.get(supplier_id) ?? 0;
    const closing = opening + inbound_month - payments_month;
    return {
      supplier_id,
      supplier_code: (s.code as string) ?? "",
      supplier_name: (s.name as string) ?? "",
      opening: round2(opening),
      inbound_month: round2(inbound_month),
      payments_month: round2(payments_month),
      closing: round2(closing),
    };
  });
}

export async function listPayablesReport(args: ListArgs): Promise<ListResult<PayableRow>> {
  const now = new Date();
  const y = Number(args.filters.year) || now.getUTCFullYear();
  const m = Number(args.filters.month) || now.getUTCMonth() + 1;

  let rows = await loadPayableRowsForMonth(y, m);
  const g = args.globalSearch.trim().toLowerCase();
  if (g) {
    rows = rows.filter((r) => r.supplier_code.toLowerCase().includes(g) || r.supplier_name.toLowerCase().includes(g));
  }
  const codeFilter = args.filters.supplier_code?.trim().toLowerCase() ?? "";
  if (codeFilter) rows = rows.filter((r) => r.supplier_code.toLowerCase().includes(codeFilter));
  const nameFilter = args.filters.supplier_name?.trim().toLowerCase() ?? "";
  if (nameFilter) rows = rows.filter((r) => r.supplier_name.toLowerCase().includes(nameFilter));

  const total = rows.length;
  const sumOpening = rows.reduce((acc, row) => acc + row.opening, 0);
  const sumInbound = rows.reduce((acc, row) => acc + row.inbound_month, 0);
  const sumPayments = rows.reduce((acc, row) => acc + row.payments_month, 0);
  const sumClosing = rows.reduce((acc, row) => acc + row.closing, 0);

  const from = (args.page - 1) * args.pageSize;
  const slice = rows.slice(from, from + args.pageSize);
  return {
    rows: slice,
    total,
    summary: [
      { label: "Nợ đầu kỳ", value: round2(sumOpening) },
      { label: "PS nhập (tháng)", value: round2(sumInbound) },
      { label: "Đã trả (tháng)", value: round2(sumPayments) },
      { label: "Nợ cuối kỳ", value: round2(sumClosing) },
    ],
  };
}

export async function carryForwardPayablesOpeningToNextMonth(
  year: number,
  month: number,
): Promise<{ nextYear: number; nextMonth: number; upserted: number }> {
  const supabase = createSupabaseAdmin();
  const y = Math.floor(year);
  const m = Math.floor(month);
  if (m < 1 || m > 12 || y < 2000 || y > 2100) throw new Error("Tháng/năm không hợp lệ.");

  const rows = await loadPayableRowsForMonth(y, m);
  let nextYear = y;
  let nextMonth = m + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  let upserted = 0;
  for (const row of rows) {
    const { error } = await supabase.from("supplier_opening_balances").upsert(
      {
        supplier_id: row.supplier_id,
        year: nextYear,
        month: nextMonth,
        opening_balance: round2(row.closing),
        notes: "Kết chuyển từ " + String(m) + "/" + String(y),
      },
      { onConflict: "supplier_id,year,month" },
    );
    if (error) throw new Error(error.message);
    upserted += 1;
  }

  revalidatePath("/accounting/debt");
  return { nextYear, nextMonth, upserted };
}

export async function getSupplierPayableSnapshot(
  supplierId: string,
): Promise<SupplierPayableSnapshot | null> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const { start, end } = monthBounds(y, m);

  const { data: s, error: se } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", supplierId)
    .maybeSingle();
  if (se || !s) return null;

  const { data: openingRow, error: oe } = await supabase
    .from("supplier_opening_balances")
    .select("opening_balance")
    .eq("supplier_id", supplierId)
    .eq("year", y)
    .eq("month", m)
    .maybeSingle();
  if (oe) throw new Error(oe.message);
  const opening = Number(openingRow?.opening_balance ?? 0);

  const { data: inboundRows, error: ie } = await supabase
    .from("v_supplier_inbound_by_month")
    .select("inbound_amount")
    .eq("supplier_id", supplierId)
    .gte("month", start)
    .lt("month", end);
  if (ie) throw new Error(ie.message);
  let inbound_month = 0;
  for (const r of inboundRows ?? []) inbound_month += Number(r.inbound_amount ?? 0);

  const { data: paymentRows, error: pe } = await supabase
    .from("v_supplier_payments_by_month")
    .select("payment_amount")
    .eq("supplier_id", supplierId)
    .gte("month", start)
    .lt("month", end);
  if (pe) throw new Error(pe.message);
  let payments_month = 0;
  for (const r of paymentRows ?? []) payments_month += Number(r.payment_amount ?? 0);

  const closing = opening + inbound_month - payments_month;
  return {
    supplier_id: supplierId,
    year: y,
    month: m,
    opening: round2(opening),
    inbound_month: round2(inbound_month),
    payments_month: round2(payments_month),
    closing: round2(closing),
  };
}
