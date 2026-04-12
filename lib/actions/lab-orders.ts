"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { decodeMultiFilter } from "@/lib/grid/multi-filter";
import type { LabOrderPrintLine, LabOrderPrintPayload } from "@/lib/reports/lab-order-html";
import {
  type LabOrderStatus,
  isAllowedLabOrderStatusTransition,
  labOrderStatusTransitionErrorMessage,
} from "@/lib/format/labels";
import { computeOrderGrandTotal } from "@/lib/billing/order-grand-total";

export type LabOrderRow = {
  id: string;
  order_number: string;
  received_at: string;
  partner_id: string;
  patient_name: string;
  clinic_name: string | null;
  status: "draft" | "in_progress" | "completed" | "delivered" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  partner_code?: string | null;
  partner_name?: string | null;
  total_amount: number;
  coord_review_status: "pending" | "verified";
  doctor_prescription_id: string | null;
  prescription_slip_code: string | null;
  billing_order_discount_percent: number;
  billing_order_discount_amount: number;
  billing_other_fees: number;
  payment_notice_doc_number: string | null;
  payment_notice_issued_at: string | null;
  grand_total: number;
};

export async function listLabOrders(args: ListArgs): Promise<ListResult<LabOrderRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  let q = supabase.from("lab_orders").select(
    "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners:partner_id(code,name), doctor_prescriptions(slip_code), lab_order_lines(line_amount)",
    { count: "exact" },
  );

  const g = globalSearch.trim();
  if (g) {
    const p = "%" + g + "%";
    q = q.or(
      "order_number.ilike." +
        p +
        ",patient_name.ilike." +
        p +
        ",clinic_name.ilike." +
        p,
    );
  }
  const st = decodeMultiFilter(filters.status);
  if (st.length === 1) q = q.eq("status", st[0]!);
  else if (st.length > 1) q = q.in("status", st);
  if (filters.order_number?.trim())
    q = q.ilike("order_number", "%" + filters.order_number.trim() + "%");
  if (filters.received_from?.trim()) q = q.gte("received_at", filters.received_from.trim());
  if (filters.received_to?.trim()) q = q.lte("received_at", filters.received_to.trim());
  const cr = decodeMultiFilter(filters.coord_review_status);
  if (cr.length === 1) q = q.eq("coord_review_status", cr[0]!);
  else if (cr.length > 1) q = q.in("coord_review_status", cr);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortAsc = filters.received_sort === "asc";
  q = q.order("received_at", { ascending: sortAsc }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const rows: LabOrderRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const partners = r["partners"] as { code?: string; name?: string } | null;
    const rawRx = r["doctor_prescriptions"] as { slip_code?: string | null } | { slip_code?: string | null }[] | null;
    const rx = Array.isArray(rawRx) ? rawRx[0] : rawRx;
    const lines = r["lab_order_lines"] as { line_amount?: string | number }[] | null;
    let total = 0;
    for (const line of lines ?? []) {
      total += Number(line.line_amount ?? 0);
    }
    const crs = r["coord_review_status"] as string | undefined;
    const subtotal = Math.round(total * 100) / 100;
    const bPct = Number(r["billing_order_discount_percent"] ?? 0);
    const bAmt = Number(r["billing_order_discount_amount"] ?? 0);
    const bFees = Number(r["billing_other_fees"] ?? 0);
    return {
      id: r["id"] as string,
      order_number: r["order_number"] as string,
      received_at: r["received_at"] as string,
      partner_id: r["partner_id"] as string,
      patient_name: r["patient_name"] as string,
      clinic_name: (r["clinic_name"] as string | null) ?? null,
      status: r["status"] as LabOrderRow["status"],
      notes: (r["notes"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      partner_code: partners?.code,
      partner_name: partners?.name,
      total_amount: subtotal,
      coord_review_status: crs === "verified" ? "verified" : "pending",
      doctor_prescription_id: (r["doctor_prescription_id"] as string | null) ?? null,
      prescription_slip_code: rx?.slip_code ?? null,
      billing_order_discount_percent: bPct,
      billing_order_discount_amount: bAmt,
      billing_other_fees: bFees,
      payment_notice_doc_number: (r["payment_notice_doc_number"] as string | null) ?? null,
      payment_notice_issued_at: (r["payment_notice_issued_at"] as string | null) ?? null,
      grand_total: computeOrderGrandTotal({
        subtotal_lines: subtotal,
        billing_order_discount_percent: bPct,
        billing_order_discount_amount: bAmt,
        billing_other_fees: bFees,
      }),
    };
  });

  return { rows, total: count ?? 0 };
}

