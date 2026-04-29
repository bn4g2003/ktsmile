"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseMaterialsPriceSheet } from "@/lib/import/parse-materials-excel";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type ImportMaterialsResult = {
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
});

function normKey(s: string) {
  return s.trim().toUpperCase();
}

export async function importMaterialsFromExcel(formData: FormData): Promise<ImportMaterialsResult> {
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

  let parsed: ReturnType<typeof parseMaterialsPriceSheet>;
  try {
    parsed = parseMaterialsPriceSheet(aoa);
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
  const { data: existing, error: exErr } = await supabase
    .from("materials")
    .select("id, code, legacy_product_id");
  if (exErr) {
    return { ok: false, inserted: 0, updated: 0, message: exErr.message };
  }

  const idByCode = new Map<string, string>();
  const legacyByMaterialId = new Map<string, string | null>();
  for (const m of existing ?? []) {
    idByCode.set(normKey(m.code as string), m.id as string);
    legacyByMaterialId.set(m.id as string, (m.legacy_product_id as string | null) ?? null);
  }

  const inserts: z.infer<typeof rowSchema>[] = [];
  const updates: { materialId: string; legacyId: string | null; row: z.infer<typeof rowSchema> }[] =
    [];

  for (const row of validRows) {
    const k = normKey(row.code);
    const materialId = idByCode.get(k);
    if (materialId) {
      updates.push({ materialId, legacyId: legacyByMaterialId.get(materialId) ?? null, row });
    } else {
      inserts.push(row);
    }
  }

  let inserted = 0;
  let updated = 0;

  try {
    const chunk = 80;
    for (let i = 0; i < inserts.length; i += chunk) {
      const part = inserts.slice(i, i + chunk);
      if (!part.length) continue;

      const productPayloads = part.map((r) => ({
        code: r.code.trim(),
        name: r.name.trim(),
        unit: r.unit.trim(),
        unit_price: r.unit_price,
        warranty_years: null as null,
        is_active: true,
        product_usage: "inventory" as const,
      }));

      const { data: newProds, error: insErr } = await supabase
        .from("products")
        .insert(productPayloads)
        .select("id, code");
      if (insErr) throw new Error(insErr.message);
      const prods = (newProds ?? []) as { id: string; code: string }[];

      const byNormCode = new Map<string, z.infer<typeof rowSchema>>();
      for (const r of part) {
        byNormCode.set(normKey(r.code), r);
      }

      const materialPayloads = prods.map((p) => {
        const src = byNormCode.get(normKey(p.code));
        if (!src) throw new Error("Lệch map mã sau khi chèn products.");
        return {
          legacy_product_id: p.id,
          code: src.code.trim(),
          name: src.name.trim(),
          unit: src.unit.trim(),
          is_active: true,
        };
      });

      const { error: matErr } = await supabase.from("materials").insert(materialPayloads);
      if (matErr) throw new Error(matErr.message);
      inserted += part.length;
    }

    for (const u of updates) {
      const r = u.row;
      const patchMat = {
        code: r.code.trim(),
        name: r.name.trim(),
        unit: r.unit.trim(),
        is_active: true,
      };
      const { error: me } = await supabase.from("materials").update(patchMat).eq("id", u.materialId);
      if (me) throw new Error(me.message);

      if (u.legacyId) {
        const { error: pe } = await supabase
          .from("products")
          .update({
            code: r.code.trim(),
            name: r.name.trim(),
            unit: r.unit.trim(),
            unit_price: r.unit_price,
            is_active: true,
            product_usage: "inventory",
          })
          .eq("id", u.legacyId);
        if (pe) throw new Error(pe.message);
      }
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
  revalidatePath("/inventory/stock");
  revalidatePath("/orders");

  const parts = [
    inserted ? "Thêm " + inserted + " NVL" : null,
    updated ? "Cập nhật " + updated + " NVL (trùng mã)" : null,
  ].filter(Boolean);

  return {
    ok: true,
    inserted,
    updated,
    message: (parts.length ? parts.join(" · ") : "Không thay đổi.") + ".",
    errors: validationErrors.length ? validationErrors : undefined,
  };
}
