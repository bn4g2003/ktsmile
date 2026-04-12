"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parsePartnersSheet } from "@/lib/import/parse-partners-excel";
import { parseSuppliersSheet } from "@/lib/import/parse-suppliers-excel";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type ImportPartnersResult = {
  ok: boolean;
  inserted: number;
  updated: number;
  message?: string;
  errors?: string[];
};

const rowSchema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  representative_name: z.string().max(500).nullable(),
  phone: z.string().max(100).nullable(),
  address: z.string().max(1000).nullable(),
  tax_id: z.string().max(100).nullable(),
  notes: z.string().max(2000).nullable(),
});

function normKey(s: string) {
  return s.trim().toUpperCase();
}

type PartnerTypeDb = "customer_clinic" | "customer_labo" | "supplier";

type UnifiedImportRow = z.infer<typeof rowSchema>;

async function applyPartnerRowsToDb(
  validRows: UnifiedImportRow[],
  validationErrors: string[],
  opts: {
    partnerTypeOnInsert: PartnerTypeDb;
    allowedExistingTypes: Set<PartnerTypeDb>;
    wrongExistingMessage: (code: string) => string;
  },
): Promise<ImportPartnersResult> {
  if (!validRows.length) {
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      errors: validationErrors.length ? validationErrors : undefined,
      message: validationErrors.length
        ? "Không có dòng hợp lệ."
        : "File không có dòng dữ liệu.",
    };
  }

  const supabase = createSupabaseAdmin();
  const { data: existing, error: exErr } = await supabase
    .from("partners")
    .select("id, code, partner_type");
  if (exErr) {
    return { ok: false, inserted: 0, updated: 0, message: exErr.message };
  }

  const idByCode = new Map<string, string>();
  const typeByCode = new Map<string, PartnerTypeDb>();
  for (const p of existing ?? []) {
    const k = normKey(p.code as string);
    idByCode.set(k, p.id as string);
    typeByCode.set(k, p.partner_type as PartnerTypeDb);
  }

  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const rowErrors: string[] = [...validationErrors];

  for (const row of validRows) {
    const k = normKey(row.code);
    const id = idByCode.get(k);
    const base = {
      name: row.name.trim(),
      representative_name: row.representative_name,
      phone: row.phone,
      address: row.address,
      tax_id: row.tax_id,
      notes: row.notes,
      is_active: true,
    };

    if (id) {
      const pt = typeByCode.get(k);
      if (!pt || !opts.allowedExistingTypes.has(pt)) {
        rowErrors.push(opts.wrongExistingMessage(row.code.trim()));
        continue;
      }
      updates.push({
        id,
        patch: {
          ...base,
        },
      });
    } else {
      inserts.push({
        code: row.code.trim(),
        ...base,
        partner_type: opts.partnerTypeOnInsert,
        default_discount_percent: 0,
      });
    }
  }

  let inserted = 0;
  let updated = 0;

  try {
    const chunk = 80;
    for (let i = 0; i < inserts.length; i += chunk) {
      const part = inserts.slice(i, i + chunk);
      if (!part.length) continue;
      const { error } = await supabase.from("partners").insert(part);
      if (error) throw new Error(error.message);
      inserted += part.length;
    }

    for (const u of updates) {
      const { error } = await supabase.from("partners").update(u.patch).eq("id", u.id);
      if (error) throw new Error(error.message);
      updated += 1;
    }
  } catch (e) {
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      message: e instanceof Error ? e.message : "Lỗi khi ghi database.",
    };
  }

  revalidatePath("/master/partners");
  revalidatePath("/orders");
  revalidatePath("/inventory/documents");

  const parts = [
    inserted ? "Thêm " + inserted + " bản ghi" : null,
    updated ? "Cập nhật " + updated + " bản ghi (trùng mã)" : null,
  ].filter(Boolean);

  return {
    ok: true,
    inserted,
    updated,
    message: (parts.length ? parts.join(" · ") : "Không thay đổi.") + ".",
    errors: rowErrors.length ? rowErrors : undefined,
  };
}

