"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  calculatePayrollPreview,
  listPayrollRuns,
  upsertPayrollRun,
  type PayrollPreviewRow,
} from "@/lib/actions/payroll";

function money(n: number) {
  return n.toLocaleString("vi-VN");
}

export function PayrollPage() {
  const now = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [standardDays, setStandardDays] = React.useState("26");
  const [otRate, setOtRate] = React.useState("30000");
  const [preview, setPreview] = React.useState<PayrollPreviewRow[]>([]);
  const [allowanceByEmp, setAllowanceByEmp] = React.useState<Record<string, string>>({});
  const [deductionByEmp, setDeductionByEmp] = React.useState<Record<string, string>>({});
  const [history, setHistory] = React.useState<
    {
      run_id: string;
      year: number;
      month: number;
      created_at: string;
      standard_work_days: number;
      overtime_rate_per_hour: number;
      total_net_salary: number;
    }[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const reloadHistory = React.useCallback(async () => {
    try {
      setHistory(await listPayrollRuns());
    } catch {
      setHistory([]);
    }
  }, []);

  React.useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  const runPreview = async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await calculatePayrollPreview(
        Number(year),
        Number(month),
        Number(standardDays),
        Number(otRate),
      );
      setPreview(rows);
      setAllowanceByEmp({});
      setDeductionByEmp({});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không tính được bảng lương");
    } finally {
      setLoading(false);
    }
  };

  const savePayroll = async () => {
    setSaving(true);
    setErr(null);
    try {
      await upsertPayrollRun({
        year: Number(year),
        month: Number(month),
        standard_work_days: Number(standardDays),
        overtime_rate_per_hour: Number(otRate),
        rows: preview.map((p) => ({
          employee_id: p.employee_id,
          allowance: Number(allowanceByEmp[p.employee_id] ?? 0),
          deduction: Number(deductionByEmp[p.employee_id] ?? 0),
          note: null,
        })),
      });
      await reloadHistory();
      alert("Đã chốt bảng lương tháng " + month + "/" + year);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không chốt được bảng lương");
    } finally {
      setSaving(false);
    }
  };

  const rowsWithAdjust = preview.map((p) => {
    const allowance = Number(allowanceByEmp[p.employee_id] ?? 0);
    const deduction = Number(deductionByEmp[p.employee_id] ?? 0);
    return {
      ...p,
      allowance,
      deduction,
      net_salary: p.gross_salary + allowance - deduction,
    };
  });

  const totalNet = rowsWithAdjust.reduce((sum, r) => sum + r.net_salary, 0);
  const years = React.useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(y - i));
  }, [now]);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h1 className="text-lg font-semibold">Tính lương nhân sự</h1>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
          Công thức: Lương gộp = Lương cơ bản × (Ngày công quy đổi / Công chuẩn) + OT × đơn giá OT.
        </p>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-5">
        <div className="grid gap-2">
          <Label htmlFor="pr-y">Năm</Label>
          <Select id="pr-y" value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pr-m">Tháng</Label>
          <Select id="pr-m" value={month} onChange={(e) => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pr-std">Công chuẩn</Label>
          <Input id="pr-std" type="number" min={1} step={0.5} value={standardDays} onChange={(e) => setStandardDays(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pr-ot">Đơn giá OT / giờ</Label>
          <Input id="pr-ot" type="number" min={0} step={1000} value={otRate} onChange={(e) => setOtRate(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" onClick={() => void runPreview()} disabled={loading}>
            {loading ? "Đang tính..." : "Tính lương"}
          </Button>
        </div>
      </Card>

      {err ? <p className="text-sm text-[#b91c1c]">{err}</p> : null}

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Bảng lương tạm tính</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm">
              Tổng thực lĩnh: <strong>{money(totalNet)} đ</strong>
            </p>
            <Button type="button" variant="primary" disabled={!preview.length || saving} onClick={() => void savePayroll()}>
              {saving ? "Đang chốt..." : "Chốt bảng lương tháng"}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
          <table className="w-full min-w-[72rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
                <th className="px-3 py-2">Mã NV</th>
                <th className="px-3 py-2">Nhân viên</th>
                <th className="px-3 py-2 text-right">Lương CB</th>
                <th className="px-3 py-2 text-right">Ngày công</th>
                <th className="px-3 py-2 text-right">Nghỉ phép</th>
                <th className="px-3 py-2 text-right">Nghỉ/Vắng</th>
                <th className="px-3 py-2 text-right">OT</th>
                <th className="px-3 py-2 text-right">Lương gộp</th>
                <th className="px-3 py-2 text-right">Phụ cấp</th>
                <th className="px-3 py-2 text-right">Khấu trừ</th>
                <th className="px-3 py-2 text-right">Thực lĩnh</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithAdjust.map((r) => (
                <tr key={r.employee_id} className="border-b border-[var(--border-ghost)] last:border-b-0">
                  <td className="px-3 py-2">{r.employee_code}</td>
                  <td className="px-3 py-2">{r.employee_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.base_salary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.worked_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.paid_leave_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.unpaid_leave_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.overtime_hours}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.gross_salary)}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={allowanceByEmp[r.employee_id] ?? "0"}
                      onChange={(e) =>
                        setAllowanceByEmp((prev) => ({ ...prev, [r.employee_id]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={deductionByEmp[r.employee_id] ?? "0"}
                      onChange={(e) =>
                        setDeductionByEmp((prev) => ({ ...prev, [r.employee_id]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(r.net_salary)}</td>
                </tr>
              ))}
              {rowsWithAdjust.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--on-surface-muted)]" colSpan={11}>
                    Bấm "Tính lương" để tạo bảng tạm tính.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Lịch sử chốt lương</h2>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
                <th className="px-3 py-2">Kỳ lương</th>
                <th className="px-3 py-2">Công chuẩn</th>
                <th className="px-3 py-2">Đơn giá OT/giờ</th>
                <th className="px-3 py-2 text-right">Tổng thực lĩnh</th>
                <th className="px-3 py-2">Thời điểm chốt</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.run_id} className="border-b border-[var(--border-ghost)] last:border-b-0">
                  <td className="px-3 py-2">
                    Tháng {h.month}/{h.year}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{h.standard_work_days}</td>
                  <td className="px-3 py-2 tabular-nums">{money(h.overtime_rate_per_hour)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(h.total_net_salary)}</td>
                  <td className="px-3 py-2 text-[var(--on-surface-muted)]">{h.created_at}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--on-surface-muted)]" colSpan={5}>
                    Chưa có kỳ lương nào được chốt.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
