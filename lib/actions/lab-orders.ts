"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isSupabaseSchemaDriftError } from "@/lib/supabase/schema-drift";
import type { ListArgs, ListResult } from "@/components/shared/data-grid/excel-data-grid";
import { decodeMultiFilter } from "@/lib/grid/multi-filter";
import type { LabOrderPrintLine, LabOrderPrintPayload } from "@/lib/reports/lab-order-html";
import type { DeliveryNoteLine, DeliveryNotePayload } from "@/lib/reports/delivery-note-html";
import { getPartnerMonthOpeningAndReceipts } from "@/lib/actions/debt";
import {
  type LabOrderStatus,
  isAllowedLabOrderStatusTransition,
  labOrderStatusTransitionErrorMessage,
} from "@/lib/format/labels";
import { computeOrderGrandTotal, finiteNumber } from "@/lib/billing/order-grand-total";
import { LAB_ORDER_ACCESSORY_DEFS, parseAccessoriesJson } from "@/lib/lab/order-accessories";
import { createCashTransaction } from "@/lib/actions/cash";

export type LabOrderRow = {
  id: string;
  order_number: string;
  received_at: string;
  partner_id: string;
  patient_name: string;
  clinic_name: string | null;
  contact_phone: string | null;
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
  // Thông tin tổng hợp từ dòng chi tiết
  tooth_positions_summary?: string | null;
  tooth_count_total?: number | null;
  /** Tóm tắt mã/tên SP các dòng (in danh sách / báo cáo). */
  products_summary?: string | null;
  /** Tổng quantity các dòng chi tiết. */
  line_quantity_total?: number | null;
};

/* Gợi ý FK theo tên constraint (tránh PGRST201 khi PostgREST không chọn đúng quan hệ). */
const LAB_ORDERS_LIST_SELECT_FULL =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, contact_phone, status, notes, created_at, updated_at, order_category, patient_year_of_birth, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), doctor_prescriptions!lab_orders_doctor_prescription_id_fkey(slip_code), lab_order_lines!lab_order_lines_order_id_fkey(line_amount,tooth_positions,tooth_count,quantity,products!lab_order_lines_product_id_fkey(code,name))";

/** Trước migration 20260420 (order_category, sender_name, …). */
const LAB_ORDERS_LIST_SELECT_NO_PROD_UI =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, contact_phone, status, notes, created_at, updated_at, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), doctor_prescriptions!lab_orders_doctor_prescription_id_fkey(slip_code), lab_order_lines!lab_order_lines_order_id_fkey(line_amount,tooth_positions,tooth_count,quantity,products!lab_order_lines_product_id_fkey(code,name))";

/** Trước migration 20260419 (phiếu BS, đối chiếu, GBTT trên đơn). */
const LAB_ORDERS_LIST_SELECT_LEGACY_CORE =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, contact_phone, status, notes, created_at, updated_at, partners!lab_orders_partner_id_fkey(code,name), lab_order_lines!lab_order_lines_order_id_fkey(line_amount,tooth_positions,tooth_count,quantity,products!lab_order_lines_product_id_fkey(code,name))";

/**
 * Chỉ cột lab_orders (không embed) — khi PostgREST lỗi quan hệ/lồng lab_order_lines hoặc partners.
 * Cộng dòng = 0 cho đến khi schema/API ổn định.
 */
const LAB_ORDERS_LIST_SELECT_SCALARS_FULL =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, contact_phone, status, notes, created_at, updated_at, order_category, patient_year_of_birth, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at";

/** Scalar tối thiểu (trước migration billing / đối chiếu). */
const LAB_ORDERS_LIST_SELECT_SCALARS_LEGACY =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, contact_phone, status, notes, created_at, updated_at";

