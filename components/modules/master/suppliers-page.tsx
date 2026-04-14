"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import { DataGridMenuDeleteItem, DataGridMenuEditItem } from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DetailPreview } from "@/components/ui/detail-preview";
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier, type SupplierRow } from "@/lib/actions/suppliers";

export function SuppliersPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SupplierRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [representativeName, setRepresentativeName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);

  const reset = () => {
    setEditing(null);
    setCode("");
    setName("");
    setRepresentativeName("");
    setPhone("");
    setAddress("");
    setTaxId("");
    setNotes("");
    setIsActive(true);
    setErr(null);
  };

  const openEdit = (row: SupplierRow) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setRepresentativeName(row.representative_name ?? "");
    setPhone(row.phone ?? "");
    setAddress(row.address ?? "");
    setTaxId(row.tax_id ?? "");
    setNotes(row.notes ?? "");
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
        name: name.trim(),
        representative_name: representativeName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        tax_id: taxId.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive,
      };
      if (editing) await updateSupplier(editing.id, payload);
      else await createSupplier(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (row: SupplierRow) => {
    if (!confirm("Xóa NCC " + row.code + "?")) return;
    try {
      await deleteSupplier(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được");
    }
  };

  const columns = React.useMemo<ColumnDef<SupplierRow, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Mã NCC", meta: { filterKey: "code", filterType: "text" } },
      { accessorKey: "name", header: "Tên", meta: { filterKey: "name", filterType: "text" } },
      { accessorKey: "phone", header: "SĐT" },
      { accessorKey: "tax_id", header: "MST" },
      { accessorKey: "address", header: "Địa chỉ", meta: { filterType: "none" } },
      { id: "is_active", accessorKey: "is_active", header: "Hoạt động", meta: { filterKey: "is_active", filterType: "select", filterOptions: [{ value: "true", label: "Có" }, { value: "false", label: "Không" }] }, cell: ({ getValue }) => ((getValue() as boolean) ? "Có" : "Không") },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DataGridMenuEditItem onSelect={() => openEdit(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDelete(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <ExcelDataGrid<SupplierRow>
        moduleId="suppliers"
        title="Nhà cung cấp"
        columns={columns}
        list={listSuppliers}
        reloadSignal={gridReload}
        renderRowDetail={(row) => (
          <DetailPreview
            fields={[
              { label: "Mã NCC", value: row.code },
              { label: "Tên", value: row.name },
              { label: "Đại diện", value: row.representative_name },
              { label: "SĐT", value: row.phone },
              { label: "MST", value: row.tax_id },
              { label: "Địa chỉ", value: row.address, span: "full" },
              { label: "Ghi chú", value: row.notes, span: "full" },
            ]}
          />
        )}
        rowDetailTitle={(r) => "NCC " + r.code}
        toolbarExtra={<Button variant="primary" type="button" size="sm" onClick={() => { reset(); setOpen(true); }}>Thêm NCC</Button>}
        getRowId={(r) => r.id}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa NCC" : "Thêm NCC"}</DialogTitle>
            <DialogDescription>Danh mục nhà cung cấp tách riêng khỏi khách hàng.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2"><Label htmlFor="s-code">Mã NCC</Label><Input id="s-code" value={code} onChange={(e) => setCode(e.target.value)} required /></div>
            <div className="grid gap-2"><Label htmlFor="s-name">Tên</Label><Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="grid gap-2"><Label htmlFor="s-rn">Người đại diện</Label><Input id="s-rn" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="s-ph">SĐT</Label><Input id="s-ph" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="s-addr">Địa chỉ</Label><Input id="s-addr" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="s-tax">MST</Label><Input id="s-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="s-note">Ghi chú</Label><Textarea id="s-note" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Hoạt động</label>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
              <Button variant="primary" type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
