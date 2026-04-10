"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";

export type OrderStatusCount = { status: string; count: number };
export type TopStockRow = {
  product_code: string;
  product_name: string;
  quantity_on_hand: number;
};

export type DashboardChartsData = {
  orderByStatus: OrderStatusCount[];
  topStock: TopStockRow[];
};

export async function getDashboardCharts(): Promise<DashboardChartsData> {
  const supabase = createSupabaseAdmin();

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
    .from("v_product_stock")
    .select("product_code, product_name, quantity_on_hand")
    .order("quantity_on_hand", { ascending: false })
    .limit(12);
  if (se) throw new Error(se.message);
  const topStock: TopStockRow[] = (stock ?? []).map((r: Record<string, unknown>) => ({
    product_code: String(r.product_code ?? ""),
    product_name: String(r.product_name ?? ""),
    quantity_on_hand: Number(r.quantity_on_hand ?? 0),
  }));

  return { orderByStatus, topStock };
}
