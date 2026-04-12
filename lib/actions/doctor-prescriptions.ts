"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { comparePrescriptionToOrderMaps, type QtyLine } from "@/lib/order/prescription-compare";

export type DoctorPrescriptionPicker = {
  id: string;
  slip_code: string | null;
  slip_date: string;
  patient_name: string;
};

export async function listDoctorPrescriptionsByPartner(
  partnerId: string,
): Promise<DoctorPrescriptionPicker[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_prescriptions")
    .select("id, slip_code, slip_date, patient_name")
    .eq("partner_id", partnerId)
    .order("slip_date", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r["id"] as string,
    slip_code: (r["slip_code"] as string | null) ?? null,
    slip_date: r["slip_date"] as string,
    patient_name: r["patient_name"] as string,
  }));
}

/** Tạo phiếu BS bằng cách sao chép dòng từ đơn (làm mốc đối chiếu khi giấy tương ứng). */
export async function createDoctorPrescriptionFromLabOrder(
  orderId: string,
  slipCode: string | null,
): Promise<{ id: string }> {
  const supabase = createSupabaseAdmin();
  const { data: ord, error: oe } = await supabase
    .from("lab_orders")
    .select("id, partner_id, patient_name, clinic_name")
    .eq("id", orderId)
    .single();
  if (oe || !ord) throw new Error(oe?.message ?? "Không tìm thấy đơn.");

  const { data: lines, error: le } = await supabase
    .from("lab_order_lines")
    .select("product_id, tooth_positions, shade, tooth_count, quantity, work_type, notes")
    .eq("order_id", orderId);
  if (le) throw new Error(le.message);
  if (!lines?.length) throw new Error("Đơn chưa có dòng hàng để sao chép.");

  const code = slipCode?.trim() ? slipCode.trim() : null;
  const { data: rx, error: re } = await supabase
    .from("doctor_prescriptions")
    .insert({
      partner_id: ord.partner_id as string,
      slip_date: new Date().toISOString().slice(0, 10),
      slip_code: code,
      patient_name: ord.patient_name as string,
      clinic_name: (ord.clinic_name as string | null) ?? null,
      notes: "Tạo từ đơn để đối chiếu",
    })
    .select("id")
    .single();
  if (re || !rx) throw new Error(re?.message ?? "Không tạo được phiếu BS.");

  const rxId = rx.id as string;
  const inserts = lines.map((ln: Record<string, unknown>) => ({
    prescription_id: rxId,
    product_id: ln["product_id"] as string,
    tooth_positions: ln["tooth_positions"] as string,
    shade: (ln["shade"] as string | null) ?? null,
    tooth_count:
      ln["tooth_count"] === null || ln["tooth_count"] === undefined
        ? null
        : Number(ln["tooth_count"]),
    quantity: Number(ln["quantity"]),
    work_type: (ln["work_type"] as string) ?? "new_work",
    notes: (ln["notes"] as string | null) ?? null,
  }));
  const { error: ie } = await supabase.from("doctor_prescription_lines").insert(inserts);
  if (ie) {
    await supabase.from("doctor_prescriptions").delete().eq("id", rxId);
    throw new Error(ie.message);
  }

  const { error: ue } = await supabase
    .from("lab_orders")
    .update({ doctor_prescription_id: rxId })
    .eq("id", orderId);
  if (ue) throw new Error(ue.message);

  revalidatePath("/orders");
  revalidatePath("/orders/" + orderId);
  revalidatePath("/orders/review");
  return { id: rxId };
}

const linkSchema = z.object({
  order_id: z.string().uuid(),
  prescription_id: z.union([z.string().uuid(), z.literal("")]).transform((v) => (v ? v : null)),
});

export async function linkLabOrderToDoctorPrescription(input: z.infer<typeof linkSchema>) {
  const { order_id, prescription_id } = linkSchema.parse(input);
  const supabase = createSupabaseAdmin();
  if (prescription_id) {
    const { data: ord, error: e0 } = await supabase
      .from("lab_orders")
      .select("partner_id")
      .eq("id", order_id)
      .single();
    if (e0 || !ord) throw new Error(e0?.message ?? "Không tìm thấy đơn.");
    const { data: rx, error: e1 } = await supabase
      .from("doctor_prescriptions")
      .select("partner_id")
      .eq("id", prescription_id)
      .single();
    if (e1 || !rx) throw new Error(e1?.message ?? "Không tìm thấy phiếu BS.");
    if (rx.partner_id !== ord.partner_id) {
      throw new Error("Phiếu BS và đơn phải cùng khách hàng.");
    }
  }
  const { error } = await supabase
    .from("lab_orders")
    .update({ doctor_prescription_id: prescription_id })
    .eq("id", order_id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/orders/" + order_id);
  revalidatePath("/orders/review");
}

export async function compareDoctorPrescriptionToLabOrder(orderId: string): Promise<{
  hasPrescription: boolean;
  result: { ok: boolean; messages: string[] };
}> {
  const supabase = createSupabaseAdmin();
  const { data: ord, error: oe } = await supabase
    .from("lab_orders")
    .select("doctor_prescription_id")
    .eq("id", orderId)
    .single();
  if (oe || !ord) throw new Error(oe?.message ?? "Không tìm thấy đơn.");
  const rxId = ord.doctor_prescription_id as string | null;
  if (!rxId) return { hasPrescription: false, result: { ok: true, messages: [] } };

  const { data: rxLines, error: re } = await supabase
    .from("doctor_prescription_lines")
    .select("product_id, tooth_positions, work_type, quantity")
    .eq("prescription_id", rxId);
  if (re) throw new Error(re.message);

  const { data: loLines, error: le } = await supabase
    .from("lab_order_lines")
    .select("product_id, tooth_positions, work_type, quantity")
    .eq("order_id", orderId);
  if (le) throw new Error(le.message);

  const rx: QtyLine[] = (rxLines ?? []).map((r: Record<string, unknown>) => ({
    product_id: r["product_id"] as string,
    tooth_positions: r["tooth_positions"] as string,
    work_type: (r["work_type"] as string) ?? "new_work",
    quantity: Number(r["quantity"]),
  }));
  const lo: QtyLine[] = (loLines ?? []).map((r: Record<string, unknown>) => ({
    product_id: r["product_id"] as string,
    tooth_positions: r["tooth_positions"] as string,
    work_type: (r["work_type"] as string) ?? "new_work",
    quantity: Number(r["quantity"]),
  }));

  const result = comparePrescriptionToOrderMaps(rx, lo);
  return { hasPrescription: true, result };
}
