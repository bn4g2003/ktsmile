"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridDeleteButton,
  DataGridEditButton,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmployeeRowDetailPanel } from "@/components/modules/master/employee-row-detail-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importEmployeesFromExcel } from "@/lib/actions/employees-import";
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
  type EmployeeRow,
} from "@/lib/actions/employees";

export function EmployeesPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EmployeeRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [salary, setSalary] = React.useState("0");
  const [isActive, setIsActive] = React.useState(true);
  const fileImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);

  const reset = () => {
    setEditing(null);
    setCode("");
    setFullName("");
    setRole("");
    setSalary("0");
    setIsActive(true);
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: EmployeeRow) => {
    setEditing(row);
    setCode(row.code);
    setFullName(row.full_name);
    setRole(row.role);
    setSalary(String(row.base_salary));
    setIsActive(row.is_active);
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const payload = {
        code: code.trim(),
        full_name: fullName.trim(),
        role: role.trim(),
        base_salary: Number(salary),
        is_active: isActive,
      };
      if (editing) await updateEmployee(editing.id, payload);
      else await createEmployee(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onPickExcel = () => fileImportRef.current?.click();

  const onExcelSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await importEmployeesFromExcel(fd);
      if (res.ok) {
        const warn = res.errors?.length
          ? "\n\nCảnh báo:\n" + res.errors.slice(0, 40).join("\n") + (res.errors.length > 40 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập xong.") + warn);
        bumpGrid();
      } else {
        const detail = res.errors?.length
          ? "\n\n" + res.errors.slice(0, 40).join("\n") + (res.errors.length > 40 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập thất bại.") + detail);
      }
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
    }
  };

  const onDelete = async (row: EmployeeRow) => {
    if (!confirm("Xóa NV " + row.code + "?")) return;
    try {
      await deleteEmployee(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được");
    }
  };

  const columns = React.useMemo<ColumnDef<EmployeeRow, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Mã NV", meta: { filterKey: "code", filterType: "text" } },
      {
        accessorKey: "full_name",
        header: "Tên",
        meta: { filterKey: "full_name", filterType: "text" },
      },
      { accessorKey: "role", header: "Vai trò" },
      { accessorKey: "base_salary", header: "Lương CB" },
      {
        accessorKey: "auth_user_id",
        header: "Auth user",
        cell: ({ getValue }) => (getValue() as string | null)?.slice(0, 8) ?? "—",
      },
      {
        accessorKey: "is_active",
        header: "Hoạt động",
        meta: {
          filterKey: "is_active",
          filterType: "select",
          filterOptions: [
            { value: "true", label: "Có" },
            { value: "false", label: "Không" },
          ],
        },
        cell: ({ getValue }) => ((getValue() as boolean) ? "Có" : "Không"),
      },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DataGridEditButton type="button" onClick={() => openEdit(row.original)} />
            <DataGridDeleteButton type="button" onClick={() => void onDelete(row.original)} />
          </>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <ExcelDataGrid<EmployeeRow>
        moduleId="employees"
        title="Nhân sự"
        columns={columns}
        list={listEmployees}
        reloadSignal={gridReload}
        renderRowDetail={(row) => <EmployeeRowDetailPanel row={row} />}
        rowDetailTitle={(r) => "NV " + r.code}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileImportRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(ev) => void onExcelSelected(ev)}
            />
            <Button
              variant="secondary"
              type="button"
              size="sm"
              disabled={importBusy}
              onClick={onPickExcel}
            >
              {importBusy ? "Đang nhập…" : "Nhập Excel (bảng lương)"}
            </Button>
            <Button variant="primary" type="button" size="sm" onClick={openCreate}>
              Thêm NV
            </Button>
          </div>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa nhân viên" : "Thêm nhân viên"}</DialogTitle>
            <DialogDescription>Liên kết Auth có thể bổ sung sau.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="e-code">Mã NV</Label>
              <Input id="e-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-name">Họ tên</Label>
              <Input id="e-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="e-role">Vai trò</Label>
              <Input id="e-role" value={role} onChange={(e) => setRole(e.target.value)} required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="e-sal">Lương cơ bản</Label>
              <Input
                id="e-sal"
                type="number"
                min={0}
                step={1000}
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                id="e-act"
                className="h-5 w-5 rounded-[var(--radius-sm)] border border-[var(--border-ghost)]"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Label htmlFor="e-act" className="normal-case tracking-normal">
                Đang hoạt động
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" disabled={pending}>
                {pending ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
