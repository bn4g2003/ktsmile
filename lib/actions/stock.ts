"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import type {
  StockDocumentPrintLine,
  StockDocumentPrintPayload,
} from "@/lib/reports/stock-voucher-html";

export type StockDocumentRow = {
  id: string;
  document_number: string;
  document_date: string;
  movement_type: "inbound" | "outbound";
  partner_id: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
  line_count: number;
};

export async function listStockDocuments(
  args: ListArgs,
): Promise<ListResult<StockDocumentRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("stock_documents").select(
    "id, document_number, document_date, movement_type, partner_id, reason, notes, created_at, updated_at, partners:partner_id(code,name), stock_lines(id)",
    { count: "exact" },
  );

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("document_number.ilike." + p + ",reason.ilike." + p + ",notes.ilike." + p);
  }
  if (filters.movement_type) q = q.eq("movement_type", filters.movement_type);
  if (filters.document_number?.trim())
    q = q.ilike("document_number", "%" + filters.document_number.trim() + "%");
  if (filters.document_date_from?.trim())
    q = q.gte("document_date", filters.document_date_from.trim());
  if (filters.document_date_to?.trim())
    q = q.lte("document_date", filters.document_date_to.trim());

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("document_date", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
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
  const { error } = await supabase.from("stock_documents").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
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
}

export async function deleteStockDocument(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("stock_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
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
}

export async function deleteStockLine(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("stock_lines").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory/documents");
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