const labOrderCreateHeaderSchema = z.object({
  received_at: z.string().min(1),
  partner_id: z.string().uuid(),
  patient_name: z.string().min(1).max(500),
  clinic_name: z.string().max(500).optional().nullable(),
  status: z
    .enum(["draft", "in_progress", "completed", "delivered", "cancelled"])
    .optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const labOrderLineDraftSchema = z.object({
  product_id: z.string().uuid(),
  tooth_positions: z.string().min(1).max(200),
  shade: z.string().max(100).optional().nullable(),
  tooth_count: z.coerce.number().int().min(0).optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  discount_amount: z.coerce.number().min(0).optional().nullable(),
  work_type: z.enum(["new_work", "warranty"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const labOrderUpdateSchema = z.object({
  order_number: z.string().min(1).max(100),
  received_at: z.string().min(1),
  partner_id: z.string().uuid(),
  patient_name: z.string().min(1).max(500),
  clinic_name: z.string().max(500).optional().nullable(),
  status: z
    .enum(["draft", "in_progress", "completed", "delivered", "cancelled"])
    .optional(),
  notes: z.string().max(2000).optional().nullable(),
});

/** Gợi ý số đơn theo ngày nhận: LO-YYYYMMDD-001 … (tránh trùng với các số cùng tiền tố). */
export async function suggestLabOrderNumber(receivedAt: string): Promise<string> {
  const supabase = createSupabaseAdmin();
  const day = receivedAt.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Ngày nhận không hợp lệ.");
  }
  const prefix = "LO-" + day.replace(/-/g, "") + "-";
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffixRe = new RegExp("^" + esc + "(\\d+)$");
  const { data, error } = await supabase
    .from("lab_orders")
    .select("order_number")
    .ilike("order_number", prefix + "%");
  if (error) throw new Error(error.message);
  let maxSeq = 0;
  for (const r of data ?? []) {
    const num = r.order_number as string;
    const m = suffixRe.exec(num);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1]!, 10));
  }
  return prefix + String(maxSeq + 1).padStart(3, "0");
}

function isUniqueViolation(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "23505") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("duplicate") || m.includes("unique");
}

/**
 * Tạo đơn: số đơn cấp tự động trên server; mặc định trạng thái "delivered" nếu không gửi.
 * Kèm danh sách dòng (có thể rỗng — thêm sau tại trang chi tiết).
 */
export async function createLabOrder(
  header: z.infer<typeof labOrderCreateHeaderSchema>,
  lines: z.infer<typeof labOrderLineDraftSchema>[] = [],
): Promise<{ id: string }> {
  const h = labOrderCreateHeaderSchema.parse(header);
  const parsedLines = lines.map((l) => labOrderLineDraftSchema.parse(l));
  const supabase = createSupabaseAdmin();
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < 15; attempt++) {
    const order_number = await suggestLabOrderNumber(h.received_at);
    const { data, error } = await supabase
      .from("lab_orders")
      .insert({
        order_number,
        received_at: h.received_at,
        partner_id: h.partner_id,
        patient_name: h.patient_name.trim(),
        clinic_name: h.clinic_name?.trim() ? h.clinic_name.trim() : null,
        status: h.status ?? "delivered",
        notes: h.notes?.trim() ? h.notes.trim() : null,
        coord_review_status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        lastErr = new Error(error.message);
        continue;
      }
      throw new Error(error.message);
    }

    const id = data!.id as string;

    try {
      for (const ln of parsedLines) {
        const { error: le } = await supabase.from("lab_order_lines").insert({
          order_id: id,
          product_id: ln.product_id,
          tooth_positions: ln.tooth_positions.trim(),
          shade: ln.shade?.trim() ? ln.shade.trim() : null,
          tooth_count: ln.tooth_count ?? null,
          quantity: ln.quantity,
          unit_price: ln.unit_price,
          discount_percent: ln.discount_percent ?? 0,
          discount_amount: ln.discount_amount ?? 0,
          work_type: ln.work_type ?? "new_work",
          notes: ln.notes?.trim() ? ln.notes.trim() : null,
        });
        if (le) throw new Error(le.message);
      }
    } catch (e) {
      await supabase.from("lab_orders").delete().eq("id", id);
      throw e;
    }

    revalidatePath("/orders");
    revalidatePath("/orders/" + id);
    return { id };
  }

  throw lastErr ?? new Error("Không cấp được số đơn duy nhất.");
}