/** Khi embed phiếu BS vẫn lỗi — bỏ doctor_prescriptions, giữ tổng dòng. */
const LAB_ORDERS_LIST_SELECT_NO_RX_EMBED =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, contact_phone, status, notes, created_at, updated_at, order_category, patient_year_of_birth, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), lab_order_lines!lab_order_lines_order_id_fkey(line_amount,tooth_positions,tooth_count,quantity,products!lab_order_lines_product_id_fkey(code,name))";

const LAB_ORDERS_LIST_SELECT_NO_PROD_UI_NO_RX =
  "id, order_number, received_at, partner_id, patient_name, clinic_name, contact_phone, status, notes, created_at, updated_at, coord_review_status, doctor_prescription_id, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, payment_notice_doc_number, payment_notice_issued_at, partners!lab_orders_partner_id_fkey(code,name), lab_order_lines!lab_order_lines_order_id_fkey(line_amount,tooth_positions,tooth_count,quantity,products!lab_order_lines_product_id_fkey(code,name))";

function mapLabOrderListRow(r: Record<string, unknown>): LabOrderRow {
  const partners = r["partners"] as { code?: string; name?: string } | null;
  const rawRx = r["doctor_prescriptions"] as { slip_code?: string | null } | { slip_code?: string | null }[] | null;
  const rx = Array.isArray(rawRx) ? rawRx[0] : rawRx;
  const lines = r["lab_order_lines"] as {
    line_amount?: string | number;
    tooth_positions?: string;
    tooth_count?: number | null;
    quantity?: string | number | null;
    products?: { code?: string; name?: string } | null;
  }[] | null;
  let total = 0;
  // Tổng hợp vị trí răng và số lượng răng
  const toothPositionsSet = new Set<string>();
  let toothCountTotal = 0;
  const productLineLabels: string[] = [];
  let lineQuantityTotal = 0;
  for (const line of lines ?? []) {
    total += finiteNumber(line.line_amount);
    const q = finiteNumber(line.quantity);
    if (q > 0) lineQuantityTotal += q;
    const pr = line.products;
    const code = pr?.code?.trim();
    const name = pr?.name?.trim();
    const label = code && name ? `${code} — ${name}` : code || name || "";
    if (label) productLineLabels.push(label);
    // Thu thập vị trí răng
    if (line.tooth_positions?.trim()) {
      const positions = line.tooth_positions.split(",").map((p) => p.trim()).filter(Boolean);
      for (const pos of positions) {
        toothPositionsSet.add(pos);
      }
    }
    // Cộng số lượng răng
    if (line.tooth_count != null && typeof line.tooth_count === "number") {
      toothCountTotal += line.tooth_count;
    }
  }
  const seenProducts = new Set<string>();
  const productsSummary =
    productLineLabels.filter((lbl) => {
      if (seenProducts.has(lbl)) return false;
      seenProducts.add(lbl);
      return true;
    }).join("; ") || null;
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
    contact_phone: (r["contact_phone"] as string | null) ?? null,
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
    tooth_positions_summary: toothPositionsSet.size > 0 ? [...toothPositionsSet].sort((a, b) => {
      // Sắp xếp theo số răng (FDI notation)
      const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    }).join(", ") : null,
    tooth_count_total: toothCountTotal > 0 ? toothCountTotal : null,
    products_summary: productsSummary,
    line_quantity_total: lineQuantityTotal > 0 ? lineQuantityTotal : null,
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
  let partnerIdsByFilter: string[] | null = null;
  const partnerCodeFilter = args.filters.partner_code?.trim();
  const partnerNameFilter = args.filters.partner_name?.trim();
  if (partnerCodeFilter || partnerNameFilter) {
    let pq = supabase.from("partners").select("id").limit(5000);
    if (partnerCodeFilter) pq = pq.ilike("code", "%" + partnerCodeFilter + "%");
    if (partnerNameFilter) pq = pq.ilike("name", "%" + partnerNameFilter + "%");
    const { data: pData, error: pErr } = await pq;
    if (pErr) throw new Error(pErr.message);
    partnerIdsByFilter = (pData ?? []).map((r) => r.id as string);
    if (!partnerIdsByFilter.length) return { rows: [], total: 0 };
  }

  let lastMessage = "";
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]!;
    let q = supabase.from("lab_orders").select(selectFor[tier], { count: "exact" });

    const g = globalSearch.trim();
    if (g) {
      const p = "%" + g + "%";
      // Tìm kiếm trên các cột trực tiếp và mở rộng tìm kiếm qua partners
      q = q.or(
        "order_number.ilike." + p + ",patient_name.ilike." + p + ",clinic_name.ilike." + p,
      );
    }
    const st = decodeMultiFilter(filters.status);
    if (st.length === 1) q = q.eq("status", st[0]!);
    else if (st.length > 1) q = q.in("status", st);
    if (filters.order_number?.trim())
      q = q.ilike("order_number", "%" + filters.order_number.trim() + "%");
    if (filters.partner_id?.trim()) q = q.eq("partner_id", filters.partner_id.trim());
    else if (partnerIdsByFilter) q = q.in("partner_id", partnerIdsByFilter);
    if (filters.received_from?.trim()) q = q.gte("received_at", filters.received_from.trim());
    if (filters.received_to?.trim()) q = q.lte("received_at", filters.received_to.trim());
    if (filters.received_day?.trim()) q = q.eq("received_at", filters.received_day.trim());
    // Lọc theo tên bệnh nhân, nha khoa (cột trực tiếp trên lab_orders)
    if (filters.patient_name?.trim())
      q = q.ilike("patient_name", "%" + filters.patient_name.trim() + "%");
    if (filters.clinic_name?.trim())
      q = q.ilike("clinic_name", "%" + filters.clinic_name.trim() + "%");
    if (filters.contact_phone?.trim())
      q = q.ilike("contact_phone", "%" + filters.contact_phone.trim() + "%");
    const orderCategory = filters.order_category?.trim();
    if (orderCategory === "new_work" || orderCategory === "warranty" || orderCategory === "repair") {
      q = q.eq("order_category", orderCategory);
    }
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
    contact_phone: z.string().max(50).optional().nullable(),
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

