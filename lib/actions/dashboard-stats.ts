"use server";

import { unstable_cache } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getCashLedgerSummary } from "@/lib/actions/cash";

export type OrderStatusCount = { status: string; count: number };
export type TopStockRow = {
  product_code: string;
  product_name: string;
  quantity_on_hand: number;
  stock_value: number;
};
export type TopSoldRow = {
  product_code: string;
  product_name: string;
  quantity_sold: number;
  revenue: number;
};

export type MonthFinanceRow = {
  month: number;
  revenue: number;
  expense: number;
  profit: number;
};

export type DashboardFinancialSummary = {
  total_money: number;
  cash_on_hand: number;
  bank_deposit: number;
  customer_opening_debt: number;
  receivable: number;
  payable: number;
  revenue_year: number;
  expense_year: number;
  profit_year: number;
  inventory_value: number;
};

export type DashboardDueSummary = {
  total: number;
  overdue: number;
  in_due: number;
};

export type DashboardChartsData = {
  year: number;
  orderByStatus: OrderStatusCount[];
  waitingReviewCount: number;
  topStock: TopStockRow[];
  topSold: TopSoldRow[];
  monthlyFinance: MonthFinanceRow[];
  financial: DashboardFinancialSummary;
  receivableDue: DashboardDueSummary;
  payableDue: DashboardDueSummary;
};

