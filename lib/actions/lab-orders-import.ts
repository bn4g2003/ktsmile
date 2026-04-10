"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import {
  groupKey,
  parseLabOrderSheet,
  type ParsedLabOrderLine,
} from "@/lib/import/parse-lab-order-excel";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type ImportLabOrdersResult = {
  ok: boolean;
  ordersCreated: number;
  linesCreated: number;
  message?: string;
  errors?: string[];
};

function normKey(s: string): string {
  return s.trim().toUpperCase();
}

function stripPartnerPrefix(sku: string, partnerCode: string): string | null {
  const su = sku.trim().toUpperCase();
  const pu = partnerCode.trim().toUpperCase();
  if (!pu || !su.startsWith(pu)) return null;
  const rest = sku.trim().slice(pu.length);
  return rest || null;
}

/** Thứ tự ưu tiên mã SP để khớp bảng products.code */
function productCodeCandidates(line: ParsedLabOrderLine): string[] {
  const t = line.productTypeCode.trim();
  const sku = line.productSku.trim();
  const out: string[] = [];
  if (t) out.push(t);
  const stripped = stripPartnerPrefix(sku, line.partnerCode);
  if (stripped) out.push(stripped);
  if (sku) out.push(sku);
  return [...new Set(out)];
}

function orderNotesFromGroup(lines: ParsedLabOrderLine[]): string | null {
  const first = lines[0];
  if (!first) return null;
  const parts: string[] = [];
  if (first.labTruyXuat) parts.push("LAB truy xuất: " + first.labTruyXuat);
  if (first.labName) parts.push("Lab: " + first.labName);
  if (first.clinicName) parts.push("Nha khoa: " + first.clinicName);
  const s = parts.join(" · ").trim();
  return s ? s.slice(0, 2000) : null;
}

function lineNotes(line: ParsedLabOrderLine): string | null {
  const parts: string[] = [];
  if (line.productNameHint) parts.push(line.productNameHint);
  if (line.lineNote) parts.push(line.lineNote);
  const s = parts.join(" — ").trim();
  return s ? s.slice(0, 1000) : null;
}

function makeOrderNumber(receivedAtIso: string, partnerCode: string): string {
  const r = Math.random().toString(36).slice(2, 10);
  const base = "IMP-" + receivedAtIso.replace(/-/g, "") + "-" + partnerCode.trim() + "-" + r;
  return base.slice(0, 100);
}

export async function importLabOrdersFromExcel(formData: FormData): Promise<ImportLabOrdersResult> {
  const raw = formData.get("file");
  if (!raw || !(raw instanceof File)) {
    return { ok: false, ordersCreated: 0, linesCreated: 0, message: "Chưa chọn file." };
  }
  if (raw.size > 15 * 1024 * 1024) {
    return { ok: false, ordersCreated: 0, linesCreated: 0, message: "File quá lớn (tối đa 15MB)." };
  }

  let aoa: unknown[][];
  try {
    const ab = await raw.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array", cellDates: true });
    const name = wb.SheetNames[0];
    if (!name) throw new Error("File không có sheet.");
    const sheet = wb.Sheets[name];
    if (!sheet) throw new Error("Sheet trống.");
    aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  } catch (e) {
    return {
      ok: false,
      ordersCreated: 0,
      linesCreated: 0,
      message: e instanceof Error ? e.message : "Không đọc được file Excel.",
    };
  }

  let parsed: ParsedLabOrderLine[];
  try {
    parsed = parseLabOrderSheet(aoa);
  } catch (e) {
    return {
      ok: false,
      ordersCreated: 0,
      linesCreated: 0,
      message: e instanceof Error ? e.message : "Lỗi phân tích sheet.",
    };
  }

  const supabase = createSupabaseAdmin();
  const { data: partnerRows, error: pe } = await supabase.from("partners").select("id, code");
  if (pe) {
    return { ok: false, ordersCreated: 0, linesCreated: 0, message: pe.message };
  }
  const partnerByCode = new Map<string, string>();
  for (const p of partnerRows ?? []) {
    partnerByCode.set(normKey(p.code as string), p.id as string);
  }

  const { data: productRows, error: pre } = await supabase.from("products").select("id, code");
  if (pre) {
    return { ok: false, ordersCreated: 0, linesCreated: 0, message: pre.message };
  }
  const productByCode = new Map<string, string>();
  for (const pr of productRows ?? []) {
    productByCode.set(normKey(pr.code as string), pr.id as string);
  }

  const errors: string[] = [];
  const lineProductId = new Map<ParsedLabOrderLine, string>();

  for (const line of parsed) {
    const pk = normKey(line.partnerCode);
    if (!partnerByCode.has(pk)) {
      errors.push(`Dòng ${line.sourceRow}: không tìm thấy đối tác mã “${line.partnerCode}”.`);
      continue;
    }
    let productId: string | undefined;
    for (const code of productCodeCandidates(line)) {
      const id = productByCode.get(normKey(code));
      if (id) {
        productId = id;
        break;
      }
    }
    if (!productId) {
      errors.push(
        `Dòng ${line.sourceRow}: không khớp sản phẩm (đã thử: ${productCodeCandidates(line).join(", ") || "—"}).`,
      );
      continue;
    }
    lineProductId.set(line, productId);
  }

  if (errors.length) {
    return {
      ok: false,
      ordersCreated: 0,
      linesCreated: 0,
      errors,
      message: `Có ${errors.length} lỗi. Sửa file hoặc danh mục rồi thử lại.`,
    };
  }

  const groups = new Map<string, ParsedLabOrderLine[]>();
  for (const line of parsed) {
    const k = groupKey(line);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(line);
  }
  for (const lines of groups.values()) {
    lines.sort((a, b) => a.sourceRow - b.sourceRow);
  }

  const createdOrderIds: string[] = [];
  let ordersCreated = 0;
  let linesCreated = 0;

  try {
    for (const lines of groups.values()) {
      const first = lines[0]!;
      const partnerId = partnerByCode.get(normKey(first.partnerCode))!;
      const order_number = makeOrderNumber(first.receivedAtIso, first.partnerCode);
      const { data: ord, error: oe } = await supabase
        .from("lab_orders")
        .insert({
          order_number,
          received_at: first.receivedAtIso,
          partner_id: partnerId,
          patient_name: first.patientName,
          status: "draft",
          notes: orderNotesFromGroup(lines),
        })
        .select("id")
        .single();
      if (oe) throw new Error(oe.message);
      if (!ord?.id) throw new Error("Không tạo được đơn.");
      createdOrderIds.push(ord.id as string);
      ordersCreated += 1;

      const inserts = lines.map((l) => ({
        order_id: ord.id as string,
        product_id: lineProductId.get(l)!,
        tooth_positions: l.toothPositions,
        shade: l.shade.trim() || null,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        discount_percent: 0,
        notes: lineNotes(l),
      }));

      const { error: le } = await supabase.from("lab_order_lines").insert(inserts);
      if (le) throw new Error(le.message);
      linesCreated += inserts.length;
    }
  } catch (e) {
    if (createdOrderIds.length) {
      await supabase.from("lab_orders").delete().in("id", createdOrderIds);
    }
    return {
      ok: false,
      ordersCreated: 0,
      linesCreated: 0,
      message: e instanceof Error ? e.message : "Lỗi khi ghi database.",
    };
  }

  revalidatePath("/orders");
  return {
    ok: true,
    ordersCreated,
    linesCreated,
    message: `Đã tạo ${ordersCreated} đơn, ${linesCreated} dòng chi tiết.`,
  };
}
