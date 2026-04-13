"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isSupabaseSchemaDriftError } from "@/lib/supabase/schema-drift";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { decodeMultiFilter } from "@/lib/grid/multi-filter";
import type { LabOrderPrintLine, LabOrderPrintPayload } from "@/lib/reports/lab-order-html";
import {
  type LabOrderStatus,
  isAllowedLabOrderStatusTransition,
  labOrderStatusTransitionErrorMessage,
} from "@/lib/format/labels";
import { computeOrderGrandTotal, finiteNumber } from "@/lib/billing/order-grand-total";
import { LAB_ORDER_ACCESSORY_DEFS, parseAccessoriesJson } from "@/lib/lab/order-accessories";

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
  order_category?: string;
};

/* Gợi ý FK theo tên constraint (tránh PGRST201 khi PostgREST không chọn đúng quan hệ). */
const LAB_ORDERS_LIST_SELECT_FULL =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, order_category, patient_year_of_birth, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), doctor_prescriptions!lab_orders_doctor_prescription_id_fkey(slip_code), lab_order_lines!lab_order_lines_order_id_fkey(line_amount)";

/** Trước migration 20260420 (order_category, sender_name, …). */
const LAB_ORDERS_LIST_SELECT_NO_PROD_UI =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), doctor_prescriptions!lab_orders_doctor_prescription_id_fkey(slip_code), lab_order_lines!lab_order_lines_order_id_fkey(line_amount)";

/** Trước migration 20260419 (phiếu BS, đối chiếu, GBTT trên đơn). */
const LAB_ORDERS_LIST_SELECT_LEGACY_CORE =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, partners!lab_orders_partner_id_fkey(code,name), lab_order_lines!lab_order_lines_order_id_fkey(line_amount)";

/**
 * Chỉ cột lab_orders (không embed) — khi PostgREST lỗi quan hệ/lồng lab_order_lines hoặc partners.
 * Cộng dòng = 0 cho đến khi schema/API ổn định.
 */
const LAB_ORDERS_LIST_SELECT_SCALARS_FULL =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, order_category, patient_year_of_birth, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at";

/** Scalar tối thiểu (trước migration billing / đối chiếu). */
const LAB_ORDERS_LIST_SELECT_SCALARS_LEGACY =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at";

/** Khi embed phiếu BS vẫn lỗi — bỏ doctor_prescriptions, giữ tổng dòng. */
const LAB_ORDERS_LIST_SELECT_NO_RX_EMBED =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, order_category, patient_year_of_birth, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), lab_order_lines!lab_order_lines_order_id_fkey(line_amount)";

const LAB_ORDERS_LIST_SELECT_NO_PROD_UI_NO_RX =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), lab_order_lines!lab_order_lines_order_id_fkey(line_amount)";

function mapLabOrderListRow(r: Record<string, unknown>): LabOrderRow {
  const partners = r["partners"] as { code?: string; name?: string } | null;
  const rawRx = r["doctor_prescriptions"] as { slip_code?: string | null } | { slip_code?: string | null }[] | null;
  const rx = Array.isArray(rawRx) ? rawRx[0] : rawRx;
  const lines = r["lab_order_lines"] as { line_amount?: string | number }[] | null;
  let total = 0;
  for (const line of lines ?? []) {
    total += finiteNumber(line.line_amount);
  }
  const crs = r["coord_review_status"] as string | undefined;
  const subtotal = Math.round(total * 100) / 100;
  const bPct = finiteNumber(r["billing_order_discount_percent"]);
  const bAmt = finiteNumber(r["billing_order_discount_amount"]);
  const bFees = finiteNumber(r["billing_other_fees"]);
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
    coord_review_status: crs === "pending" ? "pending" : "verified",
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
    order_category: (r["order_category"] as string | undefined) ?? "new_work",
  };
}

type ListLabOrdersSelectTier =
  | "full"
  | "noProdUi"
  | "noRxEmbed"
  | "noProdUiNoRx"
  | "legacyCore"
  | "scalarsFull"
  | "scalarsLegacy";

