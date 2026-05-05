"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type {
  PaymentNoticeLine,
  PaymentNoticePrintPayload,
} from "@/lib/reports/payment-notice-html";
import { buildPaymentNoticeBodyHtml } from "@/lib/reports/payment-notice-html";
import { computeOrderGrandTotal, finiteNumber } from "@/lib/billing/order-grand-total";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type LabOrderBillingTotals = {
  subtotal_lines: number;
  billing_order_discount_percent: number;
  billing_order_discount_amount: number;
  billing_other_fees: number;
  grand_total: number;
};

const billingUpdateSchema = z.object({
  billing_order_discount_percent: z.coerce.number().min(0).max(100),
  billing_order_discount_amount: z.coerce.number().min(0),
  billing_other_fees: z.coerce.number(),
});

export async function getLabOrderBillingTotals(orderId: string): Promise<LabOrderBillingTotals | null> {
  const supabase = createSupabaseAdmin();
  const { data: ord, error: oe } = await supabase
    .from("lab_orders")
    .select(
      "billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, lab_order_lines!lab_order_lines_order_id_fkey(line_amount)",
    )
    .eq("id", orderId)
    .single();
  if (oe || !ord) return null;
  const lines = ord["lab_order_lines"] as { line_amount?: string | number }[] | null;
  let subtotal = 0;
  for (const ln of lines ?? []) subtotal += finiteNumber(ln.line_amount);
  const billing_order_discount_percent = Number(ord.billing_order_discount_percent ?? 0);
  const billing_order_discount_amount = Number(ord.billing_order_discount_amount ?? 0);
  const billing_other_fees = Number(ord.billing_other_fees ?? 0);
  const subtotal_lines = round2(subtotal);
  return {
    subtotal_lines,
    billing_order_discount_percent,
    billing_order_discount_amount,
    billing_other_fees,
    grand_total: computeOrderGrandTotal({
      subtotal_lines,
      billing_order_discount_percent,
      billing_order_discount_amount,
      billing_other_fees,
    }),
  };
}

export async function updateLabOrderBilling(orderId: string, input: z.infer<typeof billingUpdateSchema>) {
  const row = billingUpdateSchema.parse(input);
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("lab_orders")
    .update({
      billing_order_discount_percent: row.billing_order_discount_percent,
      billing_order_discount_amount: row.billing_order_discount_amount,
      billing_other_fees: row.billing_other_fees,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/orders/" + orderId);
  revalidatePath("/accounting/sales");
}

function isUniqueViolation(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "23505") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("duplicate") || m.includes("unique");
}

export async function suggestPaymentNoticeDocNumber(issueDate: string): Promise<string> {
  const supabase = createSupabaseAdmin();
  const day = issueDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Ngày không hợp lệ.");
  const prefix = "GBTT-" + day.replace(/-/g, "") + "-";
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffixRe = new RegExp("^" + esc + "(\\d+)$");
  const { data, error } = await supabase
    .from("lab_orders")
    .select("payment_notice_doc_number")
    .ilike("payment_notice_doc_number", prefix + "%");
  if (error) throw new Error(error.message);
  let maxSeq = 0;
  for (const r of data ?? []) {
    const num = r.payment_notice_doc_number as string;
    const m = suffixRe.exec(num);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1]!, 10));
  }
  return prefix + String(maxSeq + 1).padStart(3, "0");
}

