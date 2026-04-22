"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  calculatePayrollPreview,
  getPayrollRunDetail,
  getPayrollRunLines,
  getPayrollRunSettings,
  listPayrollRuns,
  upsertPayrollRun,
  type PayrollPreviewRow,
  type PayrollRunDetailRow,
} from "@/lib/actions/payroll";
import { formatDate } from "@/lib/format/date";
import { PayrollExcelButton } from "@/components/shared/reports/payroll-excel-button";
import {
  buildPayrollBatchPrintHtml,
  buildPayrollSlipHtml,
} from "@/lib/reports/payroll-slip-html";
import {
  openBlankPrintTab,
  writeAndPrintToWindow,
} from "@/lib/reports/print-html";
import {
  calculatePayrollLine,
  type PayrollLineInput,
  type PayrollRunSettings,
} from "@/lib/payroll/calc";

function money(n: number) {
  return n.toLocaleString("vi-VN");
}

const COMPANY_NAME = "CÔNG TY TNHH KTSMILE";
const DEFAULT_FAMILY_DEDUCTION = 11_000_000;
const DEFAULT_DEPENDENT_DEDUCTION = 4_400_000;

/** Chuỗi nhập có dấu chấm/ngăn cách — chỉ lấy chữ số. */
function parseVnMoneyDigits(s: string): number {
  const digits = s.replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function formatVnMoneyField(n: number): string {
  const rounded = Math.max(0, Math.round(Number(n) || 0));
  if (!rounded) return "";
  return rounded.toLocaleString("vi-VN");
}

function toMoneyInput(value: string) {
  return parseVnMoneyDigits(value);
}

function emptyAdjustments(): PayrollLineInput {
  return {
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
  };
}

function printPayrollHtml(html: string) {
  const w = openBlankPrintTab();
  if (!w) {
    window.alert(
      "Không mở được cửa sổ in. Trình duyệt đã chặn popup — hãy cho phép popup cho trang này rồi thử lại.",
    );
    return;
  }
  writeAndPrintToWindow(w, html);
}

export function PayrollPage() {
  const now = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [standardDays, setStandardDays] = React.useState("26");
  const [otRate, setOtRate] = React.useState("30000");
  const [familyDeductionAmount, setFamilyDeductionAmount] = React.useState(() =>
    formatVnMoneyField(DEFAULT_FAMILY_DEDUCTION),
  );
  const [dependentDeductionAmount, setDependentDeductionAmount] = React.useState(() =>
    formatVnMoneyField(DEFAULT_DEPENDENT_DEDUCTION),
  );
  const [preview, setPreview] = React.useState<PayrollPreviewRow[]>([]);
  const [adjustmentsByEmp, setAdjustmentsByEmp] = React.useState<Record<string, PayrollLineInput>>({});
  const [history, setHistory] = React.useState<
    {
      run_id: string;
      year: number;
      month: number;
      created_at: string;
      standard_work_days: number;
      overtime_rate_per_hour: number;
      family_deduction_amount: number;
      dependent_deduction_amount: number;
      total_net_salary: number;
    }[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [historyDetailOpen, setHistoryDetailOpen] = React.useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = React.useState(false);
  const [selectedHistoryRun, setSelectedHistoryRun] = React.useState<(typeof history)[0] | null>(null);
  const [selectedHistoryRows, setSelectedHistoryRows] = React.useState<PayrollRunDetailRow[]>([]);

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
      const existing = await getPayrollRunLines(Number(year), Number(month));
      const settings = await getPayrollRunSettings(Number(year), Number(month));
      const adjustmentMap: Record<string, PayrollLineInput> = {};
      for (const r of existing) {
        adjustmentMap[r.employee_id] = {
          lunch_allowance: Number(r.lunch_allowance ?? 0),
          fuel_allowance: Number(r.fuel_allowance ?? 0),
          phone_allowance: Number(r.phone_allowance ?? 0),
          holiday_bonus: Number(r.holiday_bonus ?? 0),
          sales_bonus: Number(r.sales_bonus ?? 0),
          social_insurance: 0,
          health_insurance: 0,
          unemployment_insurance: 0,
          dependent_count: Number(r.dependent_count ?? 0),
          advance_payment: Number(r.advance_payment ?? 0),
          note: r.note,
        };
      }
      setPreview(rows);
      setAdjustmentsByEmp(adjustmentMap);
      setFamilyDeductionAmount(formatVnMoneyField(settings?.family_deduction_amount ?? DEFAULT_FAMILY_DEDUCTION));
      setDependentDeductionAmount(formatVnMoneyField(settings?.dependent_deduction_amount ?? DEFAULT_DEPENDENT_DEDUCTION));
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
      const payrollSettings: PayrollRunSettings = {
        standard_work_days: Number(standardDays),
        overtime_rate_per_hour: Number(otRate),
        family_deduction_amount: toMoneyInput(familyDeductionAmount),
        dependent_deduction_amount: toMoneyInput(dependentDeductionAmount),
      };
      await upsertPayrollRun({
        year: Number(year),
        month: Number(month),
        standard_work_days: Number(standardDays),
        overtime_rate_per_hour: Number(otRate),
        family_deduction_amount: payrollSettings.family_deduction_amount,
        dependent_deduction_amount: payrollSettings.dependent_deduction_amount,
        rows: preview.map((p) => ({
          employee_id: p.employee_id,
          ...(adjustmentsByEmp[p.employee_id] ?? emptyAdjustments()),
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
    const computed = calculatePayrollLine(
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
      },
      {
        standard_work_days: Number(standardDays),
        overtime_rate_per_hour: Number(otRate),
        family_deduction_amount: toMoneyInput(familyDeductionAmount),
        dependent_deduction_amount: toMoneyInput(dependentDeductionAmount),
      },
      adjustmentsByEmp[p.employee_id] ?? emptyAdjustments(),
    );
    return computed;
  });

  const totalNet = rowsWithAdjust.reduce((sum, r) => sum + r.net_salary, 0);
  const years = React.useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(y - i));
  }, [now]);

  const selectedEmployee = React.useMemo(
    () => rowsWithAdjust.find((r) => r.employee_id === selectedEmployeeId) ?? null,
    [rowsWithAdjust, selectedEmployeeId],
  );

  const openHistoryDetail = React.useCallback(async (run: (typeof history)[0]) => {
    setSelectedHistoryRun(run);
    setHistoryDetailOpen(true);
    setHistoryDetailLoading(true);
    try {
      const rows = await getPayrollRunDetail(run.year, run.month);
      setSelectedHistoryRows(rows);
    } catch (e) {
      setSelectedHistoryRows([]);
      setErr(e instanceof Error ? e.message : "Không mở được bảng lương đã chốt");
    } finally {
      setHistoryDetailLoading(false);
    }
  }, []);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h1 className="text-lg font-semibold">Tính lương nhân sự</h1>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
          Công thức: Lương gộp = Lương cơ bản × (Ngày công quy đổi / Công chuẩn) + OT × đơn giá OT.
        </p>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-7">
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
        <div className="grid gap-2">
          <Label htmlFor="pr-fam">Giảm trừ gia cảnh / tháng</Label>
          <Input
            id="pr-fam"
            inputMode="numeric"
            autoComplete="off"
            placeholder="VD: 11.000.000"
            value={familyDeductionAmount}
            onChange={(e) => setFamilyDeductionAmount(formatVnMoneyField(parseVnMoneyDigits(e.target.value)))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pr-dep">Giảm trừ người phụ thuộc / người</Label>
          <Input
            id="pr-dep"
            inputMode="numeric"
            autoComplete="off"
            placeholder="VD: 4.400.000"
            value={dependentDeductionAmount}
            onChange={(e) => setDependentDeductionAmount(formatVnMoneyField(parseVnMoneyDigits(e.target.value)))}
          />
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
                <tr 
                  key={r.employee_id} 
                  className="cursor-pointer border-b border-[var(--border-ghost)] last:border-b-0 hover:bg-[var(--surface-muted)]"
                  onClick={() => {
                    setSelectedEmployeeId(r.employee_id);
                    setDetailOpen(true);
                  }}
                >
                  <td className="px-3 py-2">{r.employee_code}</td>
                  <td className="px-3 py-2">{r.employee_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.base_salary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.worked_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.paid_leave_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.unpaid_leave_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.overtime_hours}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.gross_salary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.total_allowance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.total_deduction)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(r.net_salary)}</td>
                </tr>
              ))}
              {rowsWithAdjust.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--on-surface-muted)]" colSpan={11}>
                    Bấm &quot;Tính lương&quot; để tạo bảng tạm tính.
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
                <tr
                  key={h.run_id}
                  className="cursor-pointer border-b border-[var(--border-ghost)] last:border-b-0 hover:bg-[var(--surface-muted)]"
                  onClick={() => void openHistoryDetail(h)}
                >
                  <td className="px-3 py-2">
                    Tháng {h.month}/{h.year}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{h.standard_work_days}</td>
                  <td className="px-3 py-2 tabular-nums">{money(h.overtime_rate_per_hour)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(h.total_net_salary)}</td>
                  <td className="px-3 py-2 text-[var(--on-surface-muted)]">{formatDate(h.created_at)}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <PayrollExcelButton year={h.year} month={h.month} label="Excel" size="sm" variant="ghost" />
                    <Button
                      variant="primary"
                      className="ml-2 shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_32%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--primary)_25%,transparent)]"
                      onClick={async () => {
                        try {
                          const { getPayrollExcelPayload } = await import("@/lib/actions/payroll-excel");
                          const payload = await getPayrollExcelPayload(h.year, h.month);
                          if (payload.rows.length === 0) {
                            window.alert("Không có dữ liệu.");
                            return;
                          }
                          printPayrollHtml(
                            buildPayrollBatchPrintHtml(payload.rows, {
                              year: h.year,
                              month: h.month,
                              companyName: COMPANY_NAME,
                              title: "PHIẾU LƯƠNG",
                            }),
                          );
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : "Lỗi");
                        }
                      }}
                    >
                      In hàng loạt
                    </Button>
                  </td>
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
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent size="2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết lương nhân viên</DialogTitle>
            <DialogDescription className="sr-only">
              Nhập phụ cấp, tạm ứng và số người phụ thuộc; bảo hiểm tự tính theo phần trăm lương cơ bản.
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Mã NV</div>
                  <div className="font-semibold">{selectedEmployee.employee_code}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Họ tên</div>
                  <div className="font-semibold">{selectedEmployee.employee_name}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Chức vụ</div>
                  <div className="font-semibold">{selectedEmployee.position ?? "—"}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Bộ phận</div>
                  <div className="font-semibold">{selectedEmployee.department ?? "—"}</div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[var(--radius-md)] border border-[var(--border-ghost)] p-4">
                  <h3 className="mb-3 text-sm font-semibold">Phụ cấp</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["lunch_allowance", "Phụ cấp ăn trưa"],
                      ["fuel_allowance", "Phụ cấp xăng/xe"],
                      ["phone_allowance", "Phụ cấp điện thoại"],
                      ["holiday_bonus", "Thưởng lễ"],
                      ["sales_bonus", "Thưởng theo doanh số"],
                    ].map(([key, label]) => {
                      const adj = adjustmentsByEmp[selectedEmployee.employee_id] ?? emptyAdjustments();
                      const num = Number(adj[key as keyof PayrollLineInput] ?? 0);
                      return (
                        <div key={key} className="grid gap-1">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            inputMode="numeric"
                            autoComplete="off"
                            value={formatVnMoneyField(num)}
                            onChange={(e) =>
                              setAdjustmentsByEmp((prev) => ({
                                ...prev,
                                [selectedEmployee.employee_id]: {
                                  ...(prev[selectedEmployee.employee_id] ?? emptyAdjustments()),
                                  [key]: parseVnMoneyDigits(e.target.value),
                                } as PayrollLineInput,
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border-ghost)] p-4">
                  <h3 className="mb-3 text-sm font-semibold">Cấu trừ</h3>
                  <div className="mb-3 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--on-surface-faint)]">
                      Bảo hiểm (tự tính theo % lương CB)
                    </p>
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <span className="text-[var(--on-surface-muted)]">BHXH 8%</span>
                        <div className="font-semibold tabular-nums">{money(selectedEmployee.social_insurance)} đ</div>
                      </div>
                      <div>
                        <span className="text-[var(--on-surface-muted)]">BHYT 1,5%</span>
                        <div className="font-semibold tabular-nums">{money(selectedEmployee.health_insurance)} đ</div>
                      </div>
                      <div>
                        <span className="text-[var(--on-surface-muted)]">BHTN 1%</span>
                        <div className="font-semibold tabular-nums">{money(selectedEmployee.unemployment_insurance)} đ</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(() => {
                      const adj = adjustmentsByEmp[selectedEmployee.employee_id] ?? emptyAdjustments();
                      const advance = Number(adj.advance_payment ?? 0);
                      return (
                        <div className="grid gap-1">
                          <Label className="text-xs">Tạm ứng</Label>
                          <Input
                            inputMode="numeric"
                            autoComplete="off"
                            value={formatVnMoneyField(advance)}
                            onChange={(e) =>
                              setAdjustmentsByEmp((prev) => ({
                                ...prev,
                                [selectedEmployee.employee_id]: {
                                  ...(prev[selectedEmployee.employee_id] ?? emptyAdjustments()),
                                  advance_payment: parseVnMoneyDigits(e.target.value),
                                } as PayrollLineInput,
                              }))
                            }
                          />
                        </div>
                      );
                    })()}
                    <div className="grid gap-1">
                      <Label className="text-xs">Người phụ thuộc</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={Number((adjustmentsByEmp[selectedEmployee.employee_id] ?? emptyAdjustments()).dependent_count ?? 0)}
                        onChange={(e) =>
                          setAdjustmentsByEmp((prev) => ({
                            ...prev,
                            [selectedEmployee.employee_id]: {
                              ...(prev[selectedEmployee.employee_id] ?? emptyAdjustments()),
                              dependent_count: Math.max(0, Math.floor(Number(e.target.value || 0))),
                            } as PayrollLineInput,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs">Ghi chú</Label>
                      <Input
                        value={(adjustmentsByEmp[selectedEmployee.employee_id] ?? emptyAdjustments()).note ?? ""}
                        onChange={(e) =>
                          setAdjustmentsByEmp((prev) => ({
                            ...prev,
                            [selectedEmployee.employee_id]: {
                              ...(prev[selectedEmployee.employee_id] ?? emptyAdjustments()),
                              note: e.target.value,
                            } as PayrollLineInput,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Tổng phụ cấp</div>
                  <div className="font-semibold">{money(selectedEmployee.total_allowance)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Thu nhập chịu thuế</div>
                  <div className="font-semibold">{money(selectedEmployee.taxable_income)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Thuế TNCN</div>
                  <div className="font-semibold">{money(selectedEmployee.personal_income_tax)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Thực lĩnh</div>
                  <div className="font-semibold">{money(selectedEmployee.net_salary)}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    printPayrollHtml(
                      buildPayrollSlipHtml(selectedEmployee, {
                        year: Number(year),
                        month: Number(month),
                        companyName: COMPANY_NAME,
                        title: "PHIẾU LƯƠNG",
                      }),
                    );
                  }}
                >
                  In phiếu lương
                </Button>
                <Button variant="primary" onClick={() => setDetailOpen(false)}>
                  Xong
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={historyDetailOpen} onOpenChange={setHistoryDetailOpen}>
        <DialogContent size="2xl" className="max-h-[min(96vh,52rem)]">
          <DialogHeader>
            <DialogTitle>
              {selectedHistoryRun ? `Bảng lương đã chốt - Tháng ${selectedHistoryRun.month}/${selectedHistoryRun.year}` : "Bảng lương đã chốt"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Bảng tổng hợp các dòng lương đã chốt cho kỳ được chọn, có thể cuộn ngang nếu nhiều cột.
            </DialogDescription>
          </DialogHeader>
          {historyDetailLoading ? (
            <p className="py-6 text-sm text-[var(--on-surface-muted)]">Đang tải bảng lương...</p>
          ) : selectedHistoryRows.length ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-[var(--on-surface-muted)]">
                Kỳ lương: Tháng {selectedHistoryRun?.month}/{selectedHistoryRun?.year}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-[var(--on-surface-muted)]">Tổng thực lĩnh</div>
                  <div className="font-semibold">{money(selectedHistoryRun?.total_net_salary ?? 0)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-[var(--on-surface-muted)]">Công chuẩn</div>
                  <div className="font-semibold">{selectedHistoryRun?.standard_work_days ?? "—"}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-[var(--on-surface-muted)]">Đơn giá OT</div>
                  <div className="font-semibold">{money(selectedHistoryRun?.overtime_rate_per_hour ?? 0)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-[var(--on-surface-muted)]">Giảm trừ gia cảnh</div>
                  <div className="font-semibold">{money(selectedHistoryRun?.family_deduction_amount ?? 0)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-[var(--on-surface-muted)]">Giảm trừ NPT</div>
                  <div className="font-semibold">{money(selectedHistoryRun?.dependent_deduction_amount ?? 0)}</div>
                </div>
              </div>
              <div className="max-h-[min(70vh,34rem)] overflow-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
                <table className="w-full min-w-[72rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2">Mã NV</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2">Nhân viên</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">Lương CB</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">Ngày công</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">Nghỉ phép</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">Nghỉ/Vắng</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">OT</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">Lương gộp</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">Phụ cấp</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">Khấu trừ</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2 text-right">Thực lĩnh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHistoryRows.map((r) => (
                      <tr key={r.employee_id} className="border-b border-[var(--border-ghost)] last:border-b-0">
                        <td className="px-3 py-2">{r.employee_code}</td>
                        <td className="px-3 py-2">{r.employee_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.base_salary)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.worked_days}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.paid_leave_days}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.unpaid_leave_days}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.overtime_hours}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.gross_salary)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.total_allowance)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.total_deduction)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(r.net_salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="py-6 text-sm text-[var(--on-surface-muted)]">
              Chưa có dữ liệu chốt lương cho kỳ này.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