export async function listLabOrders(args: ListArgs): Promise<ListResult<LabOrderRow>> {
  const supabase = createSupabaseAdmin();
  const { page, pageSize, globalSearch, filters } = args;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortAsc = filters.received_sort === "asc";

  const tiers: ListLabOrdersSelectTier[] = [
    "full",
    "noProdUi",
    "noRxEmbed",
    "noProdUiNoRx",
    "legacyCore",
    "scalarsFull",
    "scalarsLegacy",
  ];
  const selectFor: Record<ListLabOrdersSelectTier, string> = {
    full: LAB_ORDERS_LIST_SELECT_FULL,
    noProdUi: LAB_ORDERS_LIST_SELECT_NO_PROD_UI,
    noRxEmbed: LAB_ORDERS_LIST_SELECT_NO_RX_EMBED,
    noProdUiNoRx: LAB_ORDERS_LIST_SELECT_NO_PROD_UI_NO_RX,
    legacyCore: LAB_ORDERS_LIST_SELECT_LEGACY_CORE,
    scalarsFull: LAB_ORDERS_LIST_SELECT_SCALARS_FULL,
    scalarsLegacy: LAB_ORDERS_LIST_SELECT_SCALARS_LEGACY,
  };

  let lastMessage = "";
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]!;
    let q = supabase.from("lab_orders").select(selectFor[tier], { count: "exact" });

    const g = globalSearch.trim();
    if (g) {
      const p = "%" + g + "%";
      q = q.or(
        "order_number.ilike." + p + ",patient_name.ilike." + p + ",clinic_name.ilike." + p,
      );
    }
    const st = decodeMultiFilter(filters.status);
    if (st.length === 1) q = q.eq("status", st[0]!);
    else if (st.length > 1) q = q.in("status", st);
    if (filters.order_number?.trim())
      q = q.ilike("order_number", "%" + filters.order_number.trim() + "%");
    if (filters.received_from?.trim()) q = q.gte("received_at", filters.received_from.trim());
    if (filters.received_to?.trim()) q = q.lte("received_at", filters.received_to.trim());
    const skipCoordReviewFilter = tier === "legacyCore" || tier === "scalarsLegacy";
    if (!skipCoordReviewFilter) {
      const cr = decodeMultiFilter(filters.coord_review_status);
      if (cr.length === 1) q = q.eq("coord_review_status", cr[0]!);
      else if (cr.length > 1) q = q.in("coord_review_status", cr);
    }

    q = q.order("received_at", { ascending: sortAsc }).range(from, to);
    const { data, error, count } = await q;
    if (!error) {
      const rows: LabOrderRow[] = (data ?? []).map((r) =>
        mapLabOrderListRow(r as unknown as Record<string, unknown>),
      );
      return { rows, total: count ?? 0 };
    }
    lastMessage = error.message;
    const retry = i < tiers.length - 1 && isSupabaseSchemaDriftError(error.message);
    if (!retry) {
      throw new Error(
        error.message +
          (isSupabaseSchemaDriftError(error.message)
            ? " — Chạy các file SQL trong supabase/sql theo thứ tự trên project Supabase (migration đồng bộ schema)."
            : ""),
      );
    }
  }

  throw new Error(lastMessage || "Không tải được danh sách đơn.");
}

const labOrderProductionHeaderSchema = z.object({
  patient_year_of_birth: z
    .preprocess(
      (v) =>
        v === "" || v === undefined || v === null || (typeof v === "number" && Number.isNaN(v))
          ? null
          : v,
      z.coerce.number().int().min(1900).max(new Date().getFullYear()).nullable(),
    )
    .optional(),
  patient_gender: z.enum(["male", "female", "unspecified"]).optional().nullable(),
  order_category: z.enum(["new_work", "warranty", "repair"]).optional(),
  due_completion_at: z.string().max(40).optional().nullable(),
  due_delivery_at: z.string().max(40).optional().nullable(),
  clinical_indication: z.string().max(8000).optional().nullable(),
  margin_above_gingiva: z.boolean().optional(),
  margin_at_gingiva: z.boolean().optional(),
  margin_subgingival: z.boolean().optional(),
  margin_shoulder: z.boolean().optional(),
  notes_accounting: z.string().max(2000).optional().nullable(),
  notes_coordination: z.string().max(2000).optional().nullable(),
  accessories: z.record(z.string(), z.number().int().min(0)).optional(),
});

