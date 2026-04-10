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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Textarea } from "@/components/ui/textarea";
import { formatPartnerType } from "@/lib/format/labels";
import {
  createPartner,
  deletePartner,
  listPartners,
  updatePartner,
  type PartnerRow,
} from "@/lib/actions/partners";

const partnerTypeOptions = [
  { value: "customer_clinic", label: "Khách — Phòng khám" },
  { value: "customer_labo", label: "Khách — Labo" },
  { value: "supplier", label: "Nhà cung cấp" },
];

export function PartnersPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PartnerRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [partnerType, setPartnerType] =
    React.useState<PartnerRow["partner_type"]>("customer_clinic");
  const [representativeName, setRepresentativeName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [discount, setDiscount] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

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

  const openCreate = () => {
    reset();
    setOpen(true);
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
    if (!confirm("Xóa đối tác " + row.code + "?")) return;
    try {
      await deletePartner(row.id);
      bumpGrid();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không xóa được (có thể đang được dùng).");
    }
  };

  const columns = React.useMemo<ColumnDef<PartnerRow, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Mã",
        meta: { filterKey: "code", filterType: "text" },
      },
      {
        accessorKey: "name",
        header: "Tên",
        meta: { filterKey: "name", filterType: "text" },
      },
      {
        id: "partner_type",
        accessorKey: "partner_type",
        header: "Phân loại",
        meta: {
          filterKey: "partner_type",
          filterType: "select",
          filterOptions: partnerTypeOptions,
        },
        cell: ({ getValue }) => formatPartnerType(getValue() as PartnerRow["partner_type"]),
      },
      {
        accessorKey: "representative_name",
        header: "Đại diện",
        meta: { filterType: "none" },
      },
      { accessorKey: "phone", header: "SĐT" },
      { accessorKey: "tax_id", header: "MST" },
      {
        accessorKey: "default_discount_percent",
        header: "CK %",
      },
      {
        id: "is_active",
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

  const renderPartnerDetail = React.useCallback((row: PartnerRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Mã", value: row.code },
          { label: "Tên", value: row.name },
          { label: "Phân loại", value: formatPartnerType(row.partner_type) },
          { label: "Người đại diện", value: row.representative_name },
          { label: "SĐT", value: row.phone },
          { label: "Mã số thuế", value: row.tax_id },
          { label: "Chiết khấu mặc định %", value: row.default_discount_percent ?? "—" },
          { label: "Hoạt động", value: row.is_active ? "Có" : "Không" },
          { label: "Địa chỉ", value: row.address, span: "full" },
          { label: "Ghi chú", value: row.notes, span: "full" },
          { label: "Tạo lúc", value: row.created_at },
          { label: "Cập nhật", value: row.updated_at },
        ]}
      />
    );
  }, []);

  return (
    <>
      <ExcelDataGrid<PartnerRow>
        moduleId="partners"
        title="Danh mục đối tác"
        columns={columns}
        list={listPartners}
        reloadSignal={gridReload}
        renderRowDetail={renderPartnerDetail}
        rowDetailTitle={(r) => "Đối tác " + r.code}
        toolbarExtra={
          <Button variant="primary" type="button" size="sm" onClick={openCreate}>
            Thêm đối tác
          </Button>
        }
        getRowId={(r) => r.id}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa đối tác" : "Thêm đối tác"}</DialogTitle>
            <DialogDescription>
              Nhập thông tin đối tác. Các trường bắt buộc: mã, tên, phân loại.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {formError ? (
              <p className="text-sm text-[#b91c1c] sm:col-span-2" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="p-code">Mã</Label>
              <Input id="p-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-name">Tên</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="p-type">Phân loại</Label>
              <Select
                id="p-type"
                value={partnerType}
                onChange={(e) =>
                  setPartnerType(e.target.value as PartnerRow["partner_type"])
                }
              >
                {partnerTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-rep">Người đại diện</Label>
              <Input
                id="p-rep"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-phone">SĐT</Label>
              <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="p-addr">Địa chỉ</Label>
              <Textarea id="p-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-tax">Mã số thuế</Label>
              <Input id="p-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-disc">Chiết khấu mặc định %</Label>
              <Input
                id="p-disc"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="p-notes">Ghi chú</Label>
              <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                id="p-active"
                type="checkbox"
                className="h-5 w-5 rounded-[var(--radius-sm)] border border-[var(--border-ghost)]"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Label htmlFor="p-active" className="normal-case tracking-normal">
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
