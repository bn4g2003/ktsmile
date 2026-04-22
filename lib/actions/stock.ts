"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { decodeMultiFilter } from "@/lib/grid/multi-filter";
import type {
  StockDocumentPrintLine,
  StockDocumentPrintPayload,
} from "@/lib/reports/stock-voucher-html";

export type StockDocumentRow = {
  id: string;
  document_number: string;
  document_date: string;
  movement_type: "inbound" | "outbound";
  posting_status: "draft" | "posted";
  supplier_id: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_code?: string | null;
  supplier_name?: string | null;
  line_count: number;
  total_quantity: number;
  total_amount: number;
  product_names?: string | null;
  product_prices?: string | null;
};

export type StockDocumentHeader = {
  id: string;
  document_number: string;
  document_date: string;
  movement_type: "inbound" | "outbound";
  posting_status: "draft" | "posted";
  supplier_id: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  reason: string | null;
  notes: string | null;
};

function postingStatusFilterUnsupported(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return (
    m.includes("posting_status") ||
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("schema cache")
  );
}

function relationMissing(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("material_suppliers") || m.includes("materials");
}

export async function listStockDocuments(
  args: ListArgs,
): Promise<ListResult<StockDocumentRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  const ps = decodeMultiFilter(filters.posting_status);
  let supplierIdsByFilter: string[] | null = null;
  if (filters.supplier_code?.trim() || filters.supplier_name?.trim()) {
    let sq = supabase.from("suppliers").select("id").limit(5000);
    if (filters.supplier_code?.trim()) {
      sq = sq.ilike("code", "%" + filters.supplier_code.trim() + "%");
    }
    if (filters.supplier_name?.trim()) {
      sq = sq.ilike("name", "%" + filters.supplier_name.trim() + "%");
    }
    const { data, error } = await sq;
    if (error) throw new Error(error.message);
    supplierIdsByFilter = (data ?? []).map((r) => r.id as string);
    if (!supplierIdsByFilter.length) return { rows: [], total: 0 };
  }

  const build = (usePostingFilter: boolean) => {
    let q = supabase.from("stock_documents").select(
      "*, suppliers:supplier_id(code,name), stock_lines(id,quantity,line_amount,unit_price,products:product_id(name))",
      { count: "exact" },
    );

    const g = globalSearch.trim();
    if (g) {
      const p = "%" + g + "%";
      q = q.or("document_number.ilike." + p + ",reason.ilike." + p + ",notes.ilike." + p);
    }
    const mt = decodeMultiFilter(filters.movement_type);
    if (mt.length === 1) q = q.eq("movement_type", mt[0]!);
    else if (mt.length > 1) q = q.in("movement_type", mt);
    if (usePostingFilter) {
      if (ps.length === 1) q = q.eq("posting_status", ps[0]!);
      else if (ps.length > 1) q = q.in("posting_status", ps);
    }
    if (filters.document_number?.trim())
      q = q.ilike("document_number", "%" + filters.document_number.trim() + "%");
    if (filters.document_date_from?.trim())
      q = q.gte("document_date", filters.document_date_from.trim());
    if (filters.document_date_to?.trim())
      q = q.lte("document_date", filters.document_date_to.trim());
    if (supplierIdsByFilter) q = q.in("supplier_id", supplierIdsByFilter);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return q.order("document_date", { ascending: false }).range(from, to);
  };

  let { data, error, count } = await build(true);
  if (error && ps.length > 0 && postingStatusFilterUnsupported(error)) {
    ({ data, error, count } = await build(false));
  }
  if (error) throw new Error(error.message);

  const rows: StockDocumentRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const suppliers = r["suppliers"] as { code?: string; name?: string } | null;
    const sl = r["stock_lines"] as { id?: string; quantity?: number; line_amount?: number; unit_price?: number; products?: { name?: string } }[] | null;
    const cnt = Array.isArray(sl) ? sl.length : 0;
    let totalQty = 0;
    let totalAmount = 0;
    const productNames: string[] = [];
    const productPrices: string[] = [];
    for (const ln of sl ?? []) {
      totalQty += Number(ln.quantity ?? 0);
      totalAmount += Number(ln.line_amount ?? 0);
      const pName = ln.products?.name;
      if (pName && !productNames.includes(pName)) {
        productNames.push(pName);
      }
      const pPrice = ln.unit_price;
      if (pPrice != null) {
        const priceStr = Number(pPrice).toLocaleString("vi-VN");
        if (!productPrices.includes(priceStr)) {
          productPrices.push(priceStr);
        }
      }
    }
    return {
      id: r["id"] as string,
      document_number: r["document_number"] as string,
      document_date: r["document_date"] as string,
      movement_type: r["movement_type"] as "inbound" | "outbound",
      posting_status: (r["posting_status"] as "draft" | "posted" | undefined) ?? "posted",
      supplier_id: (r["supplier_id"] as string | null) ?? null,
      reason: (r["reason"] as string | null) ?? null,
      notes: (r["notes"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      supplier_code: suppliers?.code,
      supplier_name: suppliers?.name,
      line_count: cnt,
      total_quantity: totalQty,
      total_amount: totalAmount,
      product_names: productNames.length > 0 ? productNames.join(", ") : null,
      product_prices: productPrices.length > 0 ? productPrices.join(", ") : null,
    };
  });

  return { rows, total: count ?? 0 };
}