const labOrderCreateHeaderSchema = z
  .object({
    received_at: z.string().min(1),
    partner_id: z.string().uuid(),
    patient_name: z.string().min(1).max(500),
    clinic_name: z.string().max(500).optional().nullable(),
    status: z
      .enum(["draft", "in_progress", "completed", "delivered", "cancelled"])
      .optional(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .merge(labOrderProductionHeaderSchema);

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
  arch_connection: z.enum(["unit", "bridge"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const labOrderUpdateSchema = z
  .object({
    order_number: z.string().min(1).max(100),
    received_at: z.string().min(1),
    partner_id: z.string().uuid(),
    patient_name: z.string().min(1).max(500),
    clinic_name: z.string().max(500).optional().nullable(),
    status: z
      .enum(["draft", "in_progress", "completed", "delivered", "cancelled"])
      .optional(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .merge(labOrderProductionHeaderSchema);

function productionColumnsFromHeader(h: z.infer<typeof labOrderProductionHeaderSchema>): Record<string, unknown> {
  const accessories: Record<string, number> = {};
  if (h.accessories) {
    for (const [k, v] of Object.entries(h.accessories)) {
      if (typeof v === "number" && v > 0) accessories[k] = Math.floor(v);
    }
  }
  return {
    patient_year_of_birth: h.patient_year_of_birth ?? null,
    patient_gender: h.patient_gender ?? null,
    order_category: h.order_category ?? "new_work",
    due_completion_at: h.due_completion_at?.trim() ? h.due_completion_at.trim() : null,
    due_delivery_at: h.due_delivery_at?.trim() ? h.due_delivery_at.trim() : null,
    clinical_indication: h.clinical_indication?.trim() ? h.clinical_indication.trim() : null,
    margin_above_gingiva: h.margin_above_gingiva ?? false,
    margin_at_gingiva: h.margin_at_gingiva ?? false,
    margin_subgingival: h.margin_subgingival ?? false,
    margin_shoulder: h.margin_shoulder ?? false,
    notes_accounting: h.notes_accounting?.trim() ? h.notes_accounting.trim() : null,
    notes_coordination: h.notes_coordination?.trim() ? h.notes_coordination.trim() : null,
    accessories,
  };
}

/** Gợi ý số đơn theo định dạng: MãKH-YYMMDD-xxx (ví dụ: Labhcm01-130426-001) */
export async function suggestLabOrderNumber(partnerCode: string, receivedAt: string): Promise<string> {
  const supabase = createSupabaseAdmin();
  const day = receivedAt.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Ngày nhận không hợp lệ.");
  }
  // Format: YYMMDD (2 số năm + 2 số tháng + 2 số ngày)
  const datePart = day.slice(2, 4) + day.slice(5, 7) + day.slice(8, 10);
  const codePrefix = (partnerCode || "UNK").toLowerCase();
  const prefix = codePrefix + "-" + datePart + "-";
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffixRe = new RegExp("^" + esc + "(\\d+)$", "i");
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
 * Tạo đơn: số đơn cấp tự động trên server theo định dạng MãKH-YYMMDD-xxx; mặc định trạng thái "delivered" nếu không gửi.
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

  // Lấy mã khách hàng
  const { data: partner, error: pe } = await supabase
    .from("partners")
    .select("code")
    .eq("id", h.partner_id)
    .single();
  if (pe || !partner) {
    throw new Error("Không tìm thấy khách hàng.");
  }
  const partnerCode = (partner as { code: string }).code;

  for (let attempt = 0; attempt < 15; attempt++) {
    const order_number = await suggestLabOrderNumber(partnerCode, h.received_at);
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
        ...productionColumnsFromHeader(h),
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
          arch_connection: ln.arch_connection ?? "unit",
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
  const prod = labOrderProductionHeaderSchema.parse(row);
  const {
    order_number,
    received_at,
    partner_id,
    patient_name,
    clinic_name,
    status,
    notes,
  } = row;
  const { error } = await supabase
    .from("lab_orders")
    .update({
      order_number,
      received_at,
      partner_id,
      patient_name,
      clinic_name,
      status,
      notes,
      ...productionColumnsFromHeader(prod),
    })
    .eq("id", id);
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
  arch_connection: "unit" | "bridge";
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
      "id, order_id, product_id, tooth_positions, shade, tooth_count, work_type, arch_connection, quantity, unit_price, discount_percent, discount_amount, line_amount, notes, created_at, products!lab_order_lines_product_id_fkey(code,name)",
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
          : Math.floor(finiteNumber(r["tooth_count"])),
      work_type: (r["work_type"] as LabOrderLineRow["work_type"]) ?? "new_work",
      arch_connection: (r["arch_connection"] as LabOrderLineRow["arch_connection"]) ?? "unit",
      quantity: finiteNumber(r["quantity"], 0) || 0,
      unit_price: finiteNumber(r["unit_price"]),
      discount_percent: finiteNumber(r["discount_percent"]),
      discount_amount: finiteNumber(r["discount_amount"]),
      line_amount: finiteNumber(r["line_amount"]),
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
  arch_connection: z.enum(["unit", "bridge"]).optional(),
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
    arch_connection: row.arch_connection ?? "unit",
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
      "id, order_number, received_at, partner_id, patient_name, clinic_name, status, notes, created_at, updated_at, coord_review_status, coord_reviewed_at, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, patient_year_of_birth, patient_gender, order_category, due_completion_at, due_delivery_at, clinical_indication, margin_above_gingiva, margin_at_gingiva, margin_subgingival, margin_shoulder, notes_accounting, notes_coordination, accessories, partners!lab_orders_partner_id_fkey(code,name), doctor_prescriptions!lab_orders_doctor_prescription_id_fkey(slip_code, slip_date)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

function accessoriesSummaryFromRow(accessoriesRaw: unknown): string | null {
  const acc = parseAccessoriesJson(accessoriesRaw);
  const parts: string[] = [];
  for (const d of LAB_ORDER_ACCESSORY_DEFS) {
    const q = acc[d.key];
    if (q && q > 0) parts.push(q > 1 ? d.label + " ×" + q : d.label);
  }
  return parts.length ? parts.join(", ") : null;
}

function marginSummaryFromRow(r: Record<string, unknown>): string | null {
  const bits: string[] = [];
  if (r["margin_above_gingiva"]) bits.push("Trên nướu");
  if (r["margin_at_gingiva"]) bits.push("Ngang nướu");
  if (r["margin_subgingival"]) bits.push("Dưới nướu");
  if (r["margin_shoulder"]) bits.push("Bờ vai");
  return bits.length ? bits.join(", ") : null;
}

export async function getLabOrderPrintPayload(orderId: string): Promise<LabOrderPrintPayload> {
  const supabase = createSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("lab_orders")
    .select(
      "order_number, received_at, patient_name, clinic_name, status, notes, patient_year_of_birth, patient_gender, order_category, due_completion_at, due_delivery_at, clinical_indication, margin_above_gingiva, margin_at_gingiva, margin_subgingival, margin_shoulder, notes_accounting, notes_coordination, accessories, partners!lab_orders_partner_id_fkey(code,name)",
    )
    .eq("id", orderId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy đơn.");

  const rec = row as Record<string, unknown>;
  const partners = rec["partners"] as { code?: string; name?: string } | null;

  const { data: lineRows, error: le } = await supabase
    .from("lab_order_lines")
    .select(
      "tooth_positions, shade, tooth_count, work_type, arch_connection, quantity, unit_price, discount_percent, discount_amount, line_amount, notes, products!lab_order_lines_product_id_fkey(code,name,unit)",
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
      arch_connection: (r["arch_connection"] as string) ?? "unit",
      quantity: Number(r["quantity"]),
      unit_price: Number(r["unit_price"]),
      discount_percent: Number(r["discount_percent"]),
      discount_amount: Number(r["discount_amount"] ?? 0),
      line_amount: Number(r["line_amount"]),
      notes: (r["notes"] as string | null) ?? null,
    };
  });

  const pg = rec["patient_gender"] as string | null | undefined;
  return {
    order_number: rec["order_number"] as string,
    received_at: rec["received_at"] as string,
    patient_name: rec["patient_name"] as string,
    clinic_name: (rec["clinic_name"] as string | null) ?? null,
    status: rec["status"] as string,
    partner_code: partners?.code ?? null,
    partner_name: partners?.name ?? null,
    notes: (rec["notes"] as string | null) ?? null,
    order_category: (rec["order_category"] as string | undefined) ?? undefined,
    patient_year_of_birth:
      rec["patient_year_of_birth"] === null || rec["patient_year_of_birth"] === undefined
        ? null
        : Number(rec["patient_year_of_birth"]),
    patient_gender: pg ?? null,
    due_completion_at: (rec["due_completion_at"] as string | null) ?? null,
    due_delivery_at: (rec["due_delivery_at"] as string | null) ?? null,
    clinical_indication: (rec["clinical_indication"] as string | null) ?? null,
    margin_summary: marginSummaryFromRow(rec),
    notes_accounting: (rec["notes_accounting"] as string | null) ?? null,
    notes_coordination: (rec["notes_coordination"] as string | null) ?? null,
    accessories_summary: accessoriesSummaryFromRow(rec["accessories"]),
    lines,
  };
}

/** Đơn hàng gần nhất của một đối tác (xem nhanh trong modal). */
export async function listLabOrdersByPartner(partnerId: string, limit = 50): Promise<LabOrderRow[]> {
  const supabase = createSupabaseAdmin();
  const tiers: ListLabOrdersSelectTier[] = [
    "full",
    "noProdUi",
    "noRxEmbed",
    "noProdUiNoRx",
    "legacyCore",
    "scalarsFull",
    "scalarsLegacy",
  ];
  const selectFor: Record<ListLabOrdersSelectTier, string> = {
    full: LAB_ORDERS_LIST_SELECT_FULL,
    noProdUi: LAB_ORDERS_LIST_SELECT_NO_PROD_UI,
    noRxEmbed: LAB_ORDERS_LIST_SELECT_NO_RX_EMBED,
    noProdUiNoRx: LAB_ORDERS_LIST_SELECT_NO_PROD_UI_NO_RX,
    legacyCore: LAB_ORDERS_LIST_SELECT_LEGACY_CORE,
    scalarsFull: LAB_ORDERS_LIST_SELECT_SCALARS_FULL,
    scalarsLegacy: LAB_ORDERS_LIST_SELECT_SCALARS_LEGACY,
  };
  let lastMessage = "";
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]!;
    const { data, error } = await supabase
      .from("lab_orders")
      .select(selectFor[tier])
      .eq("partner_id", partnerId)
      .order("received_at", { ascending: false })
      .limit(limit);
    if (!error) {
      return (data ?? []).map((r) => mapLabOrderListRow(r as unknown as Record<string, unknown>));
    }
    lastMessage = error.message;
    const retry = i < tiers.length - 1 && isSupabaseSchemaDriftError(error.message);
    if (!retry) throw new Error(error.message);
  }
  throw new Error(lastMessage || "Không tải được đơn theo đối tác.");
}

