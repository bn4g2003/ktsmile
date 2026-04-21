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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  calculatePayrollPreview,
  getPayrollRunLines,
  listPayrollRuns,
  upsertPayrollRun,
  type PayrollPreviewRow,
} from "@/lib/actions/payroll";
import { formatDate } from "@/lib/format/date";
import { PayrollExcelButton } from "@/components/shared/reports/payroll-excel-button";

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
  const [selectedEmployee, setSelectedEmployee] = React.useState<typeof rowsWithAdjust[0] | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

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
      const allowanceMap: Record<string, string> = {};
      const deductionMap: Record<string, string> = {};
      for (const r of existing) {
        allowanceMap[r.employee_id] = String(r.allowance);
        deductionMap[r.employee_id] = String(r.deduction);
      }
      setPreview(rows);
      setAllowanceByEmp(allowanceMap);
      setDeductionByEmp(deductionMap);
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
                <tr 
                  key={r.employee_id} 
                  className="cursor-pointer border-b border-[var(--border-ghost)] last:border-b-0 hover:bg-[var(--surface-muted)]"
                  onClick={() => { setSelectedEmployee(r); setDetailOpen(true); }}
                >
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
                  <td className="px-3 py-2 text-[var(--on-surface-muted)]">{formatDate(h.created_at)}</td>
                  <td className="px-3 py-2">
                    <PayrollExcelButton year={h.year} month={h.month} label="Excel" size="sm" variant="ghost" />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="ml-1"
                      onClick={async () => {
                        try {
                          const { getPayrollExcelPayload } = await import("@/lib/actions/payroll-excel");
                          const payload = await getPayrollExcelPayload(h.year, h.month);
                          if (payload.rows.length === 0) {
                            window.alert("Không có dữ liệu.");
                            return;
                          }
                          // Print all employees
                          let allHtml = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <meta charset="utf-8">
                              <title>In tất cả phiếu lương - ${h.month}/${h.year}</title>
                              <style>
                                body { font-family: Arial, sans-serif; margin: 20px; }
                                .page-break { page-break-after: always; }
                                .header { text-align: center; margin-bottom: 20px; }
                                .header h2 { margin: 0; font-size: 18px; }
                                .header p { margin: 5px 0 0; font-size: 14px; }
                                .info { margin-bottom: 15px; }
                                .info table { width: 100%; }
                                .info td { padding: 3px; }
                                .section-title { font-weight: bold; margin: 10px 0 5px; border-bottom: 1px solid #000; padding-bottom: 3px; font-size: 12px; }
                                .salary-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                                .salary-table th, .salary-table td { padding: 4px; border: 1px solid #000; text-align: left; }
                                .salary-table th { background: #f0f0f0; }
                                .text-right { text-align: right; }
                                .total-row { font-weight: bold; background: #f0f0f0; }
                              </style>
                            </head>
                            <body>
                          `;
                          for (const e of payload.rows) {
                            allHtml += `
                              <div class="page-break">
                                <div class="header">
                                  <h2>CÔNG TY TNHH KTSMILE</h2>
                                  <p><strong>PHIẾU LƯƠNG</strong></p>
                                  <p>Tháng ${h.month} năm ${h.year}</p>
                                </div>
                                <div class="info">
                                  <table>
                                    <tr>
                                      <td><strong>MÃ NV:</strong> ${e.employee_code}</td>
                                      <td><strong>HỌ VÀ TÊN:</strong> ${e.employee_name}</td>
                                    </tr>
                                    <tr>
                                      <td><strong>CHỨC VỤ:</strong> ${e.position || '—'}</td>
                                      <td><strong>BỘ PHẬN:</strong> ${e.department || '—'}</td>
                                    </tr>
                                  </table>
                                </div>
                                <div class="section-title">CHI TIẾT LƯƠNG:</div>
                                <table class="salary-table">
                                  <tr><td style="width:50px">01</td><td>Lương cơ bản</td><td class="text-right">${money(e.base_salary)}</td></tr>
                                  <tr><td>02</td><td>Số ngày công</td><td class="text-right">${e.worked_days}</td></tr>
                                  <tr><td>02A</td><td>Lương tính theo ngày công</td><td class="text-right">${money(e.gross_salary)}</td></tr>
                                </table>
                                <div class="section-title">PHỤ CẤP</div>
                                <table class="salary-table">
                                  <tr><td style="width:50px">03</td><td>Phụ cấp ăn trưa</td><td class="text-right">${money(e.allowance > 0 ? e.allowance : 0)}</td></tr>
                                  <tr><td>04</td><td>Phụ cấp xăng xe</td><td class="text-right">—</td></tr>
                                  <tr><td>05</td><td>Phụ cấp điện thoại</td><td class="text-right">—</td></tr>
                                  <tr><td>06</td><td>Thưởng lễ</td><td class="text-right">—</td></tr>
                                  <tr><td>07</td><td>Thưởng theo doanh số</td><td class="text-right">—</td></tr>
                                  <tr class="total-row"><td>B</td><td>Tổng thu nhập</td><td class="text-right">${money(e.gross_salary + e.allowance)}</td></tr>
                                </table>
                                <div class="section-title">CÁC KHOẢN KHẤU TRỪ</div>
                                <table class="salary-table">
                                  <tr><td style="width:50px">01</td><td>Bảo hiểm</td><td class="text-right">—</td></tr>
                                  <tr><td>02</td><td>Thuế TNCN</td><td class="text-right">—</td></tr>
                                  <tr><td>03</td><td>Khác</td><td class="text-right">${money(e.deduction)}</td></tr>
                                  <tr class="total-row"><td>C</td><td>Tổng khấu trừ</td><td class="text-right">${money(e.deduction)}</td></tr>
                                </table>
                                <table class="salary-table" style="margin-top:10px">
                                  <tr class="total-row">
                                    <td colspan="2" style="text-align:center">THỰC LĨNH (A + B - C)</td>
                                    <td class="text-right" style="font-size:14px">${money(e.net_salary)}</td>
                                  </tr>
                                </table>
                              </div>
                            `;
                          }
                          allHtml += "</body></html>";
                          const w = window.open("", "_blank");
                          if (w) {
                            w.document.write(allHtml);
                            w.document.close();
                            w.print();
                          }
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : "Lỗi");
                        }
                      }}
                    >
                      In tất cả
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chi tiết lương nhân viên</DialogTitle>
          </DialogHeader>
          {selectedEmployee ? (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-[var(--on-surface-muted)]">Mã NV:</span> {selectedEmployee.employee_code}</div>
                  <div><span className="text-[var(--on-surface-muted)]">Họ tên:</span> {selectedEmployee.employee_name}</div>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => {
                    const e = selectedEmployee;
                    const printContent = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <meta charset="utf-8">
                        <title>Phiếu lương - ${e.employee_code}</title>
                        <style>
                          body { font-family: Arial, sans-serif; margin: 40px; }
                          .header { text-align: center; margin-bottom: 30px; }
                          .header h2 { margin: 0; font-size: 18px; }
                          .header p { margin: 5px 0 0; font-size: 14px; }
                          .info { margin-bottom: 20px; }
                          .info table { width: 100%; }
                          .info td { padding: 5px; }
                          .section-title { font-weight: bold; margin: 15px 0 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
                          .salary-table { width: 100%; border-collapse: collapse; }
                          .salary-table th, .salary-table td { padding: 8px; border: 1px solid #000; text-align: left; }
                          .salary-table th { background: #f0f0f0; }
                          .text-right { text-align: right; }
                          .total-row { font-weight: bold; background: #f0f0f0; }
                          .footer { margin-top: 30px; text-align: right; font-size: 12px; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h2>CÔNG TY TNHH KTSMILE</h2>
                          <p><strong>PHIẾU LƯƠNG</strong></p>
                          <p>Tháng ${month} năm ${year}</p>
                        </div>
                        <div class="info">
                          <table>
                            <tr>
                              <td><strong>MÃ NV:</strong> ${e.employee_code}</td>
                              <td><strong>HỌ VÀ TÊN:</strong> ${e.employee_name}</td>
                            </tr>
                            <tr>
                              <td><strong>CHỨC VỤ:</strong> ${e.position || '—'}</td>
                              <td><strong>BỘ PHẬN:</strong> ${e.department || '—'}</td>
                            </tr>
                          </table>
                        </div>
                        <div class="section-title">CHI TIẾT LƯƠNG:</div>
                        <table class="salary-table">
                          <thead>
                            <tr>
                              <th style="width:50px">STT</th>
                              <th>HẠN MỤC</th>
                              <th style="width:120px" class="text-right">SỐ TIỀN</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>01</td>
                              <td>Lương cơ bản</td>
                              <td class="text-right">${money(e.base_salary)}</td>
                            </tr>
                            <tr>
                              <td>02</td>
                              <td>Số ngày công</td>
                              <td class="text-right">${e.worked_days}</td>
                            </tr>
                            <tr>
                              <td>02A</td>
                              <td>Lương tính theo ngày công</td>
                              <td class="text-right">${money(e.gross_salary)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div class="section-title">PHỤ CẤP</div>
                        <table class="salary-table">
                          <tbody>
                            <tr>
                              <td style="width:50px">03</td>
                              <td>Phụ cấp ăn trưa</td>
                              <td style="width:120px" class="text-right">${money(e.allowance > 0 ? e.allowance : 0)}</td>
                            </tr>
                            <tr>
                              <td>04</td>
                              <td>Phụ cấp xăng xe</td>
                              <td class="text-right">—</td>
                            </tr>
                            <tr>
                              <td>05</td>
                              <td>Phụ cấp điện thoại</td>
                              <td class="text-right">—</td>
                            </tr>
                            <tr>
                              <td>06</td>
                              <td>Thưởng lễ</td>
                              <td class="text-right">—</td>
                            </tr>
                            <tr>
                              <td>07</td>
                              <td>Thưởng theo doanh số</td>
                              <td class="text-right">—</td>
                            </tr>
                            <tr class="total-row">
                              <td>B</td>
                              <td>Tổng thu nhập</td>
                              <td class="text-right">${money(e.gross_salary + e.allowance)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div class="section-title">CÁC KHOẢN KHẤU TRỪ VÀO LƯƠNG</div>
                        <table class="salary-table">
                          <tbody>
                            <tr>
                              <td style="width:50px">01</td>
                              <td>Bảo hiểm</td>
                              <td style="width:120px" class="text-right">—</td>
                            </tr>
                            <tr>
                              <td>02</td>
                              <td>Thuế TNCN</td>
                              <td class="text-right">—</td>
                            </tr>
                            <tr>
                              <td>03</td>
                              <td>Khác</td>
                              <td class="text-right">${money(e.deduction)}</td>
                            </tr>
                            <tr class="total-row">
                              <td>C</td>
                              <td>Tổng khấu trừ</td>
                              <td class="text-right">${money(e.deduction)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <table class="salary-table" style="margin-top:15px">
                          <tr class="total-row">
                            <td colspan="2" style="text-align:center; font-size:16px">THỰC LĨNH (A + B - C)</td>
                            <td class="text-right" style="font-size:18px">${money(e.net_salary)}</td>
                          </tr>
                        </table>
                        <div class="footer">
                          <p>Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</p>
                          <p style="margin-top:40px">Người lập phiếu</p>
                        </div>
                      </body>
                      </html>
                    `;
                    const w = window.open("", "_blank");
                    if (w) {
                      w.document.write(printContent);
                      w.document.close();
                      w.print();
                    }
                  }}
                >
                  In phiếu lương
                </Button>
              </div>
              <div className="border-t pt-3">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="py-1 text-[var(--on-surface-muted)]">Lương cơ bản</td><td className="py-1 text-right">{money(selectedEmployee.base_salary)}</td></tr>
                    <tr className="border-b"><td className="py-1 text-[var(--on-surface-muted)]">Ngày công</td><td className="py-1 text-right">{selectedEmployee.worked_days}</td></tr>
                    <tr className="border-b"><td className="py-1 text-[var(--on-surface-muted)]">Nghỉ có lương</td><td className="py-1 text-right">{selectedEmployee.paid_leave_days}</td></tr>
                    <tr className="border-b"><td className="py-1 text-[var(--on-surface-muted)]">Nghỉ không lương</td><td className="py-1 text-right">{selectedEmployee.unpaid_leave_days}</td></tr>
                    <tr className="border-b"><td className="py-1 text-[var(--on-surface-muted)]">Giờ OT</td><td className="py-1 text-right">{selectedEmployee.overtime_hours}</td></tr>
                    <tr className="border-b"><td className="py-1 text-[var(--on-surface-muted)]">Lương gộp</td><td className="py-1 text-right">{money(selectedEmployee.gross_salary)}</td></tr>
                    <tr className="border-b"><td className="py-1 text-[var(--on-surface-muted)]">Phụ cấp</td><td className="py-1 text-right">{money(selectedEmployee.allowance)}</td></tr>
                    <tr className="border-b"><td className="py-1 text-[var(--on-surface-muted)]">Khấu trừ</td><td className="py-1 text-right">{money(selectedEmployee.deduction)}</td></tr>
                    <tr className="font-semibold"><td className="py-2">Thực lĩnh</td><td className="py-2 text-right text-lg">{money(selectedEmployee.net_salary)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
