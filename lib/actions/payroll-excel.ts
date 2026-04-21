"use server";

import { getPayrollRunDetail } from "@/lib/actions/payroll";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type PayrollExcelPayload = {
  year: number;
  month: number;
  standardWorkDays: number;
  overtimeRatePerHour: number;
  rows: Awaited<ReturnType<typeof getPayrollRunDetail>>;
  companyName?: string;
};

export async function getPayrollExcelPayload(year: number, month: number): Promise<PayrollExcelPayload> {
  const rows = await getPayrollRunDetail(year, month);
  
  const supabase = createSupabaseAdmin();
  const { data: run } = await supabase
    .from("payroll_runs")
    .select("standard_work_days, overtime_rate_per_hour")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  
  return {
    year,
    month,
    standardWorkDays: Number(run?.standard_work_days ?? 26),
    overtimeRatePerHour: Number(run?.overtime_rate_per_hour ?? 30000),
    rows,
  };
}