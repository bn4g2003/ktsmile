"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";

export type InventoryMovementRow = {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  // Tồn đầu kỳ
  opening_qty: number;
  opening_amount: number;
  // Nhập trong kỳ
  inbound_qty: number;
  inbound_amount: number;
  // Xuất trong kỳ
  outbound_qty: number;
  outbound_amount: number;
  // Tồn cuối kỳ
  closing_qty: number;
  closing_amount: number;
};

export type InventoryMovementReport = {
  from_date: string;
  to_date: string;
  rows: InventoryMovementRow[];
  totals: {
    opening_amount: number;
    inbound_amount: number;
    outbound_amount: number;
    closing_amount: number;
  };
};

/**
 * Báo cáo Nhập Xuất Tồn kho
 * Tính tồn đầu kỳ, nhập, xuất, tồn cuối kỳ cho từng sản phẩm
 */
export async function getInventoryMovementReport(
  fromDate: string,
  toDate: string,
): Promise<InventoryMovementReport> {
  const supabase = createSupabaseAdmin();

  // Lấy danh sách sản phẩm (chỉ inventory và both)
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, code, name, unit")
    .in("product_usage", ["inventory", "both"])
    .eq("is_active", true)
    .order("code");

  if (pErr) throw new Error(pErr.message);
  if (!products || products.length === 0) {
    return {
      from_date: fromDate,
      to_date: toDate,
      rows: [],
      totals: {
        opening_amount: 0,
        inbound_amount: 0,
        outbound_amount: 0,
        closing_amount: 0,
      },
    };
  }

  const productIds = products.map((p) => p.id);

  // Lấy tất cả stock_lines trong và trước kỳ
  const { data: allLines, error: lErr } = await supabase
    .from("stock_lines")
    .select(
      "product_id, quantity, unit_price, line_amount, stock_documents!inner(document_date, movement_type, posting_status)",
    )
    .in("product_id", productIds)
    .lte("stock_documents.document_date", toDate)
    .eq("stock_documents.posting_status", "posted");

  if (lErr) throw new Error(lErr.message);

  type MovementLine = {
    product_id: string;
    quantity: number | string | null;
    line_amount: number | string | null;
    stock_documents: {
      document_date: string;
      movement_type: "inbound" | "outbound";
    };
  };

  const typedLines = (allLines ?? []) as unknown as MovementLine[];

  // Tính toán cho từng sản phẩm
  const rows: InventoryMovementRow[] = [];
  let totalOpeningAmount = 0;
  let totalInboundAmount = 0;
  let totalOutboundAmount = 0;
  let totalClosingAmount = 0;

  for (const product of products) {
    const productLines = typedLines.filter((l) => l.product_id === product.id);

    let openingQty = 0;
    let openingAmount = 0;
    let inboundQty = 0;
    let inboundAmount = 0;
    let outboundQty = 0;
    let outboundAmount = 0;

    for (const line of productLines) {
      const doc = line.stock_documents;
      const docDate = doc.document_date;
      const movementType = doc.movement_type;
      const qty = Number(line.quantity ?? 0);
      const amount = Number(line.line_amount ?? 0);

      if (docDate < fromDate) {
        // Trước kỳ -> tính vào tồn đầu
        if (movementType === "inbound") {
          openingQty += qty;
          openingAmount += amount;
        } else {
          openingQty -= qty;
          openingAmount -= amount;
        }
      } else {
        // Trong kỳ
        if (movementType === "inbound") {
          inboundQty += qty;
          inboundAmount += amount;
        } else {
          outboundQty += qty;
          outboundAmount += amount;
        }
      }
    }

    const closingQty = openingQty + inboundQty - outboundQty;
    const closingAmount = openingAmount + inboundAmount - outboundAmount;

    // Chỉ hiển thị sản phẩm có phát sinh
    if (
      openingQty !== 0 ||
      inboundQty !== 0 ||
      outboundQty !== 0 ||
      closingQty !== 0
    ) {
      rows.push({
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        unit: product.unit || "",
        opening_qty: Math.round(openingQty * 100) / 100,
        opening_amount: Math.round(openingAmount),
        inbound_qty: Math.round(inboundQty * 100) / 100,
        inbound_amount: Math.round(inboundAmount),
        outbound_qty: Math.round(outboundQty * 100) / 100,
        outbound_amount: Math.round(outboundAmount),
        closing_qty: Math.round(closingQty * 100) / 100,
        closing_amount: Math.round(closingAmount),
      });

      totalOpeningAmount += openingAmount;
      totalInboundAmount += inboundAmount;
      totalOutboundAmount += outboundAmount;
      totalClosingAmount += closingAmount;
    }
  }

  return {
    from_date: fromDate,
    to_date: toDate,
    rows,
    totals: {
      opening_amount: Math.round(totalOpeningAmount),
      inbound_amount: Math.round(totalInboundAmount),
      outbound_amount: Math.round(totalOutboundAmount),
      closing_amount: Math.round(totalClosingAmount),
    },
  };
}
