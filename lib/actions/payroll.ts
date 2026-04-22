"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { type AttendanceStatus } from "@/lib/actions/attendance";
import {
  calculatePayrollLine,
  type PayrollBaseRow,
  type PayrollComputedLine,
  type PayrollRunSettings,
} from "@/lib/payroll/calc";

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

const rowInputSchema = z.object({
  employee_id: z.string().uuid(),
  lunch_allowance: z.coerce.number().min(0).default(0),
  fuel_allowance: z.coerce.number().min(0).default(0),
  phone_allowance: z.coerce.number().min(0).default(0),
  holiday_bonus: z.coerce.number().min(0).default(0),
  sales_bonus: z.coerce.number().min(0).default(0),
  social_insurance: z.coerce.number().min(0).default(0),
  health_insurance: z.coerce.number().min(0).default(0),
  unemployment_insurance: z.coerce.number().min(0).default(0),
  dependent_count: z.coerce.number().int().min(0).default(0),
  advance_payment: z.coerce.number().min(0).default(0),
  note: z.string().max(1000).optional().nullable(),
});

const runSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  standard_work_days: z.coerce.number().positive(),
  overtime_rate_per_hour: z.coerce.number().min(0),
  family_deduction_amount: z.coerce.number().min(0).default(11_000_000),
  dependent_deduction_amount: z.coerce.number().min(0).default(4_400_000),
  note: z.string().max(2000).optional().nullable(),
  rows: z.array(rowInputSchema),
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
  const runSettings = {
    standard_work_days: payload.standard_work_days,
    overtime_rate_per_hour: payload.overtime_rate_per_hour,
    family_deduction_amount: payload.family_deduction_amount,
    dependent_deduction_amount: payload.dependent_deduction_amount,
  } satisfies PayrollRunSettings;
  const merged = preview.map((p) =>
    calculatePayrollLine(
      {
        employee_id: p.employee_id,
        employee_code: p.employee_code,
        employee_name: p.employee_name,
        position: p.position,
        department: p.department,
        base_salary: p.base_salary,
        worked_days: p.worked_days,
        paid_leave_days: p.paid_leave_days,
        unpaid_leave_days: p.unpaid_leave_days,
        overtime_hours: p.overtime_hours,
        gross_salary: p.gross_salary,
        note: p.note,
      } satisfies PayrollBaseRow,
      runSettings,
      rowAdj.get(p.employee_id) ?? {
        lunch_allowance: 0,
        fuel_allowance: 0,
        phone_allowance: 0,
        holiday_bonus: 0,
        sales_bonus: 0,
        social_insurance: 0,
        health_insurance: 0,
        unemployment_insurance: 0,
        dependent_count: 0,
        advance_payment: 0,
        note: null,
      },
    ),
  );

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
        family_deduction_amount: payload.family_deduction_amount,
        dependent_deduction_amount: payload.dependent_deduction_amount,
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
        family_deduction_amount: payload.family_deduction_amount,
        dependent_deduction_amount: payload.dependent_deduction_amount,
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
      lunch_allowance: m.lunch_allowance,
      fuel_allowance: m.fuel_allowance,
      phone_allowance: m.phone_allowance,
      holiday_bonus: m.holiday_bonus,
      sales_bonus: m.sales_bonus,
      social_insurance: m.social_insurance,
      health_insurance: m.health_insurance,
      unemployment_insurance: m.unemployment_insurance,
      dependent_count: m.dependent_count,
      advance_payment: m.advance_payment,
      allowance: m.total_allowance,
      deduction: m.total_deduction,
      gross_salary: m.gross_salary,
      net_salary: m.net_salary,
      total_allowance: m.total_allowance,
      total_income: m.total_income,
      total_insurance: m.total_insurance,
      taxable_income: m.taxable_income,
      personal_income_tax: m.personal_income_tax,
      total_deduction: m.total_deduction,
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
  family_deduction_amount: number;
  dependent_deduction_amount: number;
  total_net_salary: number;
};

export type PayrollRunLineRow = {
  employee_id: string;
  lunch_allowance: number;
  fuel_allowance: number;
  phone_allowance: number;
  holiday_bonus: number;
  sales_bonus: number;
  social_insurance: number;
  health_insurance: number;
  unemployment_insurance: number;
  dependent_count: number;
  advance_payment: number;
  note: string | null;
};

export type PayrollRunSettingsRow = PayrollRunSettings & {
  note: string | null;
};

