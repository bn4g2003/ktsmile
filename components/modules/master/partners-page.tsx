"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridMenuDeleteItem,
  DataGridMenuEditItem,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PartnerRowDetailPanel } from "@/components/modules/master/partner-row-detail-panel";
import { Textarea } from "@/components/ui/textarea";
import { formatPartnerType } from "@/lib/format/labels";
import { importCustomerPartnersFromExcel } from "@/lib/actions/partners-import";
import { createPartner, deletePartner, listPartners, updatePartner, type PartnerRow } from "@/lib/actions/partners";

const partnerTypeOptions = [
  { value: "customer_clinic", label: "Khách — Phòng khám" },
  { value: "customer_labo", label: "Khách — Labo" },
];

export function PartnersPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PartnerRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const fileCustomerImportRef = React.useRef<HTMLInputElement>(null);

  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [partnerType, setPartnerType] = React.useState<PartnerRow["partner_type"]>("customer_clinic");
  const [representativeName, setRepresentativeName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [discount, setDiscount] = React.useState("0");
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
    setPartnerType("customer_clinic");
    setRepresentativeName("");
    setPhone("");
    setAddress("");
    setTaxId("");
    setDiscount("0");
    setNotes("");
    setIsActive(true);
    setFormError(null);
  };

  const openEdit = (row: PartnerRow) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setPartnerType(row.partner_type);
    setRepresentativeName(row.representative_name ?? "");
    setPhone(row.phone ?? "");
    setAddress(row.address ?? "");
    setTaxId(row.tax_id ?? "");
    setDiscount(String(row.default_discount_percent ?? 0));
    setNotes(row.notes ?? "");
    setIsActive(row.is_active);
    setFormError(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        partner_type: partnerType,
        representative_name: representativeName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        tax_id: taxId.trim() || null,
        default_discount_percent: Number(discount) || 0,
        notes: notes.trim() || null,
        is_active: isActive,
      };
      if (editing) await updatePartner(editing.id, payload);
      else await createPartner(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (row: PartnerRow) => {
    if (!confirm("Xóa khách hàng " + row.code + "?")) return;
    try {
      await deletePartner(row.id);
      bumpGrid();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không xóa được (có thể đang được dùng).");
    }
  };

  const onPickCustomerExcel = () => fileCustomerImportRef.current?.click();
  const onCustomerExcelSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await importCustomerPartnersFromExcel(fd);
      if (res.ok) {
        alert(res.message ?? "Nhập xong.");
        bumpGrid();
      } else {
        alert(res.message ?? "Nhập thất bại.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
    }
  };

  const columns = React.useMemo<ColumnDef<PartnerRow, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Mã KH", meta: { filterKey: "code", filterType: "text" } },
      { accessorKey: "name", header: "Tên", meta: { filterKey: "name", filterType: "text" } },
      {
        accessorKey: "partner_type",
        header: "Phân loại",
        meta: { filterKey: "partner_type", filterType: "select", filterOptions: partnerTypeOptions },
        cell: ({ getValue }) => formatPartnerType(getValue() as PartnerRow["partner_type"]),
      },
      { accessorKey: "representative_name", header: "Đại diện", meta: { filterType: "none" } },
      { accessorKey: "phone", header: "SĐT" },
      { accessorKey: "tax_id", header: "MST" },
      { accessorKey: "default_discount_percent", header: "CK %" },
      {
        id: "is_active",
        accessorKey: "is_active",
        header: "Hoạt động",
        meta: { filterKey: "is_active", filterType: "select", filterOptions: [{ value: "true", label: "Có" }, { value: "false", label: "Không" }] },
        cell: ({ getValue }) => ((getValue() as boolean) ? "Có" : "Không"),
      },
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
      <input
        ref={fileCustomerImportRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(ev) => void onCustomerExcelSelected(ev)}
      />
      <ExcelDataGrid<PartnerRow>
        moduleId="partners_customers"
        title="Khách hàng (phòng khám & labo)"
        columns={columns}
        list={listPartners}
        reloadSignal={gridReload}
        renderRowDetail={(row) => <PartnerRowDetailPanel row={row} />}
        rowDetailTitle={(r) => "Khách " + r.code}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" type="button" size="sm" disabled={importBusy} onClick={onPickCustomerExcel}>
              {importBusy ? "Đang nhập…" : "Nhập Excel (danh sách KH)"}
            </Button>
            <Button variant="primary" type="button" size="sm" onClick={() => { reset(); setOpen(true); }}>
              Thêm khách
            </Button>
          </div>
        }
        getRowId={(r) => r.id}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
            <DialogDescription>Nhập thông tin khách hàng.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {formError ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{formError}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="p-code">Mã KH</Label>
              <Input id="p-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-name">Tên</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="p-type">Phân loại</Label>
              <Select id="p-type" value={partnerType} onChange={(e) => setPartnerType(e.target.value as PartnerRow["partner_type"])}>
                {partnerTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="p-rn">Người đại diện</Label><Input id="p-rn" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="p-ph">SĐT</Label><Input id="p-ph" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="p-addr">Địa chỉ</Label><Input id="p-addr" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="p-tax">MST</Label><Input id="p-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="p-disc">Chiết khấu %</Label><Input id="p-disc" type="number" min={0} max={100} step={0.01} value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="p-notes">Ghi chú</Label><Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
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
