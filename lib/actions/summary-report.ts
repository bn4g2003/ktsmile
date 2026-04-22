"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";

export type ProductYieldRow = {
  product_code: string;
  product_name: string;
  count: number;
};

export type SummaryReportData = {
  totalNewYield: number;
  totalWarrantyYield: number;
  totalYield: number;
  totalCustomers: number;
  products: ProductYieldRow[];
};

/** Báo cáo tổng hợp sản lượng và phát sinh khách hàng */
export async function getSummaryReport(month: number, year: number): Promise<SummaryReportData> {
  const supabase = createSupabaseAdmin();
  
  // Tạo dải thời gian từ đầu tháng đến cuối tháng
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  // Lấy chi tiết các dòng đơn hàng trong khoảng thời gian
  const { data: lines, error: linesError } = await supabase
    .from("lab_order_lines")
    .select(`
      id,
      tooth_count,
      work_type,
      products!lab_order_lines_product_id_fkey(code, name),
      lab_orders!lab_order_lines_order_id_fkey!inner(id, received_at, partner_id, status)
    `)
    .gte("lab_orders.received_at", startDate)
    .lte("lab_orders.received_at", endDate)
    .neq("lab_orders.status", "cancelled");

  if (linesError) throw new Error(linesError.message);

  let totalNewYield = 0;
  let totalWarrantyYield = 0;
  const uniquePartners = new Set<string>();
  const productMap = new Map<string, { code: string; name: string; count: number }>();

  for (const line of lines ?? []) {
    const order = (line.lab_orders as any);
    if (!order) continue; // Bỏ qua nếu không có thông tin đơn hàng (do filter)

    const product = (line.products as any);
    const count = Number(line.tooth_count ?? 0);

    // Tính sản lượng theo loại công việc
    if (line.work_type === "new_work") {
      totalNewYield += count;
    } else if (line.work_type === "warranty") {
      totalWarrantyYield += count;
    }

    // Đếm khách hàng duy nhất
    if (order.partner_id) {
      uniquePartners.add(order.partner_id);
    }

    // Tổng hợp theo từng sản phẩm
    if (product) {
      const pId = product.code;
      if (!productMap.has(pId)) {
        productMap.set(pId, {
          code: product.code,
          name: product.name,
          count: 0,
        });
      }
      productMap.get(pId)!.count += count;
    }
  }

  const products: ProductYieldRow[] = Array.from(productMap.values())
    .map((p) => ({
      product_code: p.code,
      product_name: p.name,
      count: p.count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalNewYield,
    totalWarrantyYield,
    totalYield: totalNewYield + totalWarrantyYield,
    totalCustomers: uniquePartners.size,
    products,
  };
}
