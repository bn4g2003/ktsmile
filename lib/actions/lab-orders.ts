"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import type { LabOrderPrintLine, LabOrderPrintPayload } from "@/lib/reports/lab-order-html";

export type LabOrderRow = {
  id: string;
  order_number: string;
  received_at: string;
  partner_id: string;
  patient_name: string;
  status: "draft" | "in_progress" | "completed" | "delivered" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
  total_amount: number;
};

export async function listLabOrders(args: ListArgs): Promise<ListResult<LabOrderRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("lab_orders").select(
    "id, order_number, received_at, partner_id, patient_name, status, notes, created_at, updated_at, partners:partner_id(code,name), lab_order_lines(line_amount)",
    { count: "exact" },
  );

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or("order_number.ilike." + p + ",patient_name.ilike." + p);
  }
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.order_number?.trim())
    q = q.ilike("order_number", "%" + filters.order_number.trim() + "%");
  if (filters.received_from?.trim()) q = q.gte("received_at", filters.received_from.trim());
  if (filters.received_to?.trim()) q = q.lte("received_at", filters.received_to.trim());

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order("received_at", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows: LabOrderRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const partners = r["partners"] as { code?: string; name?: string } | null;
    const lines = r["lab_order_lines"] as { line_amount?: string | number }[] | null;
    let total = 0;
    for (const line of lines ?? []) {
      total += Number(line.line_amount ?? 0);
    }
    return {
      id: r["id"] as string,
      order_number: r["order_number"] as string,
      received_at: r["received_at"] as string,
      partner_id: r["partner_id"] as string,
      patient_name: r["patient_name"] as string,
      status: r["status"] as LabOrderRow["status"],
      notes: (r["notes"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      partner_code: partners?.code,
      partner_name: partners?.name,
      total_amount: Math.round(total * 100) / 100,
    };
  });

  return { rows, total: count ?? 0 };
}

const orderSchema = z.object({
  order_number: z.string().min(1).max(100),
  received_at: z.string().min(1),
  partner_id: z.string().uuid(),
  patient_name: z.string().min(1).max(500),
  status: z
    .enum(["draft", "in_progress", "completed", "delivered", "cancelled"])
    .optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createLabOrder(input: z.infer<typeof orderSchema>) {
  const supabase = createSupabaseAdmin();
  const row = orderSchema.parse(input);
  const { error } = await supabase.from("lab_orders").insert({
    ...row,
    status: row.status ?? "draft",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
}

export async function updateLabOrder(id: string, input: z.infer<typeof orderSchema>) {
  const supabase = createSupabaseAdmin();
  const row = orderSchema.parse(input);
  const { error } = await supabase.from("lab_orders").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/orders/" + id);
}

export async function deleteLabOrder(id: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("lab_orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
}

export type LabOrderLineRow = {
  id: string;
  order_id: string;
  product_id: string;
  tooth_positions: string;
  shade: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_amount: number;
  notes: string | null;
  created_at: string;
  product_code?: string | null;
  product_name?: string | null;
};

export async function listLabOrderLines(orderId: string): Promise<LabOrderLineRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("lab_order_lines")
    .select(
      "id, order_id, product_id, tooth_positions, shade, quantity, unit_price, discount_percent, line_amount, notes, created_at, products:product_id(code,name)",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const pr = r["products"] as { code?: string; name?: string } | null;
    return {
      id: r["id"] as string,
      order_id: r["order_id"] as string,
      product_id: r["product_id"] as string,
      tooth_positions: r["tooth_positions"] as string,
      shade: (r["shade"] as string | null) ?? null,
      quantity: Number(r["quantity"]),
      unit_price: Number(r["unit_price"]),
      discount_percent: Number(r["discount_percent"]),
      line_amount: Number(r["line_amount"]),
      notes: (r["notes"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      product_code: pr?.code,
      product_name: pr?.name,
    };
  });
}

const lineSchema = z.object({
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  tooth_positions: z.string().min(1).max(200),
  shade: z.string().max(100).optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function createLabOrderLine(input: z.infer<typeof lineSchema>) {
  const supabase = createSupabaseAdmin();
  const row = lineSchema.parse(input);
  const { error } = await supabase.from("lab_order_lines").insert({
    ...row,
    discount_percent: row.discount_percent ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/orders/" + row.order_id);
}

export async function updateLabOrderLine(
  id: string,
  input: z.infer<typeof lineSchema>,
) {
  const supabase = createSupabaseAdmin();
  const row = lineSchema.parse(input);
  const { error } = await supabase.from("lab_order_lines").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/orders/" + row.order_id);
}

export async function deleteLabOrderLine(id: string, orderId: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("lab_order_lines").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/orders/" + orderId);
}

export async function getSuggestedLinePrice(partnerId: string, productId: string) {
  const supabase = createSupabaseAdmin();
  const { data: pp } = await supabase
    .from("partner_product_prices")
    .select("unit_price")
    .eq("partner_id", partnerId)
    .eq("product_id", productId)
    .maybeSingle();
  if (pp?.unit_price != null) return Number(pp.unit_price);
  const { data: pr } = await supabase
    .from("products")
    .select("unit_price")
    .eq("id", productId)
    .single();
  return pr?.unit_price != null ? Number(pr.unit_price) : 0;
}

export async function getPartnerDefaultDiscount(partnerId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("partners")
    .select("default_discount_percent")
    .eq("id", partnerId)
    .single();
  return data?.default_discount_percent != null
    ? Number(data.default_discount_percent)
    : 0;
}

export async function getLabOrder(id: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("lab_orders")
    .select(
      "id, order_number, received_at, partner_id, patient_name, status, notes, created_at, updated_at, partners:partner_id(code,name)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function getLabOrderPrintPayload(orderId: string): Promise<LabOrderPrintPayload> {
  const supabase = createSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("lab_orders")
    .select(
      "order_number, received_at, patient_name, status, notes, partners:partner_id(code,name)",
    )
    .eq("id", orderId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy đơn.");

  const partners = row["partners"] as { code?: string; name?: string } | null;

  const { data: lineRows, error: le } = await supabase
    .from("lab_order_lines")
    .select(
      "tooth_positions, shade, quantity, unit_price, discount_percent, line_amount, notes, products:product_id(code,name,unit)",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (le) throw new Error(le.message);

  const lines: LabOrderPrintLine[] = (lineRows ?? []).map((r: Record<string, unknown>) => {
    const pr = r["products"] as { code?: string; name?: string; unit?: string } | null;
    return {
      product_code: pr?.code ?? "",
      product_name: pr?.name ?? "",
      unit: pr?.unit ?? "",
      tooth_positions: r["tooth_positions"] as string,
      shade: (r["shade"] as string | null) ?? null,
      quantity: Number(r["quantity"]),
      unit_price: Number(r["unit_price"]),
      discount_percent: Number(r["discount_percent"]),
      line_amount: Number(r["line_amount"]),
      notes: (r["notes"] as string | null) ?? null,
    };
  });

  return {
    order_number: row["order_number"] as string,
    received_at: row["received_at"] as string,
    patient_name: row["patient_name"] as string,
    status: row["status"] as string,
    partner_code: partners?.code ?? null,
    partner_name: partners?.name ?? null,
    notes: (row["notes"] as string | null) ?? null,
    lines,
  };
}

