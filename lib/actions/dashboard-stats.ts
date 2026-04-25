"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";

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
  topStock: TopStockRow[];
  topSold: TopSoldRow[];
  monthlyFinance: MonthFinanceRow[];
  financial: DashboardFinancialSummary;
  receivableDue: DashboardDueSummary;
  payableDue: DashboardDueSummary;
};

export async function getDashboardCharts(): Promise<DashboardChartsData> {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month, 1)).toISOString();

  const { data: orders, error: oe } = await supabase.from("lab_orders").select("status");
  if (oe) throw new Error(oe.message);
  const statusMap = new Map<string, number>();
  for (const r of orders ?? []) {
    const s = String((r as { status: string }).status);
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }
  const orderByStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const { data: stock, error: se } = await supabase
    .from("v_products_admin_grid")
    .select("product_code:code, product_name:name, quantity_on_hand, unit_price")
    .order("quantity_on_hand", { ascending: false })
    .limit(12);
  if (se) throw new Error(se.message);
  const topStock: TopStockRow[] = (stock ?? []).map((r: Record<string, unknown>) => ({
    product_code: String(r.product_code ?? ""),
    product_name: String(r.product_name ?? ""),
    quantity_on_hand: Number(r.quantity_on_hand ?? 0),
    stock_value: Number(r.quantity_on_hand ?? 0) * Number(r.unit_price ?? 0),
  }));

  const { data: revenueRows, error: re } = await supabase
    .from("v_orders_by_partner_month")
    .select("month, order_amount")
    .gte("month", `${year}-01-01`)
    .lt("month", `${year + 1}-01-01`);
  if (re) throw new Error(re.message);

  const { data: expenseRows, error: ee } = await supabase
    .from("v_cash_by_partner_month")
    .select("month, direction, total_amount")
    .eq("direction", "payment")
    .gte("month", `${year}-01-01`)
    .lt("month", `${year + 1}-01-01`);
  if (ee) throw new Error(ee.message);

  const revByMonth = Array.from({ length: 12 }, () => 0);
  const expByMonth = Array.from({ length: 12 }, () => 0);
  for (const r of revenueRows ?? []) {
    const m = new Date(String((r as { month: string }).month)).getUTCMonth();
    revByMonth[m] += Number((r as { order_amount: number }).order_amount ?? 0);
  }
  for (const r of expenseRows ?? []) {
    const m = new Date(String((r as { month: string }).month)).getUTCMonth();
    expByMonth[m] += Number((r as { total_amount: number }).total_amount ?? 0);
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

  const { data: cashRows, error: ce } = await supabase
    .from("cash_transactions")
    .select("payment_channel, direction, amount");
  if (ce) throw new Error(ce.message);
  let cash_on_hand = 0;
  let bank_deposit = 0;
  for (const row of cashRows ?? []) {
    const r = row as { payment_channel?: string; direction?: string; amount?: number };
    const amount = Number(r.amount ?? 0);
    const sign = r.direction === "payment" ? -1 : 1;
    const ch = String(r.payment_channel ?? "").toLowerCase();
    if (ch === "cash") cash_on_hand += sign * amount;
    else bank_deposit += sign * amount;
  }

  const { data: debtRows, error: de } = await supabase
    .from("partner_opening_balances")
    .select("partner_id, opening_balance")
    .eq("year", year)
    .eq("month", month);
  if (de) throw new Error(de.message);
  const openDebtMap = new Map<string, number>();
  for (const r of debtRows ?? []) {
    openDebtMap.set((r as { partner_id: string }).partner_id, Number((r as { opening_balance: number }).opening_balance ?? 0));
  }
  const { data: ordMonthRows, error: ome } = await supabase
    .from("v_orders_by_partner_month")
    .select("partner_id, order_amount")
    .gte("month", monthStart)
    .lt("month", monthEnd);
  if (ome) throw new Error(ome.message);
  const { data: recMonthRows, error: rme } = await supabase
    .from("v_cash_by_partner_month")
    .select("partner_id, total_amount")
    .eq("direction", "receipt")
    .gte("month", monthStart)
    .lt("month", monthEnd);
  if (rme) throw new Error(rme.message);
  const ordMap = new Map<string, number>();
  const recMap = new Map<string, number>();
  for (const r of ordMonthRows ?? []) ordMap.set((r as { partner_id: string }).partner_id, Number((r as { order_amount: number }).order_amount ?? 0));
  for (const r of recMonthRows ?? []) recMap.set((r as { partner_id: string }).partner_id, Number((r as { total_amount: number }).total_amount ?? 0));
  let receivable = 0;
  for (const pid of new Set([...openDebtMap.keys(), ...ordMap.keys(), ...recMap.keys()])) {
    receivable += (openDebtMap.get(pid) ?? 0) + (ordMap.get(pid) ?? 0) - (recMap.get(pid) ?? 0);
  }

  const { data: supOpenRows, error: soe } = await supabase
    .from("supplier_opening_balances")
    .select("supplier_id, opening_balance")
    .eq("year", year)
    .eq("month", month);
  if (soe) throw new Error(soe.message);
  const openPayMap = new Map<string, number>();
  for (const r of supOpenRows ?? []) openPayMap.set((r as { supplier_id: string }).supplier_id, Number((r as { opening_balance: number }).opening_balance ?? 0));
  const { data: inboundRows, error: ibe } = await supabase
    .from("v_supplier_inbound_by_month")
    .select("supplier_id, inbound_amount")
    .gte("month", monthStart)
    .lt("month", monthEnd);
  if (ibe) throw new Error(ibe.message);
  const { data: payRows, error: pye } = await supabase
    .from("v_supplier_payments_by_month")
    .select("supplier_id, payment_amount")
    .gte("month", monthStart)
    .lt("month", monthEnd);
  if (pye) throw new Error(pye.message);
  const inboundMap = new Map<string, number>();
  const payMap = new Map<string, number>();
  for (const r of inboundRows ?? []) inboundMap.set((r as { supplier_id: string }).supplier_id, Number((r as { inbound_amount: number }).inbound_amount ?? 0));
  for (const r of payRows ?? []) payMap.set((r as { supplier_id: string }).supplier_id, Number((r as { payment_amount: number }).payment_amount ?? 0));
  let payable = 0;
  for (const sid of new Set([...openPayMap.keys(), ...inboundMap.keys(), ...payMap.keys()])) {
    payable += (openPayMap.get(sid) ?? 0) + (inboundMap.get(sid) ?? 0) - (payMap.get(sid) ?? 0);
  }

  const inventory_value = topStock.reduce((s, r) => s + r.stock_value, 0);
  const total_money = cash_on_hand + bank_deposit;

  const { data: soldRows, error: soldErr } = await supabase
    .from("lab_order_lines")
    .select("quantity, line_amount, products:product_id(code,name), lab_orders!inner(status,received_at)")
    .neq("lab_orders.status", "cancelled")
    .gte("lab_orders.received_at", `${year}-01-01`)
    .lt("lab_orders.received_at", `${year + 1}-01-01`);
  if (soldErr) throw new Error(soldErr.message);
  const soldMap = new Map<string, TopSoldRow>();
  for (const row of soldRows ?? []) {
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
    topStock,
    topSold,
    monthlyFinance,
    financial: {
      total_money,
      cash_on_hand,
      bank_deposit,
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
