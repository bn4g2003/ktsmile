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
import { createCashTransaction } from "@/lib/actions/cash";

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
    if (filters.document_date?.trim())
      q = q.eq("document_date", filters.document_date.trim());
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

/** Cờ "Thanh toán ngay" cho phiếu nhập NVL — sinh tự động một phiếu chi khớp phiếu nhập. */
const inboundAutoPaymentSchema = z.object({
  payment_channel: z.string().min(1).max(100),
  transaction_date: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  description: z.string().max(2000).optional().nullable(),
});

export type InboundAutoPaymentInput = z.infer<typeof inboundAutoPaymentSchema>;

export type InboundAutoPaymentResult = {
  ok: boolean;
  message?: string;
  cashId?: string;
  amount?: number;
};

/**
 * Phiếu nhập kho NVL từ NCC: bắt buộc đã có dòng danh mục material_suppliers (fallback product_suppliers cho DB cũ).
 * Đơn giá dòng: dùng giá nhập nhập tay, hoặc giá tham chiếu trong danh mục, hoặc 0.
 */
export async function createInboundMaterialPurchase(
  input: z.infer<typeof inboundMaterialPurchaseSchema>,
  autoPaymentRaw?: InboundAutoPaymentInput | null,
): Promise<{
  documentId: string;
  document_number: string;
  autoPayment?: InboundAutoPaymentResult;
}> {
  const row = inboundMaterialPurchaseSchema.parse(input);
  const autoPayment = autoPaymentRaw
    ? inboundAutoPaymentSchema.parse(autoPaymentRaw)
    : null;
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

  let autoPaymentResult: InboundAutoPaymentResult | undefined;
  if (autoPayment) {
    const computed = row.lines.reduce((sum, line) => {
      const qty = Number(line.quantity);
      const fallback = refPriceByProduct.get(line.product_id) ?? 0;
      const price = line.unit_price != null ? Number(line.unit_price) : Number(fallback);
      const amt = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0);
      return sum + amt;
    }, 0);
    const amount = autoPayment.amount ?? Math.round(computed * 100) / 100;
    if (amount > 0) {
      try {
        const cashRes = await createCashTransaction({
          transaction_date: autoPayment.transaction_date ?? row.document_date,
          doc_number: "",
          payment_channel: autoPayment.payment_channel,
          direction: "payment",
          business_category: "Chi mua NVL / hàng hoá",
          amount,
          partner_id: null,
          supplier_id: row.supplier_id,
          payer_name: null,
          description:
            autoPayment.description?.trim() ||
            `Chi khớp phiếu nhập ${document_number}`,
          reference_type: "stock_document",
          reference_id: docId,
        });
        autoPaymentResult = { ok: true, cashId: cashRes.id, amount };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Lỗi tạo phiếu chi";
        console.warn("[createInboundMaterialPurchase] auto-payment failed:", msg);
        autoPaymentResult = { ok: false, message: msg, amount };
      }
    } else {
      autoPaymentResult = {
        ok: false,
        message: "Tổng tiền phiếu nhập = 0, không tạo phiếu chi.",
        amount: 0,
      };
    }
  }

  return { documentId: docId, document_number, autoPayment: autoPaymentResult };
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

/**
 * Lấy phiếu xuất nháp gần nhất có chứa đúng 1 dòng của sản phẩm này.
 * Dùng cho thao tác nhanh Sửa/Xóa từ màn Tồn kho.
 */
export async function getLatestSingleLineDraftOutboundByProduct(
  productId: string,
): Promise<{ id: string; document_number: string } | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_documents")
    .select("id, document_number, posting_status, movement_type, stock_lines!inner(product_id)")
    .eq("movement_type", "outbound")
    .eq("posting_status", "draft")
    .eq("stock_lines.product_id", productId)
    .order("document_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  for (const r of data ?? []) {
    const lines = (r["stock_lines"] as { product_id?: string }[] | null) ?? [];
    if (lines.length !== 1) continue;
    if (String(lines[0]?.product_id ?? "") !== productId) continue;
    return {
      id: r["id"] as string,
      document_number: r["document_number"] as string,
    };
  }
  return null;
}

/**
 * Xóa phiếu xuất nháp gần nhất của sản phẩm, chỉ khi phiếu có duy nhất 1 dòng.
 */
export async function deleteLatestSingleLineDraftOutboundByProduct(
  productId: string,
): Promise<{ deleted: boolean; document_number?: string }> {
  const doc = await getLatestSingleLineDraftOutboundByProduct(productId);
  if (!doc) return { deleted: false };
  await deleteStockDocument(doc.id);
  return { deleted: true, document_number: doc.document_number };
}

