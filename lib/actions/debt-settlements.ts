"use server";

import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createCashTransaction, getCashReceiptPrintPayload } from "@/lib/actions/cash";

export type DebtSettlementLine = {
  id: string;
  transaction_date: string;
  doc_number: string;
  payment_channel: string;
  amount: number;
  payer_name: string | null;
  description: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Biên ngày theo lịch (local) cho tháng báo cáo — khớp cách lọc tháng trên UI công nợ. */
function calendarMonthBounds(year: number, month: number): { start: string; end: string } {
  const y = Math.floor(year);
  const m = Math.floor(month);
  const last = new Date(y, m, 0).getDate();
  return {
    start: `${y}-${pad2(m)}-01`,
    end: `${y}-${pad2(m)}-${pad2(last)}`,
  };
}

export async function listPartnerReceiptsInMonth(
  partnerId: string,
  year: number,
  month: number,
): Promise<DebtSettlementLine[]> {
  const supabase = createSupabaseAdmin();
  const { start, end } = calendarMonthBounds(year, month);
  const { data, error } = await supabase
    .from("cash_transactions")
    .select("id, transaction_date, doc_number, payment_channel, amount, payer_name, description")
    .eq("partner_id", partnerId)
    .eq("direction", "receipt")
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r["id"] as string,
    transaction_date: r["transaction_date"] as string,
    doc_number: r["doc_number"] as string,
    payment_channel: r["payment_channel"] as string,
    amount: Number(r["amount"] ?? 0),
    payer_name: (r["payer_name"] as string | null) ?? null,
    description: (r["description"] as string | null) ?? null,
  }));
}

export async function listSupplierPaymentsInMonth(
  supplierId: string,
  year: number,
  month: number,
): Promise<DebtSettlementLine[]> {
  const supabase = createSupabaseAdmin();
  const { start, end } = calendarMonthBounds(year, month);
  const { data, error } = await supabase
    .from("cash_transactions")
    .select("id, transaction_date, doc_number, payment_channel, amount, payer_name, description")
    .eq("supplier_id", supplierId)
    .eq("direction", "payment")
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r["id"] as string,
    transaction_date: r["transaction_date"] as string,
    doc_number: r["doc_number"] as string,
    payment_channel: r["payment_channel"] as string,
    amount: Number(r["amount"] ?? 0),
    payer_name: (r["payer_name"] as string | null) ?? null,
    description: (r["description"] as string | null) ?? null,
  }));
}

const receivableReceiptSchema = z.object({
  partner_id: z.string().uuid(),
  transaction_date: z.string().min(1),
  amount: z.coerce.number().positive(),
  payment_channel: z.string().min(1).max(100),
  payer_name: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

/** Ghi thu từ khách — bản ghi sổ quỹ (receipt); báo cáo công nợ tháng cập nhật theo `transaction_date`. */
export async function recordReceivableReceiptFromDebtPage(
  input: z.infer<typeof receivableReceiptSchema>,
): Promise<{ id: string; doc_number: string }> {
  const row = receivableReceiptSchema.parse(input);
  const { id } = await createCashTransaction({
    transaction_date: row.transaction_date,
    doc_number: "",
    payment_channel: row.payment_channel,
    direction: "receipt",
    business_category: "Thu công nợ KH",
    amount: row.amount,
    partner_id: row.partner_id,
    supplier_id: null,
    payer_name: row.payer_name?.trim() || null,
    description: row.description?.trim() || null,
    reference_type: "debt_page",
    reference_id: "",
  });
  const payload = await getCashReceiptPrintPayload(id);
  const doc_number = payload.doc_number;
  return { id, doc_number };
}

const payablePaymentSchema = z.object({
  supplier_id: z.string().uuid(),
  transaction_date: z.string().min(1),
  amount: z.coerce.number().positive(),
  payment_channel: z.string().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
});

/** Ghi chi trả NCC — bản ghi sổ quỹ (payment); báo cáo phải trả tháng cập nhật theo `transaction_date`. */
export async function recordPayablePaymentFromDebtPage(
  input: z.infer<typeof payablePaymentSchema>,
): Promise<{ id: string; doc_number: string }> {
  const row = payablePaymentSchema.parse(input);
  const { id } = await createCashTransaction({
    transaction_date: row.transaction_date,
    doc_number: "",
    payment_channel: row.payment_channel,
    direction: "payment",
    business_category: "Chi trả công nợ NCC",
    amount: row.amount,
    partner_id: null,
    supplier_id: row.supplier_id,
    payer_name: null,
    description: row.description?.trim() || null,
    reference_type: "debt_page",
    reference_id: "",
  });
  const payload = await getCashReceiptPrintPayload(id);
  const doc_number = payload.doc_number;
  return { id, doc_number };
}