export async function listInboundDocumentsBySupplier(
  supplierId: string,
  limit = 30,
): Promise<StockDocumentRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_documents")
    .select("*, suppliers:supplier_id(code,name), stock_lines(id,quantity,line_amount,unit_price,products:product_id(name))")
    .eq("supplier_id", supplierId)
    .eq("movement_type", "inbound")
    .order("document_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const suppliers = r["suppliers"] as { code?: string; name?: string } | null;
    const sl = r["stock_lines"] as { id?: string; quantity?: number; line_amount?: number; unit_price?: number; products?: { name?: string } }[] | null;
    const cnt = Array.isArray(sl) ? sl.length : 0;
    let totalQty = 0;
    let totalAmount = 0;
    const productNames: string[] = [];
    const productPrices: string[] = [];
    for (const ln of sl ?? []) {
      totalQty += Number(ln.quantity ?? 0);
      totalAmount += Number(ln.line_amount ?? 0);
      const pName = ln.products?.name;
      if (pName && !productNames.includes(pName)) {
        productNames.push(pName);
      }
      const pPrice = ln.unit_price;
      if (pPrice != null) {
        const priceStr = Number(pPrice).toLocaleString("vi-VN");
        if (!productPrices.includes(priceStr)) {
          productPrices.push(priceStr);
        }
      }
    }
    return {
      id: r["id"] as string,
      document_number: r["document_number"] as string,
      document_date: r["document_date"] as string,
      movement_type: r["movement_type"] as "inbound" | "outbound",
      posting_status: (r["posting_status"] as "draft" | "posted" | undefined) ?? "posted",
      supplier_id: (r["supplier_id"] as string | null) ?? null,
      reason: (r["reason"] as string | null) ?? null,
      notes: (r["notes"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      supplier_code: suppliers?.code ?? null,
      supplier_name: suppliers?.name ?? null,
      line_count: cnt,
      total_quantity: totalQty,
      total_amount: totalAmount,
      product_names: productNames.length > 0 ? productNames.join(", ") : null,
      product_prices: productPrices.length > 0 ? productPrices.join(", ") : null,
    };
  });
}

const docSchema = z.object({
  document_number: z.string().min(1).max(100),
  document_date: z.string().min(1),
  movement_type: z.enum(["inbound", "outbound"]),
  supplier_id: z.string().uuid().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createStockDocument(input: z.infer<typeof docSchema>) {
  const supabase = createSupabaseAdmin();
  const row = docSchema.parse(input);
  let { error } = await supabase.from("stock_documents").insert({
    ...row,
    posting_status: "posted",
  });
  if (error && postingStatusFilterUnsupported(error)) {
    ({ error } = await supabase.from("stock_documents").insert(row));
  }
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
}

export async function updateStockDocument(
  id: string,
  input: z.infer<typeof docSchema>,
) {
  const supabase = createSupabaseAdmin();
  const row = docSchema.parse(input);
  const { error } = await supabase.from("stock_documents").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
}

export async function deleteStockDocument(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("stock_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
}

const inboundMaterialPurchaseSchema = z
  .object({
    supplier_id: z.string().uuid(),
    document_date: z.string().min(1),
    document_number: z.string().min(1).max(100).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    lines: z
      .array(
        z.object({
          product_id: z.string().uuid(),
          quantity: z.coerce.number().positive(),
          unit_price: z.coerce.number().min(0).optional().nullable(),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    const ids = data.lines.map((l) => l.product_id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Mỗi vật tư chỉ một dòng — gộp số lượng hoặc xóa dòng trùng.",
      });
    }
  });

/**
 * Phiếu nhập kho NVL từ NCC: bắt buộc đã có dòng danh mục material_suppliers (fallback product_suppliers cho DB cũ).
 * Đơn giá dòng: dùng giá nhập nhập tay, hoặc giá tham chiếu trong danh mục, hoặc 0.
 */
export async function createInboundMaterialPurchase(
  input: z.infer<typeof inboundMaterialPurchaseSchema>,
): Promise<{ documentId: string; document_number: string }> {
  const row = inboundMaterialPurchaseSchema.parse(input);
  const supabase = createSupabaseAdmin();

  const uniqueIds = [...new Set(row.lines.map((l) => l.product_id))];
  const refPriceByProduct = new Map<string, number | null>();
  const stockProductIdByInputProductId = new Map<string, string>();

  let usedMaterials = false;
  const linksMat = await supabase
    .from("material_suppliers")
    .select("reference_purchase_price, materials:material_id(legacy_product_id)")
    .eq("supplier_id", row.supplier_id);
  if (!linksMat.error) {
    usedMaterials = true;
    for (const x of linksMat.data ?? []) {
      const mat = x["materials"] as { legacy_product_id?: string } | null;
      const legacyId = mat?.legacy_product_id;
      if (!legacyId) continue;
      if (!uniqueIds.includes(legacyId)) continue;
      refPriceByProduct.set(
        legacyId,
        x["reference_purchase_price"] != null ? Number(x["reference_purchase_price"]) : null,
      );
      stockProductIdByInputProductId.set(legacyId, legacyId);
    }
  } else if (!relationMissing(linksMat.error)) {
    throw new Error(linksMat.error.message);
  }

  if (!usedMaterials) {
    const { data: links, error: le } = await supabase
      .from("product_suppliers")
      .select("product_id, reference_purchase_price")
      .eq("supplier_id", row.supplier_id)
      .in("product_id", uniqueIds);
    if (le) throw new Error(le.message);
    for (const x of links ?? []) {
      const pid = x["product_id"] as string;
      refPriceByProduct.set(
        pid,
        x["reference_purchase_price"] != null ? Number(x["reference_purchase_price"]) : null,
      );
      stockProductIdByInputProductId.set(pid, pid);
    }
  }
  for (const id of uniqueIds) {
    if (!refPriceByProduct.has(id)) {
      throw new Error(
        "Có vật tư chưa gắn với NCC này trong danh mục (SP & NVL → Xem → NCC & kho). Không thể nhập hàng.",
      );
    }
  }

  let document_number = row.document_number?.trim() ?? "";
  if (!document_number) {
    // Sử dụng function tự động tạo mã phiếu
    const { data: genResult, error: genError } = await supabase.rpc(
      "generate_stock_document_number",
      {
        p_movement_type: "inbound",
        p_document_date: row.document_date,
        p_supplier_id: row.supplier_id,
      }
    );
    if (genError) {
      // Fallback nếu function chưa có (migration chưa chạy)
      const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      document_number = "PN-NVL-" + row.document_date.replace(/-/g, "") + "-" + suffix;
    } else {
      document_number = genResult as string;
    }
  }

  const insertDoc = {
    document_number,
    document_date: row.document_date,
    movement_type: "inbound" as const,
    supplier_id: row.supplier_id,
    reason: "Nhập NVL từ NCC",
    notes: row.notes?.trim() || null,
    posting_status: "posted" as const,
  };

  let docId: string | null = null;
  try {
    let { data: doc, error: de } = await supabase
      .from("stock_documents")
      .insert(insertDoc)
      .select("id")
      .single();
    if (de && postingStatusFilterUnsupported(de)) {
      const { posting_status: _pst, ...rest } = insertDoc;
      ({ data: doc, error: de } = await supabase.from("stock_documents").insert(rest).select("id").single());
    }
    if (de || !doc) throw new Error(de?.message ?? "Không tạo được phiếu nhập.");
    docId = doc["id"] as string;

    for (const line of row.lines) {
      const ref = refPriceByProduct.get(line.product_id);
      const unit_price = line.unit_price != null ? line.unit_price : (ref ?? 0);
      const stockProductId = stockProductIdByInputProductId.get(line.product_id) ?? line.product_id;
      const { error: lie } = await supabase.from("stock_lines").insert({
        document_id: docId,
        product_id: stockProductId,
        quantity: line.quantity,
        unit_price,
      });
      if (lie) throw new Error(lie.message);
    }
  } catch (e) {
    if (docId) {
      await supabase.from("stock_lines").delete().eq("document_id", docId);
      await supabase.from("stock_documents").delete().eq("id", docId);
    }
    throw e;
  }

  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
  revalidatePath("/accounting/debt");
  return { documentId: docId, document_number };
}

const outboundRequestSchema = z.object({
  document_date: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().positive(),
      }),
    )
    .min(1),
}).superRefine((data, ctx) => {
  const ids = data.lines.map((l) => l.product_id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: "custom",
      path: ["lines"],
      message: "Mỗi vật tư chỉ một dòng — gộp số lượng hoặc xóa dòng trùng.",
    });
  }
});

/** Tạo phiếu xuất ở trạng thái nháp + nhiều dòng — chưa trừ tồn cho đến khi ghi nhận. */
export async function createOutboundStockRequest(
  input: z.infer<typeof outboundRequestSchema>,
): Promise<{ documentId: string; document_number: string }> {
  const row = outboundRequestSchema.parse(input);
  const supabase = createSupabaseAdmin();
  
  // Sử dụng function tự động tạo mã phiếu
  let document_number: string;
  const { data: genResult, error: genError } = await supabase.rpc(
    "generate_stock_document_number",
    {
      p_movement_type: "outbound",
      p_document_date: row.document_date,
      p_supplier_id: null,
    }
  );
  if (genError) {
    // Fallback nếu function chưa có (migration chưa chạy)
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    document_number = "YCXK-" + row.document_date.replace(/-/g, "") + "-" + suffix;
  } else {
    document_number = genResult as string;
  }

  const { data: doc, error } = await supabase
    .from("stock_documents")
    .insert({
      document_number,
      document_date: row.document_date,
      movement_type: "outbound",
      posting_status: "draft",
      supplier_id: null,
      reason: row.reason?.trim() || "Yêu cầu xuất kho",
      notes: row.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (postingStatusFilterUnsupported(error)) {
      throw new Error(
        "Yêu cầu xuất kho cần cột posting_status. Chạy migration: supabase/sql/20260417120000_stock_posting_status.sql",
      );
    }
    throw new Error(error.message);
  }
  if (!doc) throw new Error("Không tạo được phiếu.");

  const docId = doc.id as string;

  try {
    const uniqueIds = [...new Set(row.lines.map((l) => l.product_id))];
    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id, unit_price")
      .in("id", uniqueIds);
    if (pe) throw new Error(pe.message);

    const priceMap = new Map<string, number>();
    for (const p of products ?? []) {
      priceMap.set(p.id as string, Number(p.unit_price ?? 0));
    }

    for (const line of row.lines) {
      const unit_price = priceMap.get(line.product_id) ?? 0;
      const { error: le } = await supabase.from("stock_lines").insert({
        document_id: docId,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price,
      });
      if (le) throw new Error(le.message);
    }
  } catch (e) {
    await supabase.from("stock_lines").delete().eq("document_id", docId);
    await supabase.from("stock_documents").delete().eq("id", docId);
    throw e;
  }

  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
  return { documentId: docId, document_number };
}

export async function getStockDocumentById(id: string): Promise<StockDocumentHeader | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_documents")
    .select("*, suppliers:supplier_id(code,name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const suppliers = data["suppliers"] as { code?: string; name?: string } | null;
  return {
    id: data["id"] as string,
    document_number: data["document_number"] as string,
    document_date: data["document_date"] as string,
    movement_type: data["movement_type"] as "inbound" | "outbound",
    posting_status: (data["posting_status"] as "draft" | "posted" | undefined) ?? "posted",
    supplier_id: (data["supplier_id"] as string | null) ?? null,
    supplier_code: suppliers?.code ?? null,
    supplier_name: suppliers?.name ?? null,
    reason: (data["reason"] as string | null) ?? null,
    notes: (data["notes"] as string | null) ?? null,
  };
}

export async function postStockDocument(documentId: string) {
  const supabase = createSupabaseAdmin();
  const { data: doc, error: de } = await supabase
    .from("stock_documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (de || !doc) throw new Error(de?.message ?? "Không tìm thấy phiếu.");
  const posting = doc["posting_status"] as string | undefined;
  if (posting === undefined) {
    throw new Error(
      "CSDL chưa có cột posting_status. Chạy migration: supabase/sql/20260417120000_stock_posting_status.sql",
    );
  }
  if (posting !== "draft") {
    throw new Error("Phiếu không ở trạng thái yêu cầu (nháp).");
  }

  const lines = await listStockLines(documentId);
  if (lines.length === 0) {
    throw new Error("Thêm ít nhất một dòng trước khi ghi nhận tồn.");
  }

  if (doc["movement_type"] === "outbound") {
    const need = new Map<string, number>();
    for (const l of lines) {
      need.set(l.product_id, (need.get(l.product_id) ?? 0) + l.quantity);
    }
    for (const [productId, qty] of need) {
      const { data: st, error: se } = await supabase
        .from("v_product_stock")
        .select("quantity_on_hand, product_code")
        .eq("product_id", productId)
        .maybeSingle();
      if (se) throw new Error(se.message);
      const qoh = Number(st?.quantity_on_hand ?? 0);
      if (qoh < qty) {
        const code = (st?.product_code as string | undefined) ?? productId;
        throw new Error("Không đủ tồn cho " + code + ": hiện có " + qoh + ", cần " + qty + ".");
      }
    }
  }

  const { data: updated, error: ue } = await supabase
    .from("stock_documents")
    .update({ posting_status: "posted" })
    .eq("id", documentId)
    .eq("posting_status", "draft")
    .select("id")
    .maybeSingle();
  if (ue) throw new Error(ue.message);
  if (!updated) {
    throw new Error("Không thể ghi nhận (phiếu đã xử lý hoặc không còn ở trạng thái nháp).");
  }

  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
}

export type StockLineRow = {
  id: string;
  document_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_amount: number;
  created_at: string;
  product_code?: string | null;
  product_name?: string | null;
};

export async function getStockDocumentPrintPayload(
  documentId: string,
): Promise<StockDocumentPrintPayload> {
  const supabase = createSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("stock_documents")
    .select(
      "document_number, document_date, movement_type, reason, notes, suppliers:supplier_id(code,name)",
    )
    .eq("id", documentId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy phiếu.");

  const suppliers = row["suppliers"] as { code?: string; name?: string } | null;

  const { data: lineRows, error: le } = await supabase
    .from("stock_lines")
    .select("quantity, unit_price, line_amount, products:product_id(code,name,unit)")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (le) throw new Error(le.message);

  const lines: StockDocumentPrintLine[] = (lineRows ?? []).map((r: Record<string, unknown>) => {
    const pr = r["products"] as { code?: string; name?: string; unit?: string } | null;
    return {
      product_code: pr?.code ?? "",
      product_name: pr?.name ?? "",
      unit: pr?.unit ?? "",
      quantity: Number(r["quantity"]),
      unit_price: Number(r["unit_price"]),
      line_amount: Number(r["line_amount"]),
    };
  });

  return {
    document_number: row["document_number"] as string,
    document_date: row["document_date"] as string,
    movement_type: row["movement_type"] as "inbound" | "outbound",
    partner_code: suppliers?.code ?? null,
    partner_name: suppliers?.name ?? null,
    reason: (row["reason"] as string | null) ?? null,
    notes: (row["notes"] as string | null) ?? null,
    lines,
  };
}

export async function listStockLines(documentId: string): Promise<StockLineRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_lines")
    .select(
      "id, document_id, product_id, quantity, unit_price, line_amount, created_at, products:product_id(code,name)",
    )
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const pr = r["products"] as { code?: string; name?: string } | null;
    return {
      id: r["id"] as string,
      document_id: r["document_id"] as string,
      product_id: r["product_id"] as string,
      quantity: Number(r["quantity"]),
      unit_price: Number(r["unit_price"]),
      line_amount: Number(r["line_amount"]),
      created_at: r["created_at"] as string,
      product_code: pr?.code,
      product_name: pr?.name,
    };
  });
}

