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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PartnerRowDetailPanel } from "@/components/modules/master/partner-row-detail-panel";
import { Textarea } from "@/components/ui/textarea";
import { formatPartnerType } from "@/lib/format/labels";
import {
  importCustomerPartnersFromExcel,
  importSupplierPartnersFromExcel,
} from "@/lib/actions/partners-import";
import {
  createPartner,
  deletePartner,
  listCustomerPartners,
  listSupplierPartners,
  updatePartner,
  type PartnerRow,
} from "@/lib/actions/partners";

const partnerTypeOptions = [
  { value: "customer_clinic", label: "Khách — Phòng khám" },
  { value: "customer_labo", label: "Khách — Labo" },
  { value: "supplier", label: "Nhà cung cấp" },
];

const customerPartnerTypeFilterOptions = partnerTypeOptions.filter((o) => o.value !== "supplier");

export function PartnersPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<"customers" | "suppliers">("customers");
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);

  React.useEffect(() => {
    setGridReload((n) => n + 1);
  }, [tab]);

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

  const fileCustomerImportRef = React.useRef<HTMLInputElement>(null);
  const fileSupplierImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);

  const reset = () => {
    setEditing(null);
    setCode("");
    setName("");
    setPartnerType(tab === "suppliers" ? "supplier" : "customer_clinic");
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
    setPartnerType(tab === "suppliers" ? "supplier" : "customer_clinic");
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

  const onPickCustomerExcel = () => fileCustomerImportRef.current?.click();
  const onPickSupplierExcel = () => fileSupplierImportRef.current?.click();

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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
    }
  };

  const onSupplierExcelSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await importSupplierPartnersFromExcel(fd);
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
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

  const columnsCustomers = React.useMemo<ColumnDef<PartnerRow, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Mã KH",
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
          filterOptions: customerPartnerTypeFilterOptions,
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
      { accessorKey: "default_discount_percent", header: "CK %" },
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
            <DataGridMenuEditItem onSelect={() => openEdit(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDelete(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [],
  );

  const columnsSuppliers = React.useMemo<ColumnDef<PartnerRow, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Mã NCC",
        meta: { filterKey: "code", filterType: "text" },
      },
      {
        accessorKey: "name",
        header: "Tên công ty",
        meta: { filterKey: "name", filterType: "text" },
      },
      { accessorKey: "phone", header: "SĐT" },
      { accessorKey: "tax_id", header: "MST" },
      { accessorKey: "address", header: "Địa chỉ", meta: { filterType: "none" } },
      {
        accessorKey: "notes",
        header: "Ghi chú",
        meta: { filterType: "none" },
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (v.length > 48 ? v.slice(0, 48) + "…" : v) : "—";
        },
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
            <DataGridMenuEditItem onSelect={() => openEdit(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDelete(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [],
  );

  const typeOptionsForForm = editing
    ? partnerTypeOptions
    : tab === "suppliers"
      ? partnerTypeOptions.filter((o) => o.value === "supplier")
      : customerPartnerTypeFilterOptions;

  const dialogTitle =
    editing ? "Sửa đối tác" : tab === "suppliers" ? "Thêm nhà cung cấp" : "Thêm khách hàng";

  return (
    <div className="flex flex-col gap-4">
      <DetailTabStrip
        items={[
          { id: "customers", label: "Khách hàng" },
          { id: "suppliers", label: "Nhà cung cấp" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      <input
        ref={fileCustomerImportRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(ev) => void onCustomerExcelSelected(ev)}
      />
      <input
        ref={fileSupplierImportRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(ev) => void onSupplierExcelSelected(ev)}
      />

      {tab === "customers" ? (
        <ExcelDataGrid<PartnerRow>
          moduleId="partners_khach"
          title="Khách hàng (phòng khám & labo)"
          columns={columnsCustomers}
          list={listCustomerPartners}
          reloadSignal={gridReload}
          renderRowDetail={(row) => <PartnerRowDetailPanel row={row} />}
          rowDetailTitle={(r) => "Khách " + r.code}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                type="button"
                size="sm"
                disabled={importBusy}
                onClick={onPickCustomerExcel}
              >
                {importBusy ? "Đang nhập…" : "Nhập Excel (danh sách KH)"}
              </Button>
              <Button variant="primary" type="button" size="sm" onClick={openCreate}>
                Thêm khách
              </Button>
            </div>
          }
          getRowId={(r) => r.id}
        />
      ) : (
        <ExcelDataGrid<PartnerRow>
          moduleId="partners_ncc"
          title="Nhà cung cấp"
          columns={columnsSuppliers}
          list={listSupplierPartners}
          reloadSignal={gridReload}
          renderRowDetail={(row) => <PartnerRowDetailPanel row={row} />}
          rowDetailTitle={(r) => "NCC " + r.code}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                type="button"
                size="sm"
                disabled={importBusy}
                onClick={onPickSupplierExcel}
              >
                {importBusy ? "Đang nhập…" : "Nhập Excel (NCC)"}
              </Button>
              <Button variant="primary" type="button" size="sm" onClick={openCreate}>
                Thêm NCC
              </Button>
            </div>
          }
          getRowId={(r) => r.id}
        />
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {tab === "suppliers" && !editing
                ? "Nhà cung cấp — cùng bảng đối tác, phân loại NCC."
                : "Nhập thông tin đối tác. Các trường bắt buộc: mã, tên, phân loại."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {formError ? (
              <p className="text-sm text-[#b91c1c] sm:col-span-2" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="p-code">{tab === "suppliers" && !editing ? "Mã NCC" : "Mã"}</Label>
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
                {typeOptionsForForm.map((o) => (
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
    </div>
  );
}