/** Cờ "Thanh toán ngay" khi tạo đơn — sinh tự động một phiếu thu khớp đơn. */
const labOrderAutoPaymentSchema = z.object({
  payment_channel: z.string().min(1).max(100),
  transaction_date: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  description: z.string().max(2000).optional().nullable(),
});

export type LabOrderAutoPaymentInput = z.infer<typeof labOrderAutoPaymentSchema>;

export type LabOrderAutoPaymentResult = {
  ok: boolean;
  message?: string;
  cashId?: string;
  amount?: number;
};

const labOrderUpdateSchema = z
  .object({
    order_number: z.string().min(1).max(100),
    received_at: z.string().min(1),
    partner_id: z.string().uuid(),
    patient_name: z.string().min(1).max(500),
    clinic_name: z.string().max(500).optional().nullable(),
    contact_phone: z.string().max(50).optional().nullable(),
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

/** Chỉ SP bán hoặc cả hai — không cho NVL thuần (`inventory`) trên đơn lab. */
export async function assertProductIdsAllowedOnLabOrder(productIds: string[]) {
  const uniq = [...new Set(productIds.filter(Boolean))];
  if (!uniq.length) return;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id, code, product_usage")
    .in("id", uniq);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length !== uniq.length) {
    throw new Error("Một số sản phẩm không tồn tại.");
  }
  for (const r of rows) {
    if (r.product_usage === "inventory") {
      throw new Error(
        `Sản phẩm «${r.code}» chỉ là NVL kho — không dùng trên đơn phòng khám/labo.`,
      );
    }
  }
}

/**
 * Tạo đơn: số đơn cấp tự động trên server theo định dạng MãKH-YYMMDD-xxx; mặc định trạng thái "delivered" nếu không gửi.
 * Kèm danh sách dòng (có thể rỗng — thêm sau tại trang chi tiết).
 */
export async function createLabOrder(
  header: z.infer<typeof labOrderCreateHeaderSchema>,
  lines: z.infer<typeof labOrderLineDraftSchema>[] = [],
  autoPaymentRaw?: LabOrderAutoPaymentInput | null,
): Promise<{ id: string; autoPayment?: LabOrderAutoPaymentResult }> {
  const h = labOrderCreateHeaderSchema.parse(header);
  const parsedLines = lines.map((l) => labOrderLineDraftSchema.parse(l));
  const autoPayment = autoPaymentRaw
    ? labOrderAutoPaymentSchema.parse(autoPaymentRaw)
    : null;
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

  await assertProductIdsAllowedOnLabOrder(parsedLines.map((l) => l.product_id));

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
        contact_phone: h.contact_phone?.trim() ? h.contact_phone.trim() : null,
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

    let autoPaymentResult: LabOrderAutoPaymentResult | undefined;
    if (autoPayment) {
      const computed = parsedLines.reduce((sum, ln) => {
        const qty = finiteNumber(ln.quantity);
        const price = finiteNumber(ln.unit_price);
        const dp = finiteNumber(ln.discount_percent ?? 0);
        const da = finiteNumber(ln.discount_amount ?? 0);
        const lineAfterPct = qty * price * (1 - dp / 100);
        const lineAmount = Math.max(0, lineAfterPct - da);
        return sum + lineAmount;
      }, 0);
      const amount = autoPayment.amount ?? Math.round(computed * 100) / 100;
      if (amount > 0) {
        try {
          const cashRes = await createCashTransaction({
            transaction_date: autoPayment.transaction_date ?? h.received_at,
            doc_number: "",
            payment_channel: autoPayment.payment_channel,
            direction: "receipt",
            business_category: "Thu bán hàng / dịch vụ",
            amount,
            partner_id: h.partner_id,
            supplier_id: null,
            payer_name: null,
            description:
              autoPayment.description?.trim() || `Thu khớp đơn ${order_number}`,
            reference_type: "lab_order",
            reference_id: id,
          });
          autoPaymentResult = { ok: true, cashId: cashRes.id, amount };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Lỗi tạo phiếu thu";
          console.warn("[createLabOrder] auto-payment failed:", msg);
          autoPaymentResult = { ok: false, message: msg, amount };
        }
      } else {
        autoPaymentResult = {
          ok: false,
          message: "Tổng tiền đơn = 0, không tạo phiếu thu.",
          amount: 0,
        };
      }
    }

    return { id, autoPayment: autoPaymentResult };
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
    contact_phone,
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
      contact_phone,
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
  await assertProductIdsAllowedOnLabOrder([row.product_id]);
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
  const { data: prev, error: e0 } = await supabase
    .from("lab_order_lines")
    .select("product_id")
    .eq("id", id)
    .single();
  if (e0) throw new Error(e0.message);
  if ((prev?.product_id as string | undefined) !== row.product_id) {
    await assertProductIdsAllowedOnLabOrder([row.product_id]);
  }
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

/** Giá + CK gợi ý khi chọn KH + SP ở form dòng đơn. */
export async function getSuggestedLinePricing(
  partnerId: string,
  productId: string,
): Promise<{ unit_price: number; discount_percent: number }> {
  const supabase = createSupabaseAdmin();

  const [{ data: pp }, { data: pr }, partnerDisc] = await Promise.all([
    supabase
      .from("partner_product_prices")
      .select("unit_price")
      .eq("partner_id", partnerId)
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("products")
      .select("unit_price")
      .eq("id", productId)
      .maybeSingle(),
    getPartnerDefaultDiscount(partnerId),
  ]);

  const basePrice = Number(pr?.unit_price ?? 0);
  const customPrice = pp?.unit_price != null ? Number(pp.unit_price) : null;
  if (customPrice != null) {
    if (basePrice > 0) {
      const raw = ((basePrice - customPrice) / basePrice) * 100;
      const clamped = Math.min(100, Math.max(0, raw));
      const rounded = Math.round(clamped * 100) / 100;
      return { unit_price: basePrice, discount_percent: rounded };
    }
    return { unit_price: customPrice, discount_percent: 0 };
  }

  return { unit_price: basePrice, discount_percent: partnerDisc };
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
      "order_number, received_at, patient_name, clinic_name, status, notes, patient_year_of_birth, patient_gender, order_category, due_completion_at, due_delivery_at, clinical_indication, margin_above_gingiva, margin_at_gingiva, margin_subgingival, margin_shoulder, notes_accounting, notes_coordination, accessories, partners!lab_orders_partner_id_fkey(code,name,address,phone,tax_id)",
    )
    .eq("id", orderId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy đơn.");

  const rec = row as Record<string, unknown>;
  const partners = rec["partners"] as {
    code?: string;
    name?: string;
    address?: string | null;
    phone?: string | null;
    tax_id?: string | null;
  } | null;

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
    partner_address: partners?.address ?? null,
    partner_phone: partners?.phone ?? null,
    partner_tax_id: partners?.tax_id ?? null,
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

export async function getDailyDeliveryNotePayload(
  partnerId: string,
  deliveryDate: string,
): Promise<DeliveryNotePayload> {
  const supabase = createSupabaseAdmin();
  const date = deliveryDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ngày giao không hợp lệ.");
  const fromIso = `${date}T00:00:00+07:00`;
  const toDay = new Date(`${date}T00:00:00+07:00`);
  toDay.setDate(toDay.getDate() + 1);
  const toIso = toDay.toISOString();

  const { data: partner, error: pErr } = await supabase
    .from("partners")
    .select("code,name,address,phone,tax_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!partner) throw new Error("Không tìm thấy khách hàng.");

  const { data: orders, error: oErr } = await supabase
    .from("lab_orders")
    .select("id,order_number,patient_name,clinic_name,notes,status,due_delivery_at")
    .eq("partner_id", partnerId)
    .gte("due_delivery_at", fromIso)
    .lt("due_delivery_at", toIso)
    .neq("status", "cancelled")
    .order("due_delivery_at", { ascending: true })
    .order("order_number", { ascending: true })
    .limit(500);
  if (oErr) throw new Error(oErr.message);
  const orderIds = (orders ?? []).map((o) => o.id as string);
  let lines: Record<string, unknown>[] = [];
  if (orderIds.length > 0) {
    const { data: lineData, error: lErr } = await supabase
      .from("lab_order_lines")
      .select("order_id,tooth_positions,quantity,shade,products:product_id(code,name)")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (lErr) throw new Error(lErr.message);
    lines = (lineData ?? []) as Record<string, unknown>[];
  }
  const linesByOrder = new Map<string, { product_code: string; product_name: string; tooth_positions: string; quantity: number; shade: string | null }[]>();
  for (const row of lines) {
    const oid = row["order_id"] as string;
    const pr = row["products"] as { code?: string; name?: string } | null;
    const arr = linesByOrder.get(oid) ?? [];
    arr.push({
      product_code: pr?.code ?? "",
      product_name: pr?.name ?? "",
      tooth_positions: (row["tooth_positions"] as string) ?? "",
      quantity: Number(row["quantity"] ?? 0),
      shade: (row["shade"] as string | null) ?? null,
    });
    linesByOrder.set(oid, arr);
  }

  return {
    partner_code: (partner["code"] as string | null) ?? null,
    partner_name: (partner["name"] as string | null) ?? null,
    partner_address: (partner["address"] as string | null) ?? null,
    partner_phone: (partner["phone"] as string | null) ?? null,
    partner_tax_id: (partner["tax_id"] as string | null) ?? null,
    delivery_date: date,
    generated_at: new Date().toLocaleString("vi-VN"),
    orders: (orders ?? []).map((o) => ({
      order_number: o["order_number"] as string,
      patient_name: o["patient_name"] as string,
      clinic_name: (o["clinic_name"] as string | null) ?? null,
      notes: (o["notes"] as string | null) ?? null,
      lines: linesByOrder.get(o["id"] as string) ?? [],
    })),
  };
}

function roundMoney2(n: number) {
  return Math.round(n * 100) / 100;
}

function monthlyDeliveryDiscountLabel(
  parts: { pct: number; fixedAmt: number }[],
): string {
  const hasFixed = parts.some((p) => p.fixedAmt > 0);
  const activePcts = parts.filter((p) => p.pct > 0).map((p) => p.pct);
  if (!hasFixed && activePcts.length > 0 && activePcts.every((x) => x === activePcts[0])) {
    return `CHIẾT KHẤU GIẢM ${activePcts[0]}%`;
  }
  return "CHIẾT KHẤU GIẢM";
}

/** Phiếu giao gộp cả tháng theo một lab (ngày nhận trong khoảng tháng). */
export async function getMonthlyDeliveryNotePayload(
  partnerId: string,
  year: number,
  month: number,
): Promise<DeliveryNotePayload> {
  const supabase = createSupabaseAdmin();
  if (month < 1 || month > 12) throw new Error("Tháng không hợp lệ.");
  if (year < 2000 || year > 2100) throw new Error("Năm không hợp lệ.");

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: partner, error: pErr } = await supabase
    .from("partners")
    .select("code,name,address,phone,tax_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!partner) throw new Error("Không tìm thấy khách hàng.");

  const { data: orders, error: oErr } = await supabase
    .from("lab_orders")
    .select(
      "id,order_number,patient_name,clinic_name,notes,status,received_at,billing_order_discount_percent,billing_order_discount_amount,billing_other_fees",
    )
    .eq("partner_id", partnerId)
    .gte("received_at", from)
    .lte("received_at", to)
    .neq("status", "cancelled")
    .order("received_at", { ascending: true })
    .order("order_number", { ascending: true })
    .limit(500);
  if (oErr) throw new Error(oErr.message);
  const orderIds = (orders ?? []).map((o) => o.id as string);
  let lines: Record<string, unknown>[] = [];
  if (orderIds.length > 0) {
    const { data: lineData, error: lErr } = await supabase
      .from("lab_order_lines")
      .select(
        "order_id,tooth_positions,quantity,shade,unit_price,line_amount,notes,products:product_id(code,name)",
      )
      .in("order_id", orderIds)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (lErr) throw new Error(lErr.message);
    lines = (lineData ?? []) as Record<string, unknown>[];
  }
  const linesByOrder = new Map<
    string,
    {
      product_code: string;
      product_name: string;
      tooth_positions: string;
      quantity: number;
      shade: string | null;
      unit_price: number;
      line_amount: number;
      notes: string | null;
    }[]
  >();
  for (const row of lines) {
    const oid = row["order_id"] as string;
    const pr = row["products"] as { code?: string; name?: string } | null;
    const arr = linesByOrder.get(oid) ?? [];
    arr.push({
      product_code: pr?.code ?? "",
      product_name: pr?.name ?? "",
      tooth_positions: (row["tooth_positions"] as string) ?? "",
      quantity: Number(row["quantity"] ?? 0),
      shade: (row["shade"] as string | null) ?? null,
      unit_price: Number(row["unit_price"] ?? 0),
      line_amount: Number(row["line_amount"] ?? 0),
      notes: (row["notes"] as string | null) ?? null,
    });
    linesByOrder.set(oid, arr);
  }

  const periodHeading = `THÁNG ${String(month).padStart(2, "0")} ${year}`;

  const discountParts: { pct: number; fixedAmt: number }[] = [];
  let subtotalGoods = 0;
  let discountAmount = 0;
  let otherFeesSum = 0;
  for (const o of orders ?? []) {
    const oid = o["id"] as string;
    const lines = linesByOrder.get(oid) ?? [];
    const lineSum = roundMoney2(lines.reduce((s, l) => s + l.line_amount, 0));
    const pct = Number(o["billing_order_discount_percent"] ?? 0);
    const fixedAmt = Number(o["billing_order_discount_amount"] ?? 0);
    const fees = Number(o["billing_other_fees"] ?? 0);
    subtotalGoods += lineSum;
    discountAmount += lineSum * (pct / 100) + fixedAmt;
    otherFeesSum += fees;
    discountParts.push({ pct, fixedAmt });
  }
  subtotalGoods = roundMoney2(subtotalGoods);
  discountAmount = roundMoney2(discountAmount);
  otherFeesSum = roundMoney2(otherFeesSum);

  const { opening, receipts_month } = await getPartnerMonthOpeningAndReceipts(partnerId, year, month);
  const closingDebt = roundMoney2(
    opening + subtotalGoods - discountAmount + otherFeesSum - receipts_month,
  );

  return {
    partner_code: (partner["code"] as string | null) ?? null,
    partner_name: (partner["name"] as string | null) ?? null,
    partner_address: (partner["address"] as string | null) ?? null,
    partner_phone: (partner["phone"] as string | null) ?? null,
    partner_tax_id: (partner["tax_id"] as string | null) ?? null,
    delivery_date: from,
    period_heading: periodHeading,
    period_subtitle: `Ngày nhận ${from} → ${to}`,
    layout: "monthly_flat",
    generated_at: new Date().toLocaleString("vi-VN"),
    monthly_footer: {
      subtotal_goods: subtotalGoods,
      discount_label: monthlyDeliveryDiscountLabel(discountParts),
      discount_amount: discountAmount,
      other_fees: otherFeesSum,
      opening_debt: opening,
      payments_in_period: receipts_month,
      closing_debt: closingDebt,
    },
    orders: (orders ?? []).map((o) => {
      const rawRec = o["received_at"] as string | null | undefined;
      const received_date =
        rawRec && rawRec.length >= 10 ? rawRec.slice(0, 10) : from;
      return {
        order_number: o["order_number"] as string,
        patient_name: o["patient_name"] as string,
        clinic_name: (o["clinic_name"] as string | null) ?? null,
        notes: (o["notes"] as string | null) ?? null,
        received_date,
        lines: linesByOrder.get(o["id"] as string) ?? [],
      };
    }),
  };
}

/** Phiếu giao cho một đơn (theo id đơn). */
export async function getSingleOrderDeliveryNotePayload(orderId: string): Promise<DeliveryNotePayload> {
  const supabase = createSupabaseAdmin();
  const { data: order, error: oErr } = await supabase
    .from("lab_orders")
    .select(
      "id,order_number,patient_name,clinic_name,notes,status,received_at, partners!lab_orders_partner_id_fkey(code,name,address,phone,tax_id)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);
  if (!order) throw new Error("Không tìm thấy đơn.");
  if ((order["status"] as string) === "cancelled") throw new Error("Đơn đã hủy.");

  const oid = order["id"] as string;
  const { data: lineData, error: lErr } = await supabase
    .from("lab_order_lines")
    .select("order_id,tooth_positions,quantity,shade,products:product_id(code,name)")
    .eq("order_id", oid)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (lErr) throw new Error(lErr.message);
  const lineRows = (lineData ?? []) as Record<string, unknown>[];
  const lines: DeliveryNoteLine[] = [];
  for (const row of lineRows) {
    const pr = row["products"] as { code?: string; name?: string } | null;
    lines.push({
      product_code: pr?.code ?? "",
      product_name: pr?.name ?? "",
      tooth_positions: (row["tooth_positions"] as string) ?? "",
      quantity: Number(row["quantity"] ?? 0),
      shade: (row["shade"] as string | null) ?? null,
    });
  }

  const partners = order["partners"] as {
    code?: string;
    name?: string;
    address?: string | null;
    phone?: string | null;
    tax_id?: string | null;
  } | null;
  const receivedRaw = order["received_at"] as string;
  const received = receivedRaw.length >= 10 ? receivedRaw.slice(0, 10) : receivedRaw;
  const orderNumber = order["order_number"] as string;

  return {
    partner_code: partners?.code ?? null,
    partner_name: partners?.name ?? null,
    partner_address: partners?.address ?? null,
    partner_phone: partners?.phone ?? null,
    partner_tax_id: partners?.tax_id ?? null,
    delivery_date: received,
    period_subtitle: `Đơn ${orderNumber} · Ngày nhận ${received}`,
    generated_at: new Date().toLocaleString("vi-VN"),
    orders: [
      {
        order_number: orderNumber,
        patient_name: order["patient_name"] as string,
        clinic_name: (order["clinic_name"] as string | null) ?? null,
        notes: (order["notes"] as string | null) ?? null,
        lines,
      },
    ],
  };
}

export async function findLabOrderIdByOrderNumber(orderNumber: string): Promise<string | null> {
  const t = orderNumber.trim();
  if (!t) return null;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("lab_orders").select("id").eq("order_number", t).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.["id"] as string | undefined) ?? null;
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

export type LabOrderLineExportFlat = {
  tooth_positions: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  line_amount: number;
  product_code: string | null;
  product_name: string | null;
};

const LAB_ORDER_LINE_EXPORT_CHUNK = 400;

/** Dòng chi tiết theo từng đơn (đã sắp theo created_at) — dùng xuất Excel. */
export async function fetchLabOrderLinesForExport(
  orderIds: string[],
): Promise<Record<string, LabOrderLineExportFlat[]>> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return {};
  const supabase = createSupabaseAdmin();
  type RowAcc = LabOrderLineExportFlat & { _id: string; _created: string; _oid: string };
  const acc: RowAcc[] = [];
  for (let i = 0; i < ids.length; i += LAB_ORDER_LINE_EXPORT_CHUNK) {
    const chunk = ids.slice(i, i + LAB_ORDER_LINE_EXPORT_CHUNK);
    const { data, error } = await supabase
      .from("lab_order_lines")
      .select(
        "id, order_id, created_at, tooth_positions, quantity, unit_price, discount_percent, discount_amount, line_amount, products!lab_order_lines_product_id_fkey(code,name)",
      )
      .in("order_id", chunk);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const rec = r as Record<string, unknown>;
      const pr = rec["products"] as { code?: string; name?: string } | null;
      acc.push({
        _id: rec["id"] as string,
        _oid: rec["order_id"] as string,
        _created: (rec["created_at"] as string) ?? "",
        tooth_positions: (rec["tooth_positions"] as string) ?? "",
        quantity: finiteNumber(rec["quantity"], 0),
        unit_price: finiteNumber(rec["unit_price"]),
        discount_percent: finiteNumber(rec["discount_percent"], 0),
        discount_amount: finiteNumber(rec["discount_amount"], 0),
        line_amount: finiteNumber(rec["line_amount"]),
        product_code: pr?.code ?? null,
        product_name: pr?.name ?? null,
      });
    }
  }
  const byOrder = new Map<string, RowAcc[]>();
  for (const ln of acc) {
    const arr = byOrder.get(ln._oid);
    if (arr) arr.push(ln);
    else byOrder.set(ln._oid, [ln]);
  }
  const out: Record<string, LabOrderLineExportFlat[]> = {};
  for (const [oid, rows] of byOrder) {
    rows.sort((a, b) => a._created.localeCompare(b._created) || a._id.localeCompare(b._id));
    out[oid] = rows.map(({ _id: _i, _created: _c, _oid: _o, ...rest }) => rest);
  }
  return out;
}

