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
  getPayrollAccessProfile,
  getPayrollRunDetail,
  getPayrollRunLines,
  getPayrollRunSettings,
  listPayrollRuns,
  upsertPayrollRun,
  type PayrollAccessProfile,
  type PayrollPreviewRow,
  type PayrollRunDetailRow,
} from "@/lib/actions/payroll";
import { formatDate } from "@/lib/format/date";
import { PayrollExcelButton } from "@/components/shared/reports/payroll-excel-button";
import {
  buildPayrollBatchPrintHtml,
  buildPayrollSlipHtml,
  buildPayrollSlipPrintOptsBatchMerged,
  buildPayrollSlipPrintOptsDraft,
  buildPayrollSlipPrintOptsSealed,
  PAYROLL_SLIP_DEFAULT_COMPANY_NAME,
} from "@/lib/reports/payroll-slip-html";
import {
  downloadPayrollBatchSlipPdfFromTemplate,
  downloadPayrollSlipPdfFromTemplate,
} from "@/lib/reports/payroll-pdf";
import { openPayrollPrintPreview } from "@/lib/reports/payroll-print-preview";
import {
  calculatePayrollLine,
  INSURANCE_DEFAULT_RATE_PERCENT,
  insuranceDeductionsFromBaseSalary,
  type PayrollLineInput,
  type PayrollRunSettings,
} from "@/lib/payroll/calc";

function money(n: number) {
  return n.toLocaleString("vi-VN");
}

const COMPANY_NAME = PAYROLL_SLIP_DEFAULT_COMPANY_NAME;
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

/** Nhập % (cho phép dấu phẩy thập phân kiểu Việt). */
function parsePercentInput(s: string): number {
  const t = s.replace(/%/g, "").trim().replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === "." || t === "-.") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function formatPercentDisplay(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "";
  const r = Math.round(pct * 1e8) / 1e8;
  return r.toLocaleString("vi-VN", { maximumFractionDigits: 8, useGrouping: false });
}

function insuranceAmountFromPercent(baseSalary: number, pct: number): number {
  const base = Math.max(0, Math.round(Number(baseSalary) || 0));
  return Math.round((base * Math.max(0, pct)) / 100);
}

function insurancePercentFromAmount(baseSalary: number, amount: number): number {
  const base = Math.max(0, Math.round(Number(baseSalary) || 0));
  if (base <= 0) return 0;
  return ((Math.max(0, Number(amount) || 0) / base) * 100);
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
    insurance_use_formula: true,
    dependent_count: 0,
    advance_payment: 0,
    note: null,
  };
}

/** Ba khoản BH hiện dùng để chỉnh (công thức % lương CB hoặc đã nhập tay). */
function insuranceTripletForEdit(cur: PayrollLineInput, baseSalary: number) {
  const auto = insuranceDeductionsFromBaseSalary(baseSalary);
  if (cur.insurance_use_formula !== false) {
    return {
      social_insurance: auto.social_insurance,
      health_insurance: auto.health_insurance,
      unemployment_insurance: auto.unemployment_insurance,
    };
  }
  return {
    social_insurance: Math.max(0, Math.round(Number(cur.social_insurance ?? 0))),
    health_insurance: Math.max(0, Math.round(Number(cur.health_insurance ?? 0))),
    unemployment_insurance: Math.max(0, Math.round(Number(cur.unemployment_insurance ?? 0))),
  };
}

const BH_EDIT_ROWS: Array<{
  key: "social_insurance" | "health_insurance" | "unemployment_insurance";
  label: string;
  defaultPct: number;
}> = [
  { key: "social_insurance", label: "BHXH", defaultPct: INSURANCE_DEFAULT_RATE_PERCENT.social },
  { key: "health_insurance", label: "BHYT", defaultPct: INSURANCE_DEFAULT_RATE_PERCENT.health },
  { key: "unemployment_insurance", label: "BHTN", defaultPct: INSURANCE_DEFAULT_RATE_PERCENT.unemployment },
];

function printPayrollDocument(html: string) {
  openPayrollPrintPreview(html);
}

function payrollBatchPdfFilename(month: number, year: number, draft: boolean) {
  const m = String(month).padStart(2, "0");
  return draft ? `Bang_luong_tam_T${m}_${year}.pdf` : `Bang_luong_T${m}_${year}.pdf`;
}