export async function updateLabOrder(id: string, input: z.infer<typeof labOrderUpdateSchema>) {
  const supabase = createSupabaseAdmin();
  const row = labOrderUpdateSchema.parse(input);
  const { data: cur, error: e0 } = await supabase
    .from("lab_orders")
    .select("status")
    .eq("id", id)
    .single();
  if (e0) throw new Error(e0.message);
  const fromStatus = cur.status as LabOrderStatus;
  const toStatus = (row.status ?? fromStatus) as LabOrderStatus;
  if (!isAllowedLabOrderStatusTransition(fromStatus, toStatus)) {
    throw new Error(labOrderStatusTransitionErrorMessage(fromStatus, toStatus));
  }
  const { error } = await supabase.from("lab_orders").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/orders/" + id);
}

const statusOnlySchema = z.object({
  status: z.enum(["draft", "in_progress", "completed", "delivered", "cancelled"]),
});

export async function updateLabOrderStatus(
  id: string,
  status: z.infer<typeof statusOnlySchema>["status"],
) {
  const supabase = createSupabaseAdmin();
  const { status: st } = statusOnlySchema.parse({ status });
  const { data: cur, error: e0 } = await supabase
    .from("lab_orders")
    .select("status")
    .eq("id", id)
    .single();
  if (e0) throw new Error(e0.message);
  const fromStatus = cur.status as LabOrderStatus;
  if (!isAllowedLabOrderStatusTransition(fromStatus, st)) {
    throw new Error(labOrderStatusTransitionErrorMessage(fromStatus, st));
  }
  const { error } = await supabase.from("lab_orders").update({ status: st }).eq("id", id);
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
  tooth_count: number | null;
  work_type: "new_work" | "warranty";
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
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
      "id, order_id, product_id, tooth_positions, shade, tooth_count, work_type, quantity, unit_price, discount_percent, discount_amount, line_amount, notes, created_at, products:product_id(code,name)",
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
      tooth_count:
        r["tooth_count"] === null || r["tooth_count"] === undefined
          ? null
          : Number(r["tooth_count"]),
      work_type: (r["work_type"] as LabOrderLineRow["work_type"]) ?? "new_work",
      quantity: Number(r["quantity"]),
      unit_price: Number(r["unit_price"]),
      discount_percent: Number(r["discount_percent"]),
      discount_amount: Number(r["discount_amount"] ?? 0),
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
  tooth_count: z.coerce.number().int().min(0).optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  discount_amount: z.coerce.number().min(0).optional().nullable(),
  work_type: z.enum(["new_work", "warranty"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function createLabOrderLine(input: z.infer<typeof lineSchema>) {
  const supabase = createSupabaseAdmin();
  const row = lineSchema.parse(input);
  const { error } = await supabase.from("lab_order_lines").insert({
    ...row,
    discount_percent: row.discount_percent ?? 0,
    discount_amount: row.discount_amount ?? 0,
    tooth_count: row.tooth_count ?? null,
    work_type: row.work_type ?? "new_work",
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
      "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, coord_review_status, coord_reviewed_at, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners:partner_id(code,name), doctor_prescriptions(slip_code, slip_date)",
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
      "order_number, received_at, patient_name, clinic_name, status, notes, partners:partner_id(code,name)",
    )
    .eq("id", orderId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy đơn.");

  const partners = row["partners"] as { code?: string; name?: string } | null;

  const { data: lineRows, error: le } = await supabase
    .from("lab_order_lines")
    .select(
      "tooth_positions, shade, tooth_count, work_type, quantity, unit_price, discount_percent, discount_amount, line_amount, notes, products:product_id(code,name,unit)",
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
      tooth_count:
        r["tooth_count"] === null || r["tooth_count"] === undefined
          ? null
          : Number(r["tooth_count"]),
      work_type: (r["work_type"] as "new_work" | "warranty") ?? "new_work",
      quantity: Number(r["quantity"]),
      unit_price: Number(r["unit_price"]),
      discount_percent: Number(r["discount_percent"]),
      discount_amount: Number(r["discount_amount"] ?? 0),
      line_amount: Number(r["line_amount"]),
      notes: (r["notes"] as string | null) ?? null,
    };
  });

  return {
    order_number: row["order_number"] as string,
    received_at: row["received_at"] as string,
    patient_name: row["patient_name"] as string,
    clinic_name: (row["clinic_name"] as string | null) ?? null,
    status: row["status"] as string,
    partner_code: partners?.code ?? null,
    partner_name: partners?.name ?? null,
    notes: (row["notes"] as string | null) ?? null,
    lines,
  };
}

/** Đơn hàng gần nhất của một đối tác (xem nhanh trong modal). */
export async function listLabOrdersByPartner(partnerId: string, limit = 50): Promise<LabOrderRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("lab_orders")
    .select(
      "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners:partner_id(code,name), doctor_prescriptions(slip_code), lab_order_lines(line_amount)",
    )
    .eq("partner_id", partnerId)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const partners = r["partners"] as { code?: string; name?: string } | null;
    const rawRx = r["doctor_prescriptions"] as { slip_code?: string | null } | { slip_code?: string | null }[] | null;
    const rx = Array.isArray(rawRx) ? rawRx[0] : rawRx;
    const lines = r["lab_order_lines"] as { line_amount?: string | number }[] | null;
    let total = 0;
    for (const line of lines ?? []) {
      total += Number(line.line_amount ?? 0);
    }
    const crs = r["coord_review_status"] as string | undefined;
    const subtotal = Math.round(total * 100) / 100;
    const bPct = Number(r["billing_order_discount_percent"] ?? 0);
    const bAmt = Number(r["billing_order_discount_amount"] ?? 0);
    const bFees = Number(r["billing_other_fees"] ?? 0);
    return {
      id: r["id"] as string,
      order_number: r["order_number"] as string,
      received_at: r["received_at"] as string,
      partner_id: r["partner_id"] as string,
      patient_name: r["patient_name"] as string,
      clinic_name: (r["clinic_name"] as string | null) ?? null,
      status: r["status"] as LabOrderRow["status"],
      notes: (r["notes"] as string | null) ?? null,
      created_at: r["created_at"] as string,
      updated_at: r["updated_at"] as string,
      partner_code: partners?.code,
      partner_name: partners?.name,
      total_amount: subtotal,
      coord_review_status: crs === "verified" ? "verified" : "pending",
      doctor_prescription_id: (r["doctor_prescription_id"] as string | null) ?? null,
      prescription_slip_code: rx?.slip_code ?? null,
      billing_order_discount_percent: bPct,
      billing_order_discount_amount: bAmt,
      billing_other_fees: bFees,
      payment_notice_doc_number: (r["payment_notice_doc_number"] as string | null) ?? null,
      payment_notice_issued_at: (r["payment_notice_issued_at"] as string | null) ?? null,
      grand_total: computeOrderGrandTotal({
        subtotal_lines: subtotal,
        billing_order_discount_percent: bPct,
        billing_order_discount_amount: bAmt,
        billing_other_fees: bFees,
      }),
    };
  });
}

