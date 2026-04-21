"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";

export type SalesReportRow = {
  partner_id: string;
  partner_code: string;
  partner_name: string;
  order_count: number;
  total_sales: number;
};

export type SalesOrderDetail = {
  order_id: string;
  order_number: string;
  received_at: string;
  patient_name: string;
  grand_total: number;
};

/** Báo cáo doanh số theo khách hàng trong khoảng thời gian */
export async function listSalesReport(args: ListArgs): Promise<ListResult<SalesReportRow>> {
  const supabase = createSupabaseAdmin();
  
  const fromDate = args.filters.from_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const toDate = args.filters.to_date || new Date().toISOString().split('T')[0];

  // Lấy danh sách đơn hàng trong khoảng thời gian
  const { data: orders, error: ordersError } = await supabase
    .from("lab_orders")
    .select(`
      id,
      order_number,
      received_at,
      partner_id,
      patient_name,
      billing_grand_total,
      partners!inner(id, code, name, partner_type)
    `)
    .gte("received_at", fromDate)
    .lte("received_at", toDate)
    .neq("status", "cancelled")
    .in("partners.partner_type", ["customer_clinic", "customer_labo"])
    .order("received_at", { ascending: false });

  if (ordersError) throw new Error(ordersError.message);

  // Tổng hợp theo khách hàng
  const partnerMap = new Map<string, SalesReportRow>();
  
  for (const order of orders ?? []) {
    const partner = order.partners as { id: string; code: string; name: string };
    const partnerId = partner.id;
    
    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, {
        partner_id: partnerId,
        partner_code: partner.code,
        partner_name: partner.name,
        order_count: 0,
        total_sales: 0,
      });
    }
    
    const row = partnerMap.get(partnerId)!;
    row.order_count += 1;
    row.total_sales += Number(order.billing_grand_total ?? 0);
  }

  let rows = Array.from(partnerMap.values());

  // Lọc theo tìm kiếm
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

  // Sắp xếp theo doanh số giảm dần
  rows.sort((a, b) => b.total_sales - a.total_sales);

  const total = rows.length;
  const totalSales = rows.reduce((s, r) => s + r.total_sales, 0);
  const totalOrders = rows.reduce((s, r) => s + r.order_count, 0);
  
  const from = (args.page - 1) * args.pageSize;
  const slice = rows.slice(from, from + args.pageSize);
  
  const round2 = (n: number) => Math.round(n * 100) / 100;
  
  return {
    rows: slice,
    total,
    summary: [
      { label: "Tổng số KH", value: total },
      { label: "Tổng số đơn", value: totalOrders },
      { label: "Tổng doanh số", value: round2(totalSales) },
    ],
  };
}

/** Lấy chi tiết các đơn hàng của một khách hàng trong khoảng thời gian */
export async function getSalesOrdersByPartner(
  partnerId: string,
  fromDate: string,
  toDate: string
): Promise<SalesOrderDetail[]> {
  const supabase = createSupabaseAdmin();

  const { data: orders, error } = await supabase
    .from("lab_orders")
    .select("id, order_number, received_at, patient_name, billing_grand_total")
    .eq("partner_id", partnerId)
    .gte("received_at", fromDate)
    .lte("received_at", toDate)
    .neq("status", "cancelled")
    .order("received_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (orders ?? []).map((o) => ({
    order_id: o.id,
    order_number: o.order_number,
    received_at: o.received_at,
    patient_name: o.patient_name,
    grand_total: Number(o.billing_grand_total ?? 0),
  }));
}