export async function listPayrollRuns(limit = 24): Promise<PayrollHistoryRow[]> {
  const supabase = createSupabaseAdmin();
  const { data: runs, error } = await supabase
    .from("payroll_runs")
    .select("id, year, month, created_at, standard_work_days, overtime_rate_per_hour, family_deduction_amount, dependent_deduction_amount")
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
    family_deduction_amount: Number(r["family_deduction_amount"] ?? 11_000_000),
    dependent_deduction_amount: Number(r["dependent_deduction_amount"] ?? 4_400_000),
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
    .select(`
      employee_id,
      lunch_allowance,
      fuel_allowance,
      phone_allowance,
      holiday_bonus,
      sales_bonus,
      social_insurance,
      health_insurance,
      unemployment_insurance,
      dependent_count,
      advance_payment,
      note
    `)
    .eq("run_id", run["id"] as string)
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    employee_id: r["employee_id"] as string,
    lunch_allowance: Number(r["lunch_allowance"] ?? 0),
    fuel_allowance: Number(r["fuel_allowance"] ?? 0),
    phone_allowance: Number(r["phone_allowance"] ?? 0),
    holiday_bonus: Number(r["holiday_bonus"] ?? 0),
    sales_bonus: Number(r["sales_bonus"] ?? 0),
    social_insurance: Number(r["social_insurance"] ?? 0),
    health_insurance: Number(r["health_insurance"] ?? 0),
    unemployment_insurance: Number(r["unemployment_insurance"] ?? 0),
    dependent_count: Number(r["dependent_count"] ?? 0),
    advance_payment: Number(r["advance_payment"] ?? 0),
    note: (r["note"] as string | null) ?? null,
  }));
}
export type PayrollRunDetailRow = PayrollComputedLine;

export async function getPayrollRunDetail(year: number, month: number): Promise<PayrollRunDetailRow[]> {
  const supabase = createSupabaseAdmin();
  const { data: run, error: runErr } = await supabase
    .from("payroll_runs")
    .select("id, standard_work_days, overtime_rate_per_hour, family_deduction_amount, dependent_deduction_amount")
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
      gross_salary,
      lunch_allowance,
      fuel_allowance,
      phone_allowance,
      holiday_bonus,
      sales_bonus,
      social_insurance,
      health_insurance,
      unemployment_insurance,
      dependent_count,
      advance_payment,
      note,
      employees!payroll_lines_employee_id_fkey(code, full_name, position, department)
    `)
    .eq("run_id", run.id as string)
    .limit(2000);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((r) => {
      const rawEmp = r.employees;
      const emp = (Array.isArray(rawEmp) ? rawEmp[0] : rawEmp) as { code: string; full_name: string; position: string | null; department: string | null } | null;
      return calculatePayrollLine(
        {
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
          gross_salary: Number(r.gross_salary ?? 0),
          note: (r.note as string | null) ?? null,
        },
        {
          standard_work_days: Number(run.standard_work_days ?? 26),
          overtime_rate_per_hour: Number(run.overtime_rate_per_hour ?? 30000),
          family_deduction_amount: Number(run.family_deduction_amount ?? 11_000_000),
          dependent_deduction_amount: Number(run.dependent_deduction_amount ?? 4_400_000),
        },
        {
          lunch_allowance: Number(r.lunch_allowance ?? 0),
          fuel_allowance: Number(r.fuel_allowance ?? 0),
          phone_allowance: Number(r.phone_allowance ?? 0),
          holiday_bonus: Number(r.holiday_bonus ?? 0),
          sales_bonus: Number(r.sales_bonus ?? 0),
          social_insurance: Number(r.social_insurance ?? 0),
          health_insurance: Number(r.health_insurance ?? 0),
          unemployment_insurance: Number(r.unemployment_insurance ?? 0),
          dependent_count: Number(r.dependent_count ?? 0),
          advance_payment: Number(r.advance_payment ?? 0),
          note: (r.note as string | null) ?? null,
        },
      );
    })
    .sort((a, b) => a.employee_code.localeCompare(b.employee_code, "vi"));
}

export async function getPayrollRunSettings(year: number, month: number): Promise<PayrollRunSettingsRow | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("payroll_runs")
    .select("standard_work_days, overtime_rate_per_hour, family_deduction_amount, dependent_deduction_amount, note")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    standard_work_days: Number(data.standard_work_days ?? 26),
    overtime_rate_per_hour: Number(data.overtime_rate_per_hour ?? 30000),
    family_deduction_amount: Number(data.family_deduction_amount ?? 11_000_000),
    dependent_deduction_amount: Number(data.dependent_deduction_amount ?? 4_400_000),
    note: (data.note as string | null) ?? null,
  };
}