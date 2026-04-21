"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { type AttendanceStatus } from "@/lib/actions/attendance";

export type PayrollPreviewRow = {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  position: string | null;
  department: string | null;
  base_salary: number;
  worked_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  overtime_hours: number;
  allowance: number;
  deduction: number;
  gross_salary: number;
  net_salary: number;
  note: string | null;
};

type Aggregation = {
  worked: number;
  paidLeave: number;
  unpaidLeave: number;
  ot: number;
};

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

function addByStatus(agg: Aggregation, status: AttendanceStatus) {
  if (status === "present") agg.worked += 1;
  else if (status === "half") agg.worked += 0.5;
  else if (status === "paid_leave") {
    agg.worked += 1;
    agg.paidLeave += 1;
  } else if (status === "unpaid_leave" || status === "absent") {
    agg.unpaidLeave += 1;
  }
}

export async function calculatePayrollPreview(year: number, month: number, standardDays: number, overtimeRate: number) {
  const supabase = createSupabaseAdmin();
  const { start, end } = monthBounds(year, month);
  const [{ data: employees, error: empErr }, { data: attendance, error: attErr }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, code, full_name, position, department, base_salary")
      .eq("is_active", true)
      .order("code", { ascending: true })
      .limit(1000),
    supabase
      .from("attendance_records")
      .select("employee_id, status, overtime_hours")
      .gte("work_date", start)
      .lte("work_date", end)
      .limit(10000),
  ]);
  if (empErr) throw new Error(empErr.message);
  if (attErr) throw new Error(attErr.message);

  const agg = new Map<string, Aggregation>();
  for (const row of attendance ?? []) {
    const eid = row["employee_id"] as string;
    const curr = agg.get(eid) ?? { worked: 0, paidLeave: 0, unpaidLeave: 0, ot: 0 };
    addByStatus(curr, row["status"] as AttendanceStatus);
    curr.ot += Number(row["overtime_hours"] ?? 0);
    agg.set(eid, curr);
  }

  return (employees ?? []).map((e) => {
    const id = e["id"] as string;
    const a = agg.get(id) ?? { worked: 0, paidLeave: 0, unpaidLeave: 0, ot: 0 };
    const base = Number(e["base_salary"] ?? 0);
    const gross = (base * a.worked) / Math.max(1, standardDays) + a.ot * Math.max(0, overtimeRate);
    return {
      employee_id: id,
      employee_code: e["code"] as string,
      employee_name: e["full_name"] as string,
      position: e["position"] as string | null,
      department: e["department"] as string | null,
      base_salary: base,
      worked_days: Number(a.worked.toFixed(2)),
      paid_leave_days: Number(a.paidLeave.toFixed(2)),
      unpaid_leave_days: Number(a.unpaidLeave.toFixed(2)),
      overtime_hours: Number(a.ot.toFixed(2)),
      allowance: 0,
      deduction: 0,
      gross_salary: Math.round(gross),
      net_salary: Math.round(gross),
      note: null,
    } as PayrollPreviewRow;
  });
}

const runSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  standard_work_days: z.coerce.number().positive(),
  overtime_rate_per_hour: z.coerce.number().min(0),
  note: z.string().max(2000).optional().nullable(),
  rows: z.array(
    z.object({
      employee_id: z.string().uuid(),
      allowance: z.coerce.number().min(0).default(0),
      deduction: z.coerce.number().min(0).default(0),
      note: z.string().max(1000).optional().nullable(),
    }),
  ),
});

export async function upsertPayrollRun(input: z.infer<typeof runSchema>) {
  const supabase = createSupabaseAdmin();
  const payload = runSchema.parse(input);
  const preview = await calculatePayrollPreview(
    payload.year,
    payload.month,
    payload.standard_work_days,
    payload.overtime_rate_per_hour,
  );
  const rowAdj = new Map(payload.rows.map((r) => [r.employee_id, r]));
  const merged = preview.map((p) => {
    const adj = rowAdj.get(p.employee_id);
    const allowance = Number(adj?.allowance ?? 0);
    const deduction = Number(adj?.deduction ?? 0);
    const net = p.gross_salary + allowance - deduction;
    return {
      ...p,
      allowance,
      deduction,
      net_salary: Math.round(net),
      note: adj?.note?.trim() ? adj.note.trim() : null,
    };
  });

  const { data: existing, error: exErr } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("year", payload.year)
    .eq("month", payload.month)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

  let runId = existing?.id as string | undefined;
  if (runId) {
    const { error } = await supabase
      .from("payroll_runs")
      .update({
        standard_work_days: payload.standard_work_days,
        overtime_rate_per_hour: payload.overtime_rate_per_hour,
        note: payload.note?.trim() ? payload.note.trim() : null,
      })
      .eq("id", runId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("payroll_runs")
      .insert({
        year: payload.year,
        month: payload.month,
        standard_work_days: payload.standard_work_days,
        overtime_rate_per_hour: payload.overtime_rate_per_hour,
        note: payload.note?.trim() ? payload.note.trim() : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    runId = data.id as string;
  }

  const { error: delErr } = await supabase.from("payroll_lines").delete().eq("run_id", runId);
  if (delErr) throw new Error(delErr.message);
  if (merged.length) {
    const lines = merged.map((m) => ({
      run_id: runId,
      employee_id: m.employee_id,
      base_salary: m.base_salary,
      worked_days: m.worked_days,
      paid_leave_days: m.paid_leave_days,
      unpaid_leave_days: m.unpaid_leave_days,
      overtime_hours: m.overtime_hours,
      allowance: m.allowance,
      deduction: m.deduction,
      gross_salary: m.gross_salary,
      net_salary: m.net_salary,
      note: m.note,
    }));
    const { error: insErr } = await supabase.from("payroll_lines").insert(lines);
    if (insErr) throw new Error(insErr.message);
  }
  revalidatePath("/hr/payroll");
}

export type PayrollHistoryRow = {
  run_id: string;
  year: number;
  month: number;
  created_at: string;
  standard_work_days: number;
  overtime_rate_per_hour: number;
  total_net_salary: number;
};

export type PayrollRunLineRow = {
  employee_id: string;
  allowance: number;
  deduction: number;
  note: string | null;
};

export async function listPayrollRuns(limit = 24): Promise<PayrollHistoryRow[]> {
  const supabase = createSupabaseAdmin();
  const { data: runs, error } = await supabase
    .from("payroll_runs")
    .select("id, year, month, created_at, standard_work_days, overtime_rate_per_hour")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const runIds = (runs ?? []).map((r) => r.id as string);
  const totals = new Map<string, number>();
  if (runIds.length) {
    const { data: lines, error: lineErr } = await supabase
      .from("payroll_lines")
      .select("run_id, net_salary")
      .in("run_id", runIds)
      .limit(10000);
    if (lineErr) throw new Error(lineErr.message);
    for (const ln of lines ?? []) {
      const rid = ln["run_id"] as string;
      totals.set(rid, (totals.get(rid) ?? 0) + Number(ln["net_salary"] ?? 0));
    }
  }
  return (runs ?? []).map((r) => ({
    run_id: r["id"] as string,
    year: Number(r["year"]),
    month: Number(r["month"]),
    created_at: r["created_at"] as string,
    standard_work_days: Number(r["standard_work_days"] ?? 0),
    overtime_rate_per_hour: Number(r["overtime_rate_per_hour"] ?? 0),
    total_net_salary: Math.round(totals.get(r["id"] as string) ?? 0),
  }));
}

export async function getPayrollRunLines(year: number, month: number): Promise<PayrollRunLineRow[]> {
  const supabase = createSupabaseAdmin();
  const { data: run, error: runErr } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (runErr) throw new Error(runErr.message);
  if (!run) return [];
  const { data, error } = await supabase
    .from("payroll_lines")
    .select("employee_id, allowance, deduction, note")
    .eq("run_id", run["id"] as string)
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    employee_id: r["employee_id"] as string,
    allowance: Number(r["allowance"] ?? 0),
    deduction: Number(r["deduction"] ?? 0),
    note: (r["note"] as string | null) ?? null,
  }));
}
export type PayrollRunDetailRow = {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  position: string | null;
  department: string | null;
  base_salary: number;
  worked_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  overtime_hours: number;
  allowance: number;
  deduction: number;
  gross_salary: number;
  net_salary: number;
  note: string | null;
};

export async function getPayrollRunDetail(year: number, month: number): Promise<PayrollRunDetailRow[]> {
  const supabase = createSupabaseAdmin();
  const { data: run, error: runErr } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (runErr) throw new Error(runErr.message);
  if (!run) return [];
  
  const { data, error } = await supabase
    .from("payroll_lines")
    .select(`
      employee_id,
      base_salary,
      worked_days,
      paid_leave_days,
      unpaid_leave_days,
      overtime_hours,
      allowance,
      deduction,
      gross_salary,
      net_salary,
      note,
      employees!payroll_lines_employee_id_fkey(code, full_name, position, department)
    `)
    .eq("run_id", run.id as string)
    .order("employees.code", { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);
  
  return (data ?? []).map((r) => {
    const emp = r.employees as { code: string; full_name: string; position: string | null; department: string | null } | null;
    return {
      employee_id: r.employee_id as string,
      employee_code: emp?.code ?? "",
      employee_name: emp?.full_name ?? "",
      position: emp?.position ?? null,
      department: emp?.department ?? null,
      base_salary: Number(r.base_salary ?? 0),
      worked_days: Number(r.worked_days ?? 0),
      paid_leave_days: Number(r.paid_leave_days ?? 0),
      unpaid_leave_days: Number(r.unpaid_leave_days ?? 0),
      overtime_hours: Number(r.overtime_hours ?? 0),
      allowance: Number(r.allowance ?? 0),
      deduction: Number(r.deduction ?? 0),
      gross_salary: Number(r.gross_salary ?? 0),
      net_salary: Number(r.net_salary ?? 0),
      note: (r.note as string | null) ?? null,
    };
  });
}