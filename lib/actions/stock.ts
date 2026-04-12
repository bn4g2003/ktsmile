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
  partner_id: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
  line_count: number;
};

export type StockDocumentHeader = {
  id: string;
  document_number: string;
  document_date: string;
  movement_type: "inbound" | "outbound";
  posting_status: "draft" | "posted";
  partner_id: string | null;
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

export async function listStockDocuments(
  args: ListArgs,
): Promise<ListResult<StockDocumentRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  const ps = decodeMultiFilter(filters.posting_status);

  const build = (usePostingFilter: boolean) => {
    let q = supabase.from("stock_documents").select(
      "*, partners:partner_id(code,name), stock_lines(id)",
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
    const partners = r["partners"] as { code?: string; name?: string } | null;
    const sl = r["stock_lines"] as { id?: string }[] | null;
    const cnt = Array.isArray(sl) ? sl.length : 0;
    return {
      id: r["id"] as string,
      document_number: r["document_number"] as string,
      document_date: r["document_date"] as string,
      movement_type: r["movement_type"] as "inbound" | "outbound",
      posting_status: (r["posting_status"] as "draft" | "posted" | undefined) ?? "posted",
      partner_id: (r["partner_id"] as string | null) ?? null,
      reason: (r["reason"] as string | null) ?? null,
      notes: (r["notes"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      partner_code: partners?.code,
      partner_name: partners?.name,
      line_count: cnt,
    };
  });

  return { rows, total: count ?? 0 };
}

const docSchema = z.object({
  document_number: z.string().min(1).max(100),
  document_date: z.string().min(1),
  movement_type: z.enum(["inbound", "outbound"]),
  partner_id: z.string().uuid().optional().nullable(),
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

const outboundRequestSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  reason: z.string().max(500).optional().nullable(),
});

/** Tạo phiếu xuất ở trạng thái nháp + một dòng — chưa trừ tồn cho đến khi ghi nhận. */
export async function createOutboundStockRequest(input: z.infer<typeof outboundRequestSchema>) {
  const row = outboundRequestSchema.parse(input);
  const supabase = createSupabaseAdmin();
  const document_date = new Date().toISOString().slice(0, 10);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const document_number = "YCXK-" + document_date.replace(/-/g, "") + "-" + suffix;

  const { data: doc, error } = await supabase
    .from("stock_documents")
    .insert({
      document_number,
      document_date,
      movement_type: "outbound",
      posting_status: "draft",
      partner_id: null,
      reason: row.reason?.trim() || "Yêu cầu xuất kho",
      notes: null,
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

  const { data: prod, error: pe } = await supabase
    .from("products")
    .select("unit_price")
    .eq("id", row.product_id)
    .single();
  if (pe || !prod) throw new Error(pe?.message ?? "Không tìm thấy sản phẩm.");
  const unit_price = Number(prod["unit_price"] ?? 0);

  const { error: le } = await supabase.from("stock_lines").insert({
    document_id: doc.id as string,
    product_id: row.product_id,
    quantity: row.quantity,
    unit_price,
  });
  if (le) throw new Error(le.message);

  revalidatePath("/inventory/documents");
  revalidatePath("/inventory/stock");
  return doc.id as string;
}

export async function getStockDocumentById(id: string): Promise<StockDocumentHeader | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("stock_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data["id"] as string,
    document_number: data["document_number"] as string,
    document_date: data["document_date"] as string,
    movement_type: data["movement_type"] as "inbound" | "outbound",
    posting_status: (data["posting_status"] as "draft" | "posted" | undefined) ?? "posted",
    partner_id: (data["partner_id"] as string | null) ?? null,
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
      "document_number, document_date, movement_type, reason, notes, partners:partner_id(code,name)",
    )
    .eq("id", documentId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy phiếu.");

  const partners = row["partners"] as { code?: string; name?: string } | null;

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
    partner_code: partners?.code ?? null,
    partner_name: partners?.name ?? null,
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
  quantity_on_hand: number;
};

export async function listProductStock(
  args: ListArgs,
): Promise<ListResult<ProductStockRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("v_product_stock").select("*", { count: "exact" });

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("product_code.ilike." + p + ",product_name.ilike." + p);
  }
  if (filters.product_code?.trim())
    q = q.ilike("product_code", "%" + filters.product_code.trim() + "%");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("product_code", { ascending: true }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ProductStockRow[];
  return { rows, total: count ?? 0 };
}