const adjustOpeningStockSchema = z.object({
  product_id: z.string().uuid(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  desired_opening_quantity: z.coerce.number(),
  note: z.string().max(500).optional().nullable(),
});

/**
 * Điều chỉnh tồn đầu kỳ bằng phiếu kho posted tại ngày trước `date_from`.
 * - desired > opening hiện tại: tạo phiếu nhập điều chỉnh
 * - desired < opening hiện tại: tạo phiếu xuất điều chỉnh
 */
export async function adjustOpeningQuantityForProduct(input: z.infer<typeof adjustOpeningStockSchema>) {
  const row = adjustOpeningStockSchema.parse(input);
  const supabase = createSupabaseAdmin();

  const fromDate = new Date(row.date_from + "T00:00:00");
  if (Number.isNaN(fromDate.getTime())) throw new Error("Ngày bắt đầu kỳ không hợp lệ.");
  const prevDate = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const prevDateStr = prevDate.toISOString().slice(0, 10);

  const { data: openingLines, error: oe } = await supabase
    .from("stock_lines")
    .select("quantity, stock_documents!inner(movement_type, document_date, posting_status)")
    .eq("product_id", row.product_id)
    .eq("stock_documents.posting_status", "posted")
    .lt("stock_documents.document_date", row.date_from);
  if (oe) throw new Error(oe.message);

  let currentOpening = 0;
  for (const ln of openingLines ?? []) {
    const d = (Array.isArray(ln.stock_documents) ? ln.stock_documents[0] : ln.stock_documents) as
      | { movement_type?: string }
      | undefined;
    const qty = Number(ln.quantity ?? 0);
    if (d?.movement_type === "inbound") currentOpening += qty;
    else if (d?.movement_type === "outbound") currentOpening -= qty;
  }

  const desired = Number(row.desired_opening_quantity);
  const delta = Math.round((desired - currentOpening) * 10000) / 10000;
  if (!Number.isFinite(delta)) throw new Error("Tồn đầu mới không hợp lệ.");
  if (Math.abs(delta) < 0.0000001) {
    return { changed: false, currentOpening, desiredOpening: desired };
  }

  const movementType: "inbound" | "outbound" = delta > 0 ? "inbound" : "outbound";
  let documentNumber = "";
  const { data: genResult, error: genError } = await supabase.rpc("generate_stock_document_number", {
    p_movement_type: movementType,
    p_document_date: prevDateStr,
    p_supplier_id: null,
  });
  if (!genError && typeof genResult === "string" && genResult.trim()) {
    documentNumber = genResult;
  } else {
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    documentNumber = (movementType === "inbound" ? "DCN-" : "DCX-") + prevDateStr.replace(/-/g, "") + "-" + suffix;
  }

  const reason =
    movementType === "inbound" ? "Điều chỉnh tăng tồn đầu kỳ" : "Điều chỉnh giảm tồn đầu kỳ";
  const { data: doc, error: de } = await supabase
    .from("stock_documents")
    .insert({
      document_number: documentNumber,
      document_date: prevDateStr,
      movement_type: movementType,
      posting_status: "posted",
      supplier_id: null,
      reason,
      notes: row.note?.trim() || `Điều chỉnh tồn đầu kỳ trước ${row.date_from}`,
    })
    .select("id")
    .single();
  if (de || !doc) throw new Error(de?.message ?? "Không tạo được phiếu điều chỉnh.");

  const { error: le } = await supabase.from("stock_lines").insert({
    document_id: doc.id as string,
    product_id: row.product_id,
    quantity: Math.abs(delta),
    unit_price: 0,
  });
  if (le) {
    await supabase.from("stock_documents").delete().eq("id", doc.id as string);
    throw new Error(le.message);
  }

  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");

  return {
    changed: true,
    documentId: doc.id as string,
    documentNumber,
    movementType,
    previousOpening: currentOpening,
    desiredOpening: desired,
    adjustedQuantity: Math.abs(delta),
  };
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
  // Periodic fields
  opening_quantity?: number;
  inbound_quantity?: number;
  outbound_quantity?: number;
  closing_quantity?: number;
  inbound_amount?: number;
  outbound_amount?: number;
};

export async function listProductStock(
  args: ListArgs,
): Promise<ListResult<ProductStockRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  const seg = filters.stock_segment?.trim();
  const isMaterial = seg === "nvl";
  const codeCol = isMaterial ? "material_code" : "product_code";
  const nameCol = isMaterial ? "material_name" : "product_name";

  let q = isMaterial
    ? supabase.from("v_material_stock").select("*", { count: "exact" })
    : supabase.from("v_product_stock").select("*", { count: "exact" });

  if (!isMaterial) {
    q = q.eq("product_usage", "sales");
  }

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or(`${codeCol}.ilike.${p},${nameCol}.ilike.${p}`);
  }
  if (filters.product_code?.trim()) {
    q = q.ilike(codeCol, "%" + filters.product_code.trim() + "%");
  }
  if (filters.product_name?.trim()) {
    q = q.ilike(nameCol, "%" + filters.product_name.trim() + "%");
  }
  if (filters.unit?.trim()) {
    q = q.ilike("unit", "%" + filters.unit.trim() + "%");
  }
  q = q.order(codeCol, { ascending: true });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);

  let rows: ProductStockRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    product_id: (r["product_id"] as string) ?? (r["material_id"] as string),
    product_code: (r["product_code"] as string) ?? (r["material_code"] as string) ?? "",
    product_name: (r["product_name"] as string) ?? (r["material_name"] as string) ?? "",
    unit: r["unit"] as string,
    product_usage: (r["product_usage"] as string) ?? (seg === "nvl" ? "inventory" : "sales"),
    total_inbound: Number(r["total_inbound"] ?? 0),
    total_outbound: Number(r["total_outbound"] ?? 0),
    quantity_on_hand: Number(r["quantity_on_hand"] ?? 0),
    primary_supplier_id: (r["primary_supplier_id"] as string | null) ?? null,
    primary_supplier_code: (r["primary_supplier_code"] as string | null) ?? null,
    primary_supplier_name: (r["primary_supplier_name"] as string | null) ?? null,
  }));

  const df = filters.date_from?.trim();
  const dt = filters.date_to?.trim();

  if (df || dt) {
    const pids = rows.map((r) => r.product_id);
    if (pids.length > 0) {
      let earlyQ = supabase
        .from("stock_lines")
        .select("product_id, quantity, stock_documents!inner(movement_type, document_date)")
        .eq("stock_documents.posting_status", "posted")
        .in("product_id", pids);
      if (df) earlyQ = earlyQ.lt("stock_documents.document_date", df);
      else earlyQ = earlyQ.lt("stock_documents.document_date", "1900-01-01");

      let periodQ = supabase
        .from("stock_lines")
        .select("product_id, quantity, line_amount, stock_documents!inner(movement_type, document_date)")
        .eq("stock_documents.posting_status", "posted")
        .in("product_id", pids);
      if (df) periodQ = periodQ.gte("stock_documents.document_date", df);
      if (dt) periodQ = periodQ.lte("stock_documents.document_date", dt);

      const [earlyRes, periodRes] = await Promise.all([earlyQ, periodQ]);
      if (earlyRes.error) throw new Error(earlyRes.error.message);
      if (periodRes.error) throw new Error(periodRes.error.message);
      const earlyLines = earlyRes.data ?? [];
      const periodLines = periodRes.data ?? [];

      const docRow = (line: { stock_documents?: unknown }) => {
        const d = line.stock_documents;
        if (d == null) return undefined;
        return (Array.isArray(d) ? d[0] : d) as { movement_type?: string; document_date?: string } | undefined;
      };

      const stats = new Map<string, { opening: number; inQ: number; outQ: number; inA: number; outA: number }>();
      for (const id of pids) stats.set(id, { opening: 0, inQ: 0, outQ: 0, inA: 0, outA: 0 });

      for (const l of earlyLines) {
        const s = stats.get(l.product_id as string);
        if (!s) continue;
        const mov = docRow(l)?.movement_type;
        const qv = Number(l.quantity || 0);
        if (mov === "inbound") s.opening += qv;
        else if (mov === "outbound") s.opening -= qv;
      }

      for (const l of periodLines) {
        const s = stats.get(l.product_id as string);
        if (!s) continue;
        const mov = docRow(l)?.movement_type;
        const qv = Number(l.quantity || 0);
        const av = Number(l.line_amount || 0);
        if (mov === "inbound") {
          s.inQ += qv;
          s.inA += av;
        } else if (mov === "outbound") {
          s.outQ += qv;
          s.outA += av;
        }
      }

      rows = rows.map((r) => {
        const s = stats.get(r.product_id);
        if (!s) return r;
        return {
          ...r,
          opening_quantity: s.opening,
          inbound_quantity: s.inQ,
          outbound_quantity: s.outQ,
          closing_quantity: s.opening + s.inQ - s.outQ,
          inbound_amount: s.inA,
          outbound_amount: s.outA,
        };
      });
    }
  }

  return { rows, total: count ?? 0 };
}