const lineSchema = z.object({
  document_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
});

export async function createStockLine(input: z.infer<typeof lineSchema>) {
  const supabase = createSupabaseAdmin();
  const row = lineSchema.parse(input);
  const { error } = await supabase.from("stock_lines").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
}

export async function updateStockLine(
  id: string,
  input: z.infer<typeof lineSchema>,
) {
  const supabase = createSupabaseAdmin();
  const row = lineSchema.parse(input);
  const { error } = await supabase.from("stock_lines").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
}

export async function deleteStockLine(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("stock_lines").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
}

export type ProductStockRow = {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  product_usage: string;
  total_inbound: number;
  total_outbound: number;
  quantity_on_hand: number;
  primary_supplier_id: string | null;
  primary_supplier_code: string | null;
  primary_supplier_name: string | null;
};

export async function listProductStock(
  args: ListArgs,
): Promise<ListResult<ProductStockRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  const seg = filters.stock_segment?.trim();
  if (seg === "nvl") {
    let qNvl = supabase.from("v_material_stock").select("*", { count: "exact" });
    const g = globalSearch.trim();
    if (g) {
      const p = "%" + g + "%";
      qNvl = qNvl.or("material_code.ilike." + p + ",material_name.ilike." + p);
    }
    if (filters.product_code?.trim()) {
      qNvl = qNvl.ilike("material_code", "%" + filters.product_code.trim() + "%");
    }
    if (filters.product_name?.trim()) {
      qNvl = qNvl.ilike("material_name", "%" + filters.product_name.trim() + "%");
    }
    if (filters.unit?.trim()) {
      qNvl = qNvl.ilike("unit", "%" + filters.unit.trim() + "%");
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    qNvl = qNvl.order("material_code", { ascending: true }).range(from, to);
    const { data, error, count } = await qNvl;
    if (error) throw new Error(error.message);
    const rows: ProductStockRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
      product_id: (r["product_id"] as string) ?? (r["material_id"] as string),
      product_code: (r["material_code"] as string) ?? "",
      product_name: (r["material_name"] as string) ?? "",
      unit: r["unit"] as string,
      product_usage: "inventory",
      total_inbound: Number(r["total_inbound"] ?? 0),
      total_outbound: Number(r["total_outbound"] ?? 0),
      quantity_on_hand: Number(r["quantity_on_hand"] ?? 0),
      primary_supplier_id: (r["primary_supplier_id"] as string | null) ?? null,
      primary_supplier_code: (r["primary_supplier_code"] as string | null) ?? null,
      primary_supplier_name: (r["primary_supplier_name"] as string | null) ?? null,
    }));
    return { rows, total: count ?? 0 };
  }

  let q = supabase.from("v_product_stock").select("*", { count: "exact" });
  q = q.eq("product_usage", "sales");

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("product_code.ilike." + p + ",product_name.ilike." + p);
  }
  if (filters.product_code?.trim())
    q = q.ilike("product_code", "%" + filters.product_code.trim() + "%");
  if (filters.product_name?.trim())
    q = q.ilike("product_name", "%" + filters.product_name.trim() + "%");
  if (filters.unit?.trim())
    q = q.ilike("unit", "%" + filters.unit.trim() + "%");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("product_code", { ascending: true }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows: ProductStockRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    product_id: r["product_id"] as string,
    product_code: r["product_code"] as string,
    product_name: r["product_name"] as string,
    unit: r["unit"] as string,
    product_usage: (r["product_usage"] as string) ?? "both",
    total_inbound: Number(r["total_inbound"] ?? 0),
    total_outbound: Number(r["total_outbound"] ?? 0),
    quantity_on_hand: Number(r["quantity_on_hand"] ?? 0),
    primary_supplier_id: (r["primary_supplier_id"] as string | null) ?? null,
    primary_supplier_code: (r["primary_supplier_code"] as string | null) ?? null,
    primary_supplier_name: (r["primary_supplier_name"] as string | null) ?? null,
  }));
  return { rows, total: count ?? 0 };
}