/** Cấp số GBTT + ghi nhận thời điểm xuất (có thể gọi lại nếu đã có số — chỉ cập nhật ngày). */
export async function issuePaymentNoticeForLabOrder(orderId: string, issueDate?: string) {
  const supabase = createSupabaseAdmin();
  const dateStr = (issueDate?.trim() || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error("Ngày xuất không hợp lệ.");

  const { data: cur, error: ce } = await supabase
    .from("lab_orders")
    .select("payment_notice_doc_number, payment_notice_issued_at")
    .eq("id", orderId)
    .single();
  if (ce || !cur) throw new Error(ce?.message ?? "Không tìm thấy đơn.");

  const doc = cur.payment_notice_doc_number as string | null;
  if (!doc) {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 15; attempt++) {
      const candidate = await suggestPaymentNoticeDocNumber(dateStr);
      const { data: updated, error: up } = await supabase
        .from("lab_orders")
        .update({
          payment_notice_doc_number: candidate,
          payment_notice_issued_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .is("payment_notice_doc_number", null)
        .select("id")
        .maybeSingle();
      if (!up && updated?.id) {
        revalidatePath("/orders/" + orderId);
        revalidatePath("/accounting/sales");
        return { payment_notice_doc_number: candidate };
      }
      if (up) {
        if (isUniqueViolation(up)) {
          lastErr = new Error(up.message);
          continue;
        }
        throw new Error(up.message);
      }
      const { data: again } = await supabase
        .from("lab_orders")
        .select("payment_notice_doc_number")
        .eq("id", orderId)
        .maybeSingle();
      const got = again?.payment_notice_doc_number as string | null;
      if (got) {
        revalidatePath("/orders/" + orderId);
        revalidatePath("/accounting/sales");
        return { payment_notice_doc_number: got };
      }
    }
    throw lastErr ?? new Error("Không cấp được số GBTT.");
  }

  const { error: up2 } = await supabase
    .from("lab_orders")
    .update({ payment_notice_issued_at: new Date().toISOString() })
    .eq("id", orderId);
  if (up2) throw new Error(up2.message);
  revalidatePath("/orders/" + orderId);
  revalidatePath("/accounting/sales");
  return { payment_notice_doc_number: doc };
}

export async function getPaymentNoticePrintPayload(orderId: string): Promise<PaymentNoticePrintPayload> {
  const totals = await getLabOrderBillingTotals(orderId);
  if (!totals) throw new Error("Không tìm thấy đơn.");
  const supabase = createSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("lab_orders")
    .select(
      "order_number, received_at, patient_name, clinic_name, notes, payment_notice_doc_number, payment_notice_issued_at, billing_order_discount_percent, billing_order_discount_amount, billing_other_fees, partners!lab_orders_partner_id_fkey(code,name,address,phone,tax_id)",
    )
    .eq("id", orderId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy đơn.");

  const { data: lineRows, error: le } = await supabase
    .from("lab_order_lines")
    .select(
      "tooth_positions, shade, tooth_count, work_type, quantity, unit_price, discount_percent, discount_amount, line_amount, notes, products!lab_order_lines_product_id_fkey(code,name,unit,unit_price)",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (le) throw new Error(le.message);

  const lines: PaymentNoticeLine[] = (lineRows ?? []).map((r: Record<string, unknown>) => {
    const pr = r["products"] as { code?: string; name?: string; unit?: string; unit_price?: number | string } | null;
    const catalog = pr?.unit_price != null ? Number(pr.unit_price) : 0;
    const unitPrice = Number(r["unit_price"]);
    const listUnit = catalog > 0 ? catalog : unitPrice;
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
      work_type: (r["work_type"] as string) ?? "new_work",
      quantity: Number(r["quantity"]),
      list_unit_price: listUnit,
      unit_price: unitPrice,
      discount_percent: Number(r["discount_percent"]),
      discount_amount: Number(r["discount_amount"] ?? 0),
      line_amount: Number(r["line_amount"]),
      notes: (r["notes"] as string | null) ?? null,
    };
  });

  const partners = row["partners"] as {
    code?: string;
    name?: string;
    address?: string | null;
    phone?: string | null;
    tax_id?: string | null;
  } | null;
  return {
    payment_notice_doc_number: (row["payment_notice_doc_number"] as string | null) ?? null,
    payment_notice_issued_at: (row["payment_notice_issued_at"] as string | null) ?? null,
    order_number: row["order_number"] as string,
    received_at: row["received_at"] as string,
    patient_name: row["patient_name"] as string,
    clinic_name: (row["clinic_name"] as string | null) ?? null,
    partner_code: partners?.code ?? null,
    partner_name: partners?.name ?? null,
    partner_address: partners?.address ?? null,
    partner_phone: partners?.phone ?? null,
    partner_tax_id: partners?.tax_id ?? null,
    notes: (row["notes"] as string | null) ?? null,
    lines,
    subtotal_lines: totals.subtotal_lines,
    billing_order_discount_percent: totals.billing_order_discount_percent,
    billing_order_discount_amount: totals.billing_order_discount_amount,
    billing_other_fees: totals.billing_other_fees,
    grand_total: totals.grand_total,
  };
}

async function listLabOrderIdsReceivedInMonth(
  year: number,
  month: number,
  partnerId: string | null,
): Promise<string[]> {
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    throw new Error("Tháng/năm không hợp lệ.");
  }
  const supabase = createSupabaseAdmin();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  let q = supabase
    .from("lab_orders")
    .select("id, payment_notice_doc_number, order_number")
    .gte("received_at", from)
    .lte("received_at", to)
    .neq("status", "cancelled")
    .limit(2000);
  if (partnerId?.trim()) {
    q = q.eq("partner_id", partnerId.trim());
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  type Row = { id: string; payment_notice_doc_number: string | null; order_number: string };
  const rows = (data ?? []) as Row[];
  rows.sort((a, b) => {
    const an = (a.payment_notice_doc_number ?? "").trim();
    const bn = (b.payment_notice_doc_number ?? "").trim();
    if (an && bn) return an.localeCompare(bn, "vi", { numeric: true });
    if (an && !bn) return -1;
    if (!an && bn) return 1;
    return String(a.order_number).localeCompare(String(b.order_number), "vi", { numeric: true });
  });
  return rows.map((r) => r.id);
}

function buildMonthlyGbttExcelAoaFromPayloads(
  payloads: Awaited<ReturnType<typeof getPaymentNoticePrintPayload>>[],
): (string | number | null)[][] {
  const header: (string | number | null)[] = [
    "Số GBTT",
    "Ngày GBTT",
    "Số đơn",
    "Ngày nhận",
    "Mã KH",
    "Tên KH",
    "Nha khoa",
    "Bệnh nhân",
    "Ghi chú đơn",
    "STT dòng",
    "Mã SP",
    "Tên SP",
    "Răng",
    "Màu",
    "SL",
    "Giá niêm yết",
    "Đơn giá",
    "%CK dòng",
    "CK VNĐ dòng",
    "Thành tiền dòng",
    "Ghi chú dòng",
    "Cộng chi tiết",
    "CK tổng %",
    "CK tổng VNĐ",
    "Phí khác",
    "Tổng phải thu",
  ];
  const aoa: (string | number | null)[][] = [header];

  for (const p of payloads) {
    const gbttAt = p.payment_notice_issued_at
      ? new Date(p.payment_notice_issued_at).toLocaleString("vi-VN")
      : "";

    if (!p.lines.length) {
      aoa.push([
        p.payment_notice_doc_number,
        gbttAt,
        p.order_number,
        p.received_at,
        p.partner_code ?? "",
        p.partner_name ?? "",
        p.clinic_name ?? "",
        p.patient_name,
        p.notes ?? "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        p.subtotal_lines,
        p.billing_order_discount_percent,
        p.billing_order_discount_amount,
        p.billing_other_fees,
        p.grand_total,
      ]);
      continue;
    }

    for (let i = 0; i < p.lines.length; i++) {
      const l = p.lines[i]!;
      const isLast = i === p.lines.length - 1;
      aoa.push([
        p.payment_notice_doc_number,
        gbttAt,
        p.order_number,
        p.received_at,
        p.partner_code ?? "",
        p.partner_name ?? "",
        p.clinic_name ?? "",
        p.patient_name,
        p.notes ?? "",
        i + 1,
        l.product_code,
        l.product_name,
        l.tooth_positions,
        l.shade ?? "",
        l.quantity,
        l.list_unit_price,
        l.unit_price,
        l.discount_percent,
        l.discount_amount,
        l.line_amount,
        l.notes ?? "",
        isLast ? p.subtotal_lines : "",
        isLast ? p.billing_order_discount_percent : "",
        isLast ? p.billing_order_discount_amount : "",
        isLast ? p.billing_other_fees : "",
        isLast ? p.grand_total : "",
      ]);
    }
  }

  return aoa;
}

/** Xuất Excel: một dòng cho mỗi dòng sản phẩm, cột tổng đơn ở dòng cuối của đơn. */
export async function buildMonthlyGbttExcelAoa(
  year: number,
  month: number,
  partnerId: string | null,
): Promise<(string | number | null)[][]> {
  const ids = await listLabOrderIdsReceivedInMonth(year, month, partnerId);
  if (!ids.length) {
    throw new Error("Không có đơn nào trong tháng đã chọn (lọc theo ngày nhận đơn).");
  }
  const payloads: Awaited<ReturnType<typeof getPaymentNoticePrintPayload>>[] = [];
  for (const id of ids) {
    payloads.push(await getPaymentNoticePrintPayload(id));
  }
  return buildMonthlyGbttExcelAoaFromPayloads(payloads);
}

/** Nối nhiều GBTT (theo ngày nhận trong tháng) để in một lần. `partnerId` rỗng = tất cả lab. */
export async function buildBatchPaymentNoticePrintDocument(
  year: number,
  month: number,
  partnerId: string | null,
): Promise<{ title: string; innerHtml: string; count: number }> {
  const ids = await listLabOrderIdsReceivedInMonth(year, month, partnerId);
  if (!ids.length) {
    throw new Error("Không có đơn nào trong tháng đã chọn (lọc theo ngày nhận đơn).");
  }

  const parts: string[] = [];
  for (const id of ids) {
    const payload = await getPaymentNoticePrintPayload(id);
    parts.push(`<article class="gbtt-batch-page">${buildPaymentNoticeBodyHtml(payload)}</article>`);
  }
  return {
    title: `Giấy báo thanh toán — Tháng ${month}/${year}`,
    innerHtml: `<div class="gbtt-batch-print">${parts.join("")}</div>`,
    count: ids.length,
  };
}

/** Một đơn → ma trận Excel GBTT (tiêu đề + dòng chi tiết + dòng tổng nếu cần). */
export async function buildSingleGbttExcelAoa(orderId: string): Promise<(string | number | null)[][]> {
  const p = await getPaymentNoticePrintPayload(orderId);
  return buildMonthlyGbttExcelAoaFromPayloads([p]);
}
