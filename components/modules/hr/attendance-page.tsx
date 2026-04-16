"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  deleteAttendance,
  listAttendanceByMonth,
  type AttendanceStatus,
  upsertAttendance,
} from "@/lib/actions/attendance";
import { listEmployeePicker } from "@/lib/actions/employees";

const statusOptions: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Đi làm (1 công)" },
  { value: "half", label: "Nửa công (0.5)" },
  { value: "paid_leave", label: "Nghỉ phép có lương" },
  { value: "unpaid_leave", label: "Nghỉ không lương" },
  { value: "absent", label: "Vắng" },
];

function money(n: number) {
  return n.toLocaleString("vi-VN");
}

export function AttendancePage() {
  const now = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [employees, setEmployees] = React.useState<
    { id: string; code: string; full_name: string; base_salary: number }[]
  >([]);
  const [rows, setRows] = React.useState<
    {
      id: string;
      employee_id: string;
      employee_code: string;
      employee_name: string;
      work_date: string;
      status: AttendanceStatus;
      overtime_hours: number;
      note: string | null;
    }[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [employeeId, setEmployeeId] = React.useState("");
  const [workDate, setWorkDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = React.useState<AttendanceStatus>("present");
  const [ot, setOt] = React.useState("0");
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const y = Number(year);
      const m = Number(month);
      const [empRows, attendanceRows] = await Promise.all([
        listEmployeePicker(true),
        listAttendanceByMonth(y, m),
      ]);
      setEmployees(empRows);
      setRows(attendanceRows);
      if (!employeeId && empRows.length > 0) setEmployeeId(empRows[0].id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [year, month, employeeId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    setSaving(true);
    setErr(null);
    try {
      await upsertAttendance({
        employee_id: employeeId,
        work_date: workDate,
        status,
        overtime_hours: Number(ot),
        note: note.trim() || null,
      });
      setOt("0");
      setNote("");
      await reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Không lưu được chấm công");
    } finally {
      setSaving(false);
    }
  };

  const years = React.useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(y - i));
  }, [now]);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h1 className="text-lg font-semibold">Chấm công nhân sự</h1>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
          Nhập theo từng ngày. Nếu cùng nhân sự + ngày đã tồn tại, hệ thống sẽ tự cập nhật bản ghi.
        </p>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="att-y">Năm</Label>
          <Select id="att-y" value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="att-m">Tháng</Label>
          <Select id="att-m" value={month} onChange={(e) => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="button" variant="secondary" onClick={() => void reload()} disabled={loading}>
            {loading ? "Đang tải..." : "Làm mới"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
          {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="att-emp">Nhân viên</Label>
            <Select id="att-emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} - {e.full_name} ({money(e.base_salary)} đ)
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="att-date">Ngày công</Label>
            <Input id="att-date" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="att-status">Trạng thái</Label>
            <Select
              id="att-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="att-ot">Tăng ca (giờ)</Label>
            <Input id="att-ot" type="number" min={0} step={0.5} value={ot} onChange={(e) => setOt(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="att-note">Ghi chú</Label>
            <Input id="att-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled={saving || !employeeId}>
              {saving ? "Đang lưu..." : "Lưu chấm công"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Lịch sử chấm công tháng {month}/{year}</h2>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
          <table className="w-full min-w-[50rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Mã NV</th>
                <th className="px-3 py-2">Nhân viên</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2 text-right">OT (giờ)</th>
                <th className="px-3 py-2">Ghi chú</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
                  <td className="px-3 py-2 tabular-nums">{r.work_date}</td>
                  <td className="px-3 py-2">{r.employee_code}</td>
                  <td className="px-3 py-2">{r.employee_name}</td>
                  <td className="px-3 py-2">{statusOptions.find((s) => s.value === r.status)?.label ?? r.status}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.overtime_hours}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-[var(--on-surface-muted)]">{r.note ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!confirm("Xóa dòng chấm công này?")) return;
                        void deleteAttendance(r.id).then(reload).catch((e) => {
                          alert(e instanceof Error ? e.message : "Không xóa được");
                        });
                      }}
                    >
                      Xóa
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--on-surface-muted)]" colSpan={7}>
                    Chưa có dữ liệu.
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