function payrollSlipPdfFilename(employeeCode: string, month: number, year: number) {
  const code = String(employeeCode).replace(/[^\w.\-]+/g, "_");
  const m = String(month).padStart(2, "0");
  return `Phieu_luong_${code}_T${m}_${year}.pdf`;
}

/** Tải PDF từ mẫu phiếu (`payroll-slip-html`); lỗi hiển thị cho người dùng. */
function runPayrollPdfDownload(task: () => Promise<void>): void {
  void task().catch((e) => window.alert(e instanceof Error ? e.message : "Không tải được PDF."));
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
  const [access, setAccess] = React.useState<PayrollAccessProfile | null>(null);
  const [selfYear, setSelfYear] = React.useState(String(now.getFullYear()));
  const [selfMonth, setSelfMonth] = React.useState(String(now.getMonth() + 1));
  const [selfRows, setSelfRows] = React.useState<PayrollRunDetailRow[]>([]);
  const [selfLoading, setSelfLoading] = React.useState(false);

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

  React.useEffect(() => {
    let cancelled = false;
    void getPayrollAccessProfile()
      .then((r) => {
        if (!cancelled) setAccess(r);
      })
      .catch(() => {
        if (!cancelled) setAccess(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          social_insurance: Number(r.social_insurance ?? 0),
          health_insurance: Number(r.health_insurance ?? 0),
          unemployment_insurance: Number(r.unemployment_insurance ?? 0),
          insurance_use_formula: false,
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

  const draftSlipPreviewSrcDoc = React.useMemo(() => {
    if (!selectedEmployee) return "";
    return buildPayrollSlipHtml(
      selectedEmployee,
      buildPayrollSlipPrintOptsDraft(Number(year), Number(month), COMPANY_NAME),
    );
  }, [selectedEmployee, year, month]);

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

  const loadSelfPayrollDetail = React.useCallback(async () => {
    setSelfLoading(true);
    setErr(null);
    try {
      const y = Number(selfYear);
      const m = Number(selfMonth);
      const selected = new Date(y, m - 1, 1);
      const current = new Date(now.getFullYear(), now.getMonth(), 1);
      if (!(selected < current)) {
        throw new Error("Chỉ được xem kỳ trước tháng hiện tại.");
      }
      const rows = await getPayrollRunDetail(y, m);
      setSelfRows(rows);
    } catch (e) {
      setSelfRows([]);
      setErr(e instanceof Error ? e.message : "Không tải được dữ liệu lương.");
    } finally {
      setSelfLoading(false);
    }
  }, [now, selfMonth, selfYear]);

  React.useEffect(() => {
    if (access?.can_manage_payroll) return;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setSelfYear(String(prev.getFullYear()));
    setSelfMonth(String(prev.getMonth() + 1));
  }, [access, now]);

  if (access && !access.can_manage_payroll) {
    const years = Array.from({ length: 8 }, (_, i) => String(now.getFullYear() - i));
    const totalNetSelf = selfRows.reduce((sum, r) => sum + r.net_salary, 0);
    const row = selfRows[0] ?? null;
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <h1 className="text-lg font-semibold">Phiếu lương của tôi</h1>
          <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
            Chỉ xem được kỳ trước tháng hiện tại. Sau khi tải dữ liệu có thể <strong>Xem trước / In</strong> hoặc{" "}
            <strong>Tải PDF</strong> phiếu.
          </p>
        </Card>
        <Card className="grid gap-4 p-5 sm:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="self-payroll-y">Năm</Label>
            <Select id="self-payroll-y" value={selfYear} onChange={(e) => setSelfYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="self-payroll-m">Tháng</Label>
            <Select id="self-payroll-m" value={selfMonth} onChange={(e) => setSelfMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => void loadSelfPayrollDetail()} disabled={selfLoading}>
              {selfLoading ? "Đang tải..." : "Xem chi tiết lương"}
            </Button>
          </div>
        </Card>
        {err ? <p className="text-sm text-[#b91c1c]">{err}</p> : null}
        <Card className="p-5">
          {row ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--on-surface-muted)]">
                Kỳ lương: Tháng {selfMonth}/{selfYear}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Nhân viên</div>
                  <div className="font-semibold">{row.employee_name}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Lương gộp</div>
                  <div className="font-semibold">{money(row.gross_salary)} đ</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3">
                  <div className="text-xs text-[var(--on-surface-muted)]">Thực lĩnh</div>
                  <div className="font-semibold">{money(totalNetSelf)} đ</div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[var(--radius-md)] border border-[var(--border-ghost)] p-3 text-sm">
                  <div>Ngày công: <strong>{row.worked_days}</strong></div>
                  <div>Nghỉ phép: <strong>{row.paid_leave_days}</strong></div>
                  <div>Nghỉ/vắng: <strong>{row.unpaid_leave_days}</strong></div>
                  <div>OT: <strong>{row.overtime_hours}</strong> giờ</div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border-ghost)] p-3 text-sm">
                  <div>Tổng phụ cấp: <strong>{money(row.total_allowance)} đ</strong></div>
                  <div>Tổng khấu trừ: <strong>{money(row.total_deduction)} đ</strong></div>
                  <div>Thuế TNCN: <strong>{money(row.personal_income_tax)} đ</strong></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[var(--border-ghost)] pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    printPayrollDocument(
                      buildPayrollSlipHtml(
                        row,
                        buildPayrollSlipPrintOptsSealed(Number(selfYear), Number(selfMonth), COMPANY_NAME),
                      ),
                    );
                  }}
                >
                  Xem trước / In
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    runPayrollPdfDownload(() =>
                      downloadPayrollSlipPdfFromTemplate(
                        row,
                        buildPayrollSlipPrintOptsSealed(Number(selfYear), Number(selfMonth), COMPANY_NAME),
                        payrollSlipPdfFilename(row.employee_code, Number(selfMonth), Number(selfYear)),
                      ),
                    )
                  }
                >
                  Tải PDF
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--on-surface-muted)]">
              Chọn kỳ và bấm “Xem chi tiết lương”.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h1 className="text-lg font-semibold">Tính lương nhân sự</h1>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
          Công thức: Lương gộp = Lương cơ bản × (Ngày công quy đổi / Công chuẩn) + OT × đơn giá OT.
        </p>
        {access?.can_view_all ? null : (
          <p className="mt-2 text-sm font-medium text-[var(--on-surface-muted)]">
            Bạn đang ở chế độ chỉ xem lương của chính mình.
          </p>
        )}
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
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Bảng lương tạm tính</h2>
            <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
              <strong>In</strong> = mở tab xem trước (có đường dẫn), rồi bấm «In ngay»;{" "}
              <strong>Tải PDF</strong> = tải file về (cùng mẫu{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1">payroll-slip-html.ts</code>).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm">
              Tổng thực lĩnh: <strong>{money(totalNet)} đ</strong>
            </p>
            {access?.can_manage_payroll ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!rowsWithAdjust.length}
                  onClick={() => {
                    printPayrollDocument(
                      buildPayrollBatchPrintHtml(
                        rowsWithAdjust,
                        buildPayrollSlipPrintOptsDraft(Number(year), Number(month), COMPANY_NAME),
                      ),
                    );
                  }}
                >
                  In hàng loạt
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!rowsWithAdjust.length}
                  onClick={() => {
                    runPayrollPdfDownload(() =>
                      downloadPayrollBatchSlipPdfFromTemplate(
                        rowsWithAdjust,
                        buildPayrollSlipPrintOptsDraft(Number(year), Number(month), COMPANY_NAME),
                        payrollBatchPdfFilename(Number(month), Number(year), true),
                      ),
                    );
                  }}
                >
                  Tải PDF
                </Button>
                <Button type="button" variant="primary" disabled={!preview.length || saving} onClick={() => void savePayroll()}>
                  {saving ? "Đang chốt..." : "Chốt bảng lương tháng"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
          <table className="w-full min-w-[78rem] border-collapse text-sm">
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
                {access?.can_manage_payroll ? (
                  <th className="px-3 py-2 text-center whitespace-nowrap">Phiếu</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rowsWithAdjust.map((r) => (
                <tr 
                  key={r.employee_id} 
                  className={
                    (access?.can_manage_payroll
                      ? "cursor-pointer hover:bg-[var(--surface-muted)] "
                      : "") + "border-b border-[var(--border-ghost)] last:border-b-0"
                  }
                  onClick={() => {
                    if (!access?.can_manage_payroll) return;
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
                  {access?.can_manage_payroll ? (
                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => {
                            printPayrollDocument(
                              buildPayrollSlipHtml(
                                r,
                                buildPayrollSlipPrintOptsDraft(Number(year), Number(month), COMPANY_NAME),
                              ),
                            );
                          }}
                        >
                          In
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => {
                            runPayrollPdfDownload(() =>
                              downloadPayrollSlipPdfFromTemplate(
                                r,
                                buildPayrollSlipPrintOptsDraft(Number(year), Number(month), COMPANY_NAME),
                                payrollSlipPdfFilename(r.employee_code, Number(month), Number(year)),
                              ),
                            );
                          }}
                        >
                          Tải PDF
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {rowsWithAdjust.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-[var(--on-surface-muted)]"
                    colSpan={access?.can_manage_payroll ? 12 : 11}
                  >
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
                <th className="px-3 py-2 whitespace-nowrap">Excel / phiếu</th>
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
                      title="Một bản in gộp phiếu của mọi nhân viên trong kỳ"
                      className="ml-2 shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_32%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--primary)_25%,transparent)]"
                      onClick={async () => {
                        try {
                          const { getPayrollExcelPayload } = await import("@/lib/actions/payroll-excel");
                          const payload = await getPayrollExcelPayload(h.year, h.month);
                          if (payload.rows.length === 0) {
                            window.alert("Không có dữ liệu.");
                            return;
                          }
                          printPayrollDocument(
                            buildPayrollBatchPrintHtml(
                              payload.rows,
                              buildPayrollSlipPrintOptsBatchMerged(h.year, h.month, COMPANY_NAME),
                            ),
                          );
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : "Lỗi");
                        }
                      }}
                    >
                      In chung
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-1"
                      title="Tải file PDF phiếu in chung về máy"
                      onClick={async () => {
                        try {
                          const { getPayrollExcelPayload } = await import("@/lib/actions/payroll-excel");
                          const payload = await getPayrollExcelPayload(h.year, h.month);
                          if (payload.rows.length === 0) {
                            window.alert("Không có dữ liệu.");
                            return;
                          }
                          await downloadPayrollBatchSlipPdfFromTemplate(
                            payload.rows,
                            buildPayrollSlipPrintOptsBatchMerged(h.year, h.month, COMPANY_NAME),
                            payrollBatchPdfFilename(h.month, h.year, false),
                          );
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : "Lỗi");
                        }
                      }}
                    >
                      Tải PDF
                    </Button>
                  </td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--on-surface-muted)]" colSpan={6}>
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
              Nhập phụ cấp, khấu trừ BH, tạm ứng và số người phụ thuộc; có thể khôi phục BH theo phần trăm lương cơ bản.
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
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-semibold">Khấu trừ</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 self-start sm:self-auto"
                      onClick={() =>
                        setAdjustmentsByEmp((prev) => ({
                          ...prev,
                          [selectedEmployee.employee_id]: {
                            ...(prev[selectedEmployee.employee_id] ?? emptyAdjustments()),
                            insurance_use_formula: true,
                            social_insurance: 0,
                            health_insurance: 0,
                            unemployment_insurance: 0,
                          } as PayrollLineInput,
                        }))
                      }
                    >
                      BH theo % lương CB
                    </Button>
                  </div>
                  <p className="mb-3 text-xs text-[var(--on-surface-muted)]">
                    Sửa <strong>%</strong> hoặc <strong>số tiền</strong> — hai ô đồng bộ theo lương cơ bản; mặc định BHXH{" "}
                    {formatPercentDisplay(INSURANCE_DEFAULT_RATE_PERCENT.social)}%, BHYT{" "}
                    {formatPercentDisplay(INSURANCE_DEFAULT_RATE_PERCENT.health)}%, BHTN{" "}
                    {formatPercentDisplay(INSURANCE_DEFAULT_RATE_PERCENT.unemployment)}%.
                  </p>
                  <div className="mb-3 space-y-3">
                    {BH_EDIT_ROWS.map(({ key, label, defaultPct }) => {
                      const empId = selectedEmployee.employee_id;
                      const base = selectedEmployee.base_salary;
                      const adj = adjustmentsByEmp[empId] ?? emptyAdjustments();
                      const ins = insuranceTripletForEdit(adj, base);
                      const amt = ins[key];
                      const useFormula = adj.insurance_use_formula !== false;
                      const pctValue = useFormula
                        ? formatPercentDisplay(defaultPct)
                        : formatPercentDisplay(insurancePercentFromAmount(base, amt));
                      return (
                        <div
                          key={key}
                          className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border-ghost)] p-3 sm:grid-cols-[minmax(4.5rem,auto)_minmax(5.5rem,7rem)_1fr] sm:items-end"
                        >
                          <Label className="text-xs font-medium leading-snug sm:pb-2 sm:pt-0.5">{label}</Label>
                          <div className="grid gap-1">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-faint)]">
                              % trên lương CB
                            </span>
                            <Input
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder={formatPercentDisplay(defaultPct)}
                              value={pctValue}
                              onChange={(e) => {
                                const pct = parsePercentInput(e.target.value);
                                const newAmt = insuranceAmountFromPercent(base, pct);
                                setAdjustmentsByEmp((prev) => {
                                  const cur = prev[empId] ?? emptyAdjustments();
                                  const t = insuranceTripletForEdit(cur, base);
                                  return {
                                    ...prev,
                                    [empId]: {
                                      ...cur,
                                      insurance_use_formula: false,
                                      social_insurance: key === "social_insurance" ? newAmt : t.social_insurance,
                                      health_insurance: key === "health_insurance" ? newAmt : t.health_insurance,
                                      unemployment_insurance:
                                        key === "unemployment_insurance" ? newAmt : t.unemployment_insurance,
                                    } as PayrollLineInput,
                                  };
                                });
                              }}
                            />
                          </div>
                          <div className="grid gap-1">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-faint)]">
                              Số tiền (đ)
                            </span>
                            <Input
                              inputMode="numeric"
                              autoComplete="off"
                              value={formatVnMoneyField(amt)}
                              onChange={(e) => {
                                const v = parseVnMoneyDigits(e.target.value);
                                setAdjustmentsByEmp((prev) => {
                                  const cur = prev[empId] ?? emptyAdjustments();
                                  const t = insuranceTripletForEdit(cur, base);
                                  return {
                                    ...prev,
                                    [empId]: {
                                      ...cur,
                                      insurance_use_formula: false,
                                      social_insurance: key === "social_insurance" ? v : t.social_insurance,
                                      health_insurance: key === "health_insurance" ? v : t.health_insurance,
                                      unemployment_insurance:
                                        key === "unemployment_insurance" ? v : t.unemployment_insurance,
                                    } as PayrollLineInput,
                                  };
                                });
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
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
              <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-ghost)] bg-[var(--surface-muted)]/25 shadow-[inset_0_0_0_1px_var(--border-ghost)]">
                <div className="border-b border-[var(--border-ghost)] px-3 py-2 text-xs font-medium text-[var(--on-surface-muted)]">
                  Xem trước trong trang — cùng mẫu <strong>In</strong> (tab xem trước) / <strong>Tải PDF</strong>
                </div>
                <iframe
                  title="Xem trước phiếu lương"
                  className="h-[min(70vh,840px)] w-full min-h-[420px] border-0 bg-white"
                  srcDoc={draftSlipPreviewSrcDoc}
                  sandbox="allow-same-origin"
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    printPayrollDocument(
                      buildPayrollSlipHtml(
                        selectedEmployee,
                        buildPayrollSlipPrintOptsDraft(Number(year), Number(month), COMPANY_NAME),
                      ),
                    );
                  }}
                >
                  In phiếu lương
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    runPayrollPdfDownload(() =>
                      downloadPayrollSlipPdfFromTemplate(
                        selectedEmployee,
                        buildPayrollSlipPrintOptsDraft(Number(year), Number(month), COMPANY_NAME),
                        payrollSlipPdfFilename(selectedEmployee.employee_code, Number(month), Number(year)),
                      ),
                    );
                  }}
                >
                  Tải PDF
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
        <DialogContent size="2xl" className="max-h-[96vh] w-[min(99vw,96rem)] p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">
              {selectedHistoryRun ? `Bảng lương đã chốt - Tháng ${selectedHistoryRun.month}/${selectedHistoryRun.year}` : "Bảng lương đã chốt"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Bảng tổng hợp các dòng lương đã chốt cho kỳ được chọn, có thể cuộn ngang nếu nhiều cột.
            </DialogDescription>
          </DialogHeader>
          {historyDetailLoading ? (
            <p className="py-6 text-sm text-[var(--on-surface-muted)]">Đang tải bảng lương...</p>
          ) : selectedHistoryRows.length ? (
            <div className="space-y-4 py-2">
              <p className="text-base text-[var(--on-surface-muted)]">
                Kỳ lương: Tháng {selectedHistoryRun?.month}/{selectedHistoryRun?.year}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="grid flex-1 grid-cols-2 gap-3 text-base sm:grid-cols-5">
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--on-surface-muted)]">Tổng thực lĩnh</div>
                  <div className="text-lg font-semibold tabular-nums">{money(selectedHistoryRun?.total_net_salary ?? 0)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--on-surface-muted)]">Công chuẩn</div>
                  <div className="text-lg font-semibold">{selectedHistoryRun?.standard_work_days ?? "—"}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--on-surface-muted)]">Đơn giá OT</div>
                  <div className="text-lg font-semibold tabular-nums">{money(selectedHistoryRun?.overtime_rate_per_hour ?? 0)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--on-surface-muted)]">Giảm trừ gia cảnh</div>
                  <div className="text-lg font-semibold tabular-nums">{money(selectedHistoryRun?.family_deduction_amount ?? 0)}</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-4">
                  <div className="text-sm text-[var(--on-surface-muted)]">Giảm trừ NPT</div>
                  <div className="text-lg font-semibold tabular-nums">{money(selectedHistoryRun?.dependent_deduction_amount ?? 0)}</div>
                </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <p className="max-w-[18rem] text-right text-[11px] text-[var(--on-surface-muted)]">
                    In chung hoặc Tải PDF — cùng mẫu phiếu; In mở tab xem trước, sau đó «In ngay» (có thể «Lưu PDF»).
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!selectedHistoryRows.length}
                      onClick={() => {
                        if (!selectedHistoryRun) return;
                        printPayrollDocument(
                          buildPayrollBatchPrintHtml(
                            selectedHistoryRows,
                            buildPayrollSlipPrintOptsBatchMerged(
                              selectedHistoryRun.year,
                              selectedHistoryRun.month,
                              COMPANY_NAME,
                            ),
                          ),
                        );
                      }}
                    >
                      In chung
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!selectedHistoryRows.length}
                      onClick={() => {
                        if (!selectedHistoryRun) return;
                        runPayrollPdfDownload(() =>
                          downloadPayrollBatchSlipPdfFromTemplate(
                            selectedHistoryRows,
                            buildPayrollSlipPrintOptsBatchMerged(
                              selectedHistoryRun.year,
                              selectedHistoryRun.month,
                              COMPANY_NAME,
                            ),
                            payrollBatchPdfFilename(selectedHistoryRun.month, selectedHistoryRun.year, false),
                          ),
                        );
                      }}
                    >
                      Tải PDF
                    </Button>
                  </div>
                </div>
              </div>
              <div className="max-h-[min(calc(96vh-11rem),56rem)] overflow-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
                <table className="w-full min-w-[76rem] border-collapse text-[15px] leading-snug">
                  <thead>
                    <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-xs font-bold uppercase tracking-wide text-[var(--on-surface-faint)] sm:text-[13px]">
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5">Mã NV</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5">Nhân viên</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">Lương CB</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">Ngày công</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">Nghỉ phép</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">Nghỉ/Vắng</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">OT</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">Lương gộp</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">Phụ cấp</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">Khấu trừ</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-right">Thực lĩnh</th>
                      <th className="sticky top-0 z-[1] bg-[var(--surface-muted)] px-3 py-2.5 text-center whitespace-nowrap">
                        Phiếu
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHistoryRows.map((r) => (
                      <tr key={r.employee_id} className="border-b border-[var(--border-ghost)] last:border-b-0">
                        <td className="px-3 py-2.5">{r.employee_code}</td>
                        <td className="px-3 py-2.5">{r.employee_name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{money(r.base_salary)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.worked_days}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.paid_leave_days}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.unpaid_leave_days}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.overtime_hours}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{money(r.gross_salary)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{money(r.total_allowance)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{money(r.total_deduction)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(r.net_salary)}</td>
                        <td className="px-2 py-2.5 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                if (!selectedHistoryRun) return;
                                printPayrollDocument(
                                  buildPayrollSlipHtml(
                                    r,
                                    buildPayrollSlipPrintOptsSealed(
                                      selectedHistoryRun.year,
                                      selectedHistoryRun.month,
                                      COMPANY_NAME,
                                    ),
                                  ),
                                );
                              }}
                            >
                              In
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                if (!selectedHistoryRun) return;
                                runPayrollPdfDownload(() =>
                                  downloadPayrollSlipPdfFromTemplate(
                                    r,
                                    buildPayrollSlipPrintOptsSealed(
                                      selectedHistoryRun.year,
                                      selectedHistoryRun.month,
                                      COMPANY_NAME,
                                    ),
                                    payrollSlipPdfFilename(
                                      r.employee_code,
                                      selectedHistoryRun.month,
                                      selectedHistoryRun.year,
                                    ),
                                  ),
                                );
                              }}
                            >
                              Tải PDF
                            </Button>
                          </div>
                        </td>
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