async function computeDashboardCharts(year: number, month: number): Promise<DashboardChartsData> {
  const supabase = createSupabaseAdmin();
  const monthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month, 1)).toISOString();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const monthIndexFromDate = (isoDate: string): number => {
    // Faster than new Date(...) in tight loops and stable for YYYY-MM-DD strings.
    const mm = Number(isoDate.slice(5, 7));
    if (!Number.isFinite(mm) || mm < 1 || mm > 12) return 0;
    return mm - 1;
  };
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const [
    ordersRes,
    stockRes,
    yearlyOrdersRes,
    expenseRes,
    debtOpenRes,
    ordMonthRes,
    recMonthRes,
    supOpenRes,
    inboundRes,
    payRes,
    soldRes,
    ledgerSummary,
  ] = await Promise.all([
    supabase.from("lab_orders").select("status, coord_review_status"),
    supabase
      .from("v_material_stock")
      .select("material_id, product_id, material_code, material_name, quantity_on_hand")
      .order("quantity_on_hand", { ascending: false })
      .limit(12),
    supabase
      .from("v_orders_by_partner_month")
      .select("month, order_amount")
      .gte("month", yearStart)
      .lt("month", yearEnd),
    supabase
      .from("cash_transactions")
      .select("transaction_date, amount")
      .eq("direction", "payment")
      .gte("transaction_date", yearStart)
      .lt("transaction_date", yearEnd),
    supabase
      .from("partner_opening_balances")
      .select("partner_id, opening_balance")
      .eq("year", year)
      .eq("month", month),
    supabase
      .from("v_orders_by_partner_month")
      .select("partner_id, order_amount")
      .gte("month", monthStart)
      .lt("month", monthEnd),
    supabase
      .from("v_cash_by_partner_month")
      .select("partner_id, total_amount")
      .eq("direction", "receipt")
      .gte("month", monthStart)
      .lt("month", monthEnd),
    supabase
      .from("supplier_opening_balances")
      .select("supplier_id, opening_balance")
      .eq("year", year)
      .eq("month", month),
    supabase
      .from("v_supplier_inbound_by_month")
      .select("supplier_id, inbound_amount")
      .gte("month", monthStart)
      .lt("month", monthEnd),
    supabase
      .from("v_supplier_payments_by_month")
      .select("supplier_id, payment_amount")
      .gte("month", monthStart)
      .lt("month", monthEnd),
    supabase
      .from("lab_order_lines")
      .select("quantity, line_amount, products:product_id(code,name), lab_orders!inner(status,received_at)")
      .neq("lab_orders.status", "cancelled")
      .gte("lab_orders.received_at", yearStart)
      .lt("lab_orders.received_at", yearEnd),
    getCashLedgerSummary(dateFrom, dateTo),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (stockRes.error) throw new Error(stockRes.error.message);
  if (yearlyOrdersRes.error) throw new Error(yearlyOrdersRes.error.message);
  if (expenseRes.error) throw new Error(expenseRes.error.message);
  if (debtOpenRes.error) throw new Error(debtOpenRes.error.message);
  if (ordMonthRes.error) throw new Error(ordMonthRes.error.message);
  if (recMonthRes.error) throw new Error(recMonthRes.error.message);
  if (supOpenRes.error) throw new Error(supOpenRes.error.message);
  if (inboundRes.error) throw new Error(inboundRes.error.message);
  if (payRes.error) throw new Error(payRes.error.message);
  if (soldRes.error) throw new Error(soldRes.error.message);

  const statusMap = new Map<string, number>();
  let waitingReviewCount = 0;
  for (const r of ordersRes.data ?? []) {
    const row = r as { status: string; coord_review_status: string };
    const s = String(row.status || "").toLowerCase();
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
    if (row.coord_review_status === "pending") {
      waitingReviewCount++;
    }
  }
  const orderByStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const materialRows = (stockRes.data ?? []) as Record<string, unknown>[];
  const materialProductIds = [
    ...new Set(
      materialRows
        .map((r) => (r["product_id"] as string | null | undefined) ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const materialUnitPriceByProductId = new Map<string, number>();
  if (materialProductIds.length > 0) {
    const { data: materialPriceRows, error: materialPriceErr } = await supabase
      .from("products")
      .select("id, unit_price")
      .in("id", materialProductIds);
    if (materialPriceErr) throw new Error(materialPriceErr.message);
    for (const row of (materialPriceRows ?? []) as Record<string, unknown>[]) {
      materialUnitPriceByProductId.set(String(row["id"] ?? ""), Number(row["unit_price"] ?? 0));
    }
  }

  const topStock: TopStockRow[] = materialRows.map((r) => {
    const productId = String(r["product_id"] ?? "");
    const quantityOnHand = Number(r["quantity_on_hand"] ?? 0);
    const unitPrice = materialUnitPriceByProductId.get(productId) ?? 0;
    return {
      product_code: String(r["material_code"] ?? ""),
      product_name: String(r["material_name"] ?? ""),
      quantity_on_hand: quantityOnHand,
      stock_value: quantityOnHand * unitPrice,
    };
  });

  const revByMonth = Array.from({ length: 12 }, () => 0);
  const expByMonth = Array.from({ length: 12 }, () => 0);
  for (const r of yearlyOrdersRes.data ?? []) {
    const m = monthIndexFromDate(String((r as { month: string }).month));
    revByMonth[m] += Number((r as { order_amount: number }).order_amount ?? 0);
  }
  for (const r of expenseRes.data ?? []) {
    const m = monthIndexFromDate(String((r as { transaction_date: string }).transaction_date));
    expByMonth[m] += Number((r as { amount: number }).amount ?? 0);
  }
  const monthlyFinance: MonthFinanceRow[] = revByMonth.map((revenue, idx) => {
    const expense = expByMonth[idx] ?? 0;
    return {
      month: idx + 1,
      revenue,
      expense,
      profit: revenue - expense,
    };
  });
  const revenue_year = monthlyFinance.reduce((s, r) => s + r.revenue, 0);
  const expense_year = monthlyFinance.reduce((s, r) => s + r.expense, 0);
  const profit_year = revenue_year - expense_year;

  const cash_on_hand = ledgerSummary.rows.find(r => r.channelKey === "cash")?.closing ?? 0;
  const bank_deposit = ledgerSummary.totals.closing - cash_on_hand;
  const total_money = ledgerSummary.totals.closing;

  const openDebtMap = new Map<string, number>();
  let customer_opening_debt = 0;
  for (const r of debtOpenRes.data ?? []) {
    const ob = Number((r as { opening_balance: number }).opening_balance ?? 0);
    openDebtMap.set((r as { partner_id: string }).partner_id, ob);
    customer_opening_debt += ob;
  }
  const ordMap = new Map<string, number>();
  const recMap = new Map<string, number>();
  for (const r of ordMonthRes.data ?? []) ordMap.set((r as { partner_id: string }).partner_id, Number((r as { order_amount: number }).order_amount ?? 0));
  for (const r of recMonthRes.data ?? []) recMap.set((r as { partner_id: string }).partner_id, Number((r as { total_amount: number }).total_amount ?? 0));
  let receivable = 0;
  for (const pid of new Set([...openDebtMap.keys(), ...ordMap.keys(), ...recMap.keys()])) {
    receivable += (openDebtMap.get(pid) ?? 0) + (ordMap.get(pid) ?? 0) - (recMap.get(pid) ?? 0);
  }

  const openPayMap = new Map<string, number>();
  for (const r of supOpenRes.data ?? []) openPayMap.set((r as { supplier_id: string }).supplier_id, Number((r as { opening_balance: number }).opening_balance ?? 0));
  const inboundMap = new Map<string, number>();
  const payMap = new Map<string, number>();
  for (const r of inboundRes.data ?? []) inboundMap.set((r as { supplier_id: string }).supplier_id, Number((r as { inbound_amount: number }).inbound_amount ?? 0));
  for (const r of payRes.data ?? []) payMap.set((r as { supplier_id: string }).supplier_id, Number((r as { payment_amount: number }).payment_amount ?? 0));
  let payable = 0;
  for (const sid of new Set([...openPayMap.keys(), ...inboundMap.keys(), ...payMap.keys()])) {
    payable += (openPayMap.get(sid) ?? 0) + (inboundMap.get(sid) ?? 0) - (payMap.get(sid) ?? 0);
  }

  const inventory_value = topStock.reduce((s, r) => s + r.stock_value, 0);

  const soldMap = new Map<string, TopSoldRow>();
  for (const row of soldRes.data ?? []) {
    const r = row as Record<string, unknown>;
    const pr = r.products as { code?: string; name?: string } | null;
    const code = String(pr?.code ?? "");
    if (!code) continue;
    const cur = soldMap.get(code) ?? {
      product_code: code,
      product_name: String(pr?.name ?? ""),
      quantity_sold: 0,
      revenue: 0,
    };
    cur.quantity_sold += Number(r.quantity ?? 0);
    cur.revenue += Number(r.line_amount ?? 0);
    soldMap.set(code, cur);
  }
  const topSold = Array.from(soldMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const receivableDue: DashboardDueSummary = {
    total: Math.max(0, receivable),
    overdue: 0,
    in_due: Math.max(0, receivable),
  };
  const payableDue: DashboardDueSummary = {
    total: Math.max(0, payable),
    overdue: 0,
    in_due: Math.max(0, payable),
  };

  return {
    year,
    orderByStatus,
    waitingReviewCount,
    topStock,
    topSold,
    monthlyFinance,
    financial: {
      total_money,
      cash_on_hand,
      bank_deposit,
      customer_opening_debt,
      receivable,
      payable,
      revenue_year,
      expense_year,
      profit_year,
      inventory_value,
    },
    receivableDue,
    payableDue,
  };
}

const getDashboardChartsCached = (year: number, month: number) =>
  unstable_cache(
    async () => computeDashboardCharts(year, month),
    ["dashboard-charts-v1", String(year), String(month)],
    { revalidate: 45 },
  )();

export async function getDashboardCharts(input?: { year?: number; month?: number }): Promise<DashboardChartsData> {
  const now = new Date();
  const yearRaw = input?.year ?? now.getUTCFullYear();
  const monthRaw = input?.month ?? now.getUTCMonth() + 1;
  const year = Number.isFinite(yearRaw) ? Math.trunc(yearRaw) : now.getUTCFullYear();
  const month = Number.isFinite(monthRaw) ? Math.min(12, Math.max(1, Math.trunc(monthRaw))) : now.getUTCMonth() + 1;
  return getDashboardChartsCached(year, month);
}
