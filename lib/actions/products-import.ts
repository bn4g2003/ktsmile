"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseProductsPriceSheet } from "@/lib/import/parse-products-excel";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type ImportProductsResult = {
  ok: boolean;
  inserted: number;
  updated: number;
  message?: string;
  errors?: string[];
};

function mergeNotesIntoName(name: string, notes: string | null): string {
  const n = name.trim();
  const g = notes?.trim();
  if (!g) return n.slice(0, 500);
  return (n + " — " + g).slice(0, 500);
}

const rowSchema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  unit: z.string().min(1).max(50),
  unit_price: z.coerce.number().min(0),
  warranty_years: z.number().int().min(0).max(32767).nullable(),
});

function normKey(s: string) {
  return s.trim().toUpperCase();
}

export async function importProductsFromExcel(formData: FormData): Promise<ImportProductsResult> {
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

  let parsed: ReturnType<typeof parseProductsPriceSheet>;
  try {
    parsed = parseProductsPriceSheet(aoa);
  } catch (e) {
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      message: e instanceof Error ? e.message : "Không phân tích được sheet.",
    };
  }

  const validationErrors: string[] = [...parsed.errors];
  const lastByCode = new Map<string, z.infer<typeof rowSchema>>();

  for (const pr of parsed.rows) {
    const displayName = mergeNotesIntoName(pr.name, pr.notes);
    const vr = rowSchema.safeParse({
      code: pr.code.trim(),
      name: displayName,
      unit: pr.unit.trim(),
      unit_price: pr.unit_price,
      warranty_years: pr.warranty_years ?? null,
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
        "Dòng " + pr.sourceRow + ": trùng mã " + vr.data.code + " trong file (giữ bản cuối).",
      );
    }
    lastByCode.set(k, vr.data);
  }

  const validRows = [...lastByCode.values()];

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
  const { data: existing, error: exErr } = await supabase.from("products").select("id, code");
  if (exErr) {
    return { ok: false, inserted: 0, updated: 0, message: exErr.message };
  }

  const idByCode = new Map<string, string>();
  for (const p of existing ?? []) {
    idByCode.set(normKey(p.code as string), p.id as string);
  }

  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  for (const row of validRows) {
    const k = normKey(row.code);
    const id = idByCode.get(k);
    const patch = {
      name: row.name.trim(),
      unit: row.unit.trim(),
      unit_price: row.unit_price,
      warranty_years: row.warranty_years ?? null,
    };
    if (id) {
      updates.push({ id, patch });
    } else {
      inserts.push({
        code: row.code.trim(),
        ...patch,
        is_active: true,
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
      const { error } = await supabase.from("products").insert(part);
      if (error) throw new Error(error.message);
      inserted += part.length;
    }

    for (const u of updates) {
      const { error } = await supabase.from("products").update(u.patch).eq("id", u.id);
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

  revalidatePath("/master/products");
  revalidatePath("/master/prices");
  revalidatePath("/orders");

  const parts = [
    inserted ? "Thêm " + inserted + " SP" : null,
    updated ? "Cập nhật " + updated + " SP (trùng mã)" : null,
  ].filter(Boolean);

  return {
    ok: true,
    inserted,
    updated,
    message: (parts.length ? parts.join(" · ") : "Không thay đổi.") + ".",
    errors: validationErrors.length ? validationErrors : undefined,
  };
}
