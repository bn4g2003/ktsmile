"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export type AttendanceStatus = "present" | "half" | "paid_leave" | "unpaid_leave" | "absent";

export type AttendanceRow = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  work_date: string;
  status: AttendanceStatus;
  overtime_hours: number;
  note: string | null;
};

type AttendanceAccessScope = "self" | "all";

export type AttendanceAccessProfile = {
  employee_id: string;
  scope: AttendanceAccessScope;
  can_view_all: boolean;
  can_manage_all: boolean;
};

function resolveAttendanceScope(scopeFromRole: "all" | "self" | null | undefined): AttendanceAccessScope {
  if (scopeFromRole === "all") return "all";
  return "self";
}

async function getAttendanceAccessContext(): Promise<AttendanceAccessProfile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Phiên đăng nhập không hợp lệ.");
  const scope = resolveAttendanceScope(user.attendance_scope);
  return {
    employee_id: user.employee_id,
    scope,
    can_view_all: scope === "all",
    can_manage_all: scope === "all",
  };
}

export async function getAttendanceAccessProfile(): Promise<AttendanceAccessProfile> {
  return getAttendanceAccessContext();
}

const schema = z.object({
  employee_id: z.string().uuid(),
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "half", "paid_leave", "unpaid_leave", "absent"]),
  overtime_hours: z.coerce.number().min(0).max(24).default(0),
  note: z.string().max(2000).optional().nullable(),
});

function monthBounds(year: number, month: number) {
  const y = Math.floor(year);
  const m = Math.floor(month);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

export async function listAttendanceByMonth(year: number, month: number): Promise<AttendanceRow[]> {
  const access = await getAttendanceAccessContext();
  const supabase = createSupabaseAdmin();
  const { start, end } = monthBounds(year, month);
  let empQuery = supabase.from("employees").select("id, code, full_name");
  if (access.scope === "self") empQuery = empQuery.eq("id", access.employee_id);

  let rowQuery = supabase
      .from("attendance_records")
      .select("id, employee_id, work_date, status, overtime_hours, note, created_at")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3000);
  if (access.scope === "self") rowQuery = rowQuery.eq("employee_id", access.employee_id);

  const [{ data: emps, error: empErr }, { data: rows, error: rowErr }] = await Promise.all([
    empQuery,
    rowQuery,
  ]);
  if (empErr) throw new Error(empErr.message);
  if (rowErr) throw new Error(rowErr.message);
  const byId = new Map<string, { code: string; full_name: string }>();
  for (const e of emps ?? []) {
    byId.set(e["id"] as string, {
      code: (e["code"] as string) ?? "",
      full_name: (e["full_name"] as string) ?? "",
    });
  }
  return (rows ?? []).map((r) => {
    const eid = r["employee_id"] as string;
    const e = byId.get(eid);
    return {
      id: r["id"] as string,
      employee_id: eid,
      employee_code: e?.code ?? "",
      employee_name: e?.full_name ?? "",
      work_date: r["work_date"] as string,
      status: r["status"] as AttendanceStatus,
      overtime_hours: Number(r["overtime_hours"] ?? 0),
      note: (r["note"] as string | null) ?? null,
    };
  });
}

export async function upsertAttendance(input: z.infer<typeof schema>) {
  const access = await getAttendanceAccessContext();
  const supabase = createSupabaseAdmin();
  const row = schema.parse(input);
  if (access.scope === "self" && row.employee_id !== access.employee_id) {
    throw new Error("Bạn chỉ có quyền chấm công cho chính mình.");
  }
  const { error } = await supabase.from("attendance_records").upsert(
    {
      employee_id: row.employee_id,
      work_date: row.work_date,
      status: row.status,
      overtime_hours: row.overtime_hours,
      note: row.note?.trim() ? row.note.trim() : null,
    },
    { onConflict: "employee_id,work_date" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/hr/attendance");
  revalidatePath("/hr/payroll");
}

export async function deleteAttendance(id: string) {
  const access = await getAttendanceAccessContext();
  const supabase = createSupabaseAdmin();
  if (access.scope === "self") {
    const { data: row, error: ge } = await supabase
      .from("attendance_records")
      .select("employee_id")
      .eq("id", id)
      .maybeSingle();
    if (ge) throw new Error(ge.message);
    if (!row || (row["employee_id"] as string) !== access.employee_id) {
      throw new Error("Bạn chỉ có quyền xóa chấm công của chính mình.");
    }
  }
  const { error } = await supabase.from("attendance_records").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/hr/attendance");
  revalidatePath("/hr/payroll");
}
