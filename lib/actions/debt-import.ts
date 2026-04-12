"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseDebtSheet, tryParseDebtPeriodBanner } from "@/lib/import/parse-debt-excel";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type ImportDebtOpeningResult = {
  ok: boolean;
  saved: number;
  message?: string;
  errors?: string[];
};

const rowSchema = z.object({
  code: z.string().min(1).max(200),
  opening: z.coerce.number(),
});

function normKey(s: string) {
  return s.trim().toUpperCase();
}

export async function importDebtOpeningFromExcel(formData: FormData): Promise<ImportDebtOpeningResult> {
  const raw = formData.get("file");
  if (!raw || !(raw instanceof File)) {
    return { ok: false, saved: 0, message: "Chưa chọn file." };
  }
  if (raw.size > 8 * 1024 * 1024) {
    return { ok: false, saved: 0, message: "File quá lớn (tối đa 8MB)." };
  }

  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { ok: false, saved: 0, message: "Năm không hợp lệ." };
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { ok: false, saved: 0, message: "Tháng không hợp lệ." };
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
      saved: 0,
      message: e instanceof Error ? e.message : "Không đọc được file Excel.",
    };
  }

  const validationErrors: string[] = [];
  const banner = tryParseDebtPeriodBanner(aoa);
  if (banner && (banner.year !== year || banner.month !== month)) {
    validationErrors.push(
      "File ghi THÁNG " +
        String(banner.month).padStart(2, "0") +
        "/" +
        banner.year +
        " nhưng màn hình đang chọn Tháng " +
        month +
        "/" +
        year +
        " — nợ đầu kỳ vẫn ghi theo lựa chọn trên màn hình.",
    );
  }

  let parsed: ReturnType<typeof parseDebtSheet>;
  try {
    parsed = parseDebtSheet(aoa);
  } catch (e) {
    return {
      ok: false,
      saved: 0,
      message: e instanceof Error ? e.message : "Không phân tích được sheet.",
    };
  }

  validationErrors.push(...parsed.errors);

  const lastByCode = new Map<string, z.infer<typeof rowSchema> & { name: string }>();

  for (const pr of parsed.rows) {
    const vr = rowSchema.safeParse({
      code: pr.code.trim(),
      opening: pr.opening,
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
    lastByCode.set(k, { ...vr.data, name: pr.name });
  }

  const validRows = [...lastByCode.values()];

  if (!validRows.length) {
    return {
      ok: false,
      saved: 0,
      errors: validationErrors.length ? validationErrors : undefined,
      message: validationErrors.length
        ? "Không có dòng hợp lệ."
        : "File không có dòng dữ liệu.",
    };
  }

  const supabase = createSupabaseAdmin();
  const { data: partners, error: pe } = await supabase
    .from("partners")
    .select("id, code, name, partner_type")
    .in("partner_type", ["customer_clinic", "customer_labo"]);
  if (pe) {
    return { ok: false, saved: 0, message: pe.message };
  }

  const idByCode = new Map<string, { id: string; name: string }>();
  for (const p of partners ?? []) {
    idByCode.set(normKey(p.code as string), {
      id: p.id as string,
      name: (p.name as string) ?? "",
    });
  }

  const upserts: Record<string, unknown>[] = [];
  for (const row of validRows) {
    const k = normKey(row.code);
    const hit = idByCode.get(k);
    if (!hit) {
      validationErrors.push("Mã " + row.code + ": không có KH phòng khám/labo trong hệ thống (bỏ qua).");
      continue;
    }
    const fileName = row.name.trim();
    if (fileName && hit.name.trim() && fileName.toLowerCase() !== hit.name.trim().toLowerCase()) {
      validationErrors.push(
        "Mã " + row.code + ": tên trong file khác danh mục («" + fileName + "» vs «" + hit.name + "»).",
      );
    }
    upserts.push({
      partner_id: hit.id,
      year,
      month,
      opening_balance: row.opening,
    });
  }

  if (!upserts.length) {
    return {
      ok: false,
      saved: 0,
      errors: validationErrors.length ? validationErrors : undefined,
      message: "Không có dòng nào khớp mã KH (phòng khám/labo).",
    };
  }

  const { error: upErr } = await supabase.from("partner_opening_balances").upsert(upserts, {
    onConflict: "partner_id,year,month",
  });
  if (upErr) {
    return { ok: false, saved: 0, message: upErr.message };
  }

  revalidatePath("/accounting/debt");

  return {
    ok: true,
    saved: upserts.length,
    message: "Đã nhập nợ đầu kỳ cho " + upserts.length + " khách (tháng " + month + "/" + year + ").",
    errors: validationErrors.length ? validationErrors : undefined,
  };
}