export async function importCustomerPartnersFromExcel(formData: FormData): Promise<ImportPartnersResult> {
  const raw = formData.get("file");
  if (!raw || !(raw instanceof File)) {
    return { ok: false, inserted: 0, updated: 0, message: "Chưa chọn file." };
  }
  if (raw.size > 8 * 1024 * 1024) {
    return { ok: false, inserted: 0, updated: 0, message: "File quá lớn (tối đa 8MB)." };
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
      inserted: 0,
      updated: 0,
      message: e instanceof Error ? e.message : "Không đọc được file Excel.",
    };
  }

  let parsed: ReturnType<typeof parsePartnersSheet>;
  try {
    parsed = parsePartnersSheet(aoa);
  } catch (e) {
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      message: e instanceof Error ? e.message : "Không phân tích được sheet.",
    };
  }

  const validationErrors: string[] = [...parsed.errors];
  const lastByCode = new Map<string, UnifiedImportRow>();

  for (const pr of parsed.rows) {
    const vr = rowSchema.safeParse({
      code: pr.code.trim(),
      name: pr.name.trim(),
      representative_name: pr.representative_name,
      phone: pr.phone,
      address: pr.address,
      tax_id: pr.tax_id,
      notes: pr.notes,
    });
    if (!vr.success) {
      validationErrors.push(
        "Dòng " + pr.sourceRow + ": " + vr.error.issues.map((i) => i.message).join("; "),
      );
      continue;
    }
    const k = normKey(vr.data.code);
    if (lastByCode.has(k)) {
      validationErrors.push(
        "Dòng " + pr.sourceRow + ": trùng mã KH trong file (giữ bản cuối).",
      );
    }
    lastByCode.set(k, vr.data);
  }

  return applyPartnerRowsToDb([...lastByCode.values()], validationErrors, {
    partnerTypeOnInsert: "customer_clinic",
    allowedExistingTypes: new Set<PartnerTypeDb>(["customer_clinic", "customer_labo"]),
    wrongExistingMessage: (code) =>
      "Mã “" + code + "” đã tồn tại dạng NCC — bỏ qua dòng (dùng tab NCC hoặc đổi mã).",
  });
}

export async function importSupplierPartnersFromExcel(formData: FormData): Promise<ImportPartnersResult> {
  const raw = formData.get("file");
  if (!raw || !(raw instanceof File)) {
    return { ok: false, inserted: 0, updated: 0, message: "Chưa chọn file." };
  }
  if (raw.size > 8 * 1024 * 1024) {
    return { ok: false, inserted: 0, updated: 0, message: "File quá lớn (tối đa 8MB)." };
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
      inserted: 0,
      updated: 0,
      message: e instanceof Error ? e.message : "Không đọc được file Excel.",
    };
  }

  let parsed: ReturnType<typeof parseSuppliersSheet>;
  try {
    parsed = parseSuppliersSheet(aoa);
  } catch (e) {
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      message: e instanceof Error ? e.message : "Không phân tích được sheet NCC.",
    };
  }

  const validationErrors: string[] = [...parsed.errors];
  const lastByCode = new Map<string, UnifiedImportRow>();

  for (const pr of parsed.rows) {
    const vr = rowSchema.safeParse({
      code: pr.code.trim(),
      name: pr.name.trim(),
      representative_name: null,
      phone: pr.phone,
      address: pr.address,
      tax_id: pr.tax_id,
      notes: pr.notes,
    });
    if (!vr.success) {
      validationErrors.push(
        "Dòng " + pr.sourceRow + ": " + vr.error.issues.map((i) => i.message).join("; "),
      );
      continue;
    }
    const k = normKey(vr.data.code);
    if (lastByCode.has(k)) {
      validationErrors.push(
        "Dòng " + pr.sourceRow + ": trùng mã NCC trong file (giữ bản cuối).",
      );
    }
    lastByCode.set(k, vr.data);
  }

  return applyPartnerRowsToDb([...lastByCode.values()], validationErrors, {
    partnerTypeOnInsert: "supplier",
    allowedExistingTypes: new Set<PartnerTypeDb>(["supplier"]),
    wrongExistingMessage: (code) =>
      "Mã “" + code + "” đã tồn tại dạng khách — bỏ qua dòng (dùng tab Khách hoặc đổi mã).",
  });
}
