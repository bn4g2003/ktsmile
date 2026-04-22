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
import { SupplierRowDetailPanel } from "@/components/modules/master/supplier-row-detail-panel";
import { Textarea } from "@/components/ui/textarea";
import { formatPartnerType } from "@/lib/format/labels";
import {
  importCustomerPartnersFromExcel,
  importSupplierPartnersFromExcel,
} from "@/lib/actions/partners-import";
import { createPartner, deletePartner, listPartners, updatePartner, type PartnerRow } from "@/lib/actions/partners";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
  type SupplierRow,
} from "@/lib/actions/suppliers";
import { formatDate } from "@/lib/format/date";

const partnerTypeOptions = [
  { value: "customer_clinic", label: "Khách — Phòng khám" },
  { value: "customer_labo", label: "Khách — Labo" },
];

type PartnerTab = "customers" | "suppliers";

export function PartnersPage({ initialTab = "customers" }: { initialTab?: PartnerTab }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<PartnerTab>(initialTab);
  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [gridCustomer, setGridCustomer] = React.useState(0);
  const [gridSupplier, setGridSupplier] = React.useState(0);
  const bumpCustomers = React.useCallback(() => {
    setGridCustomer((n) => n + 1);
    router.refresh();
  }, [router]);
  const bumpSuppliers = React.useCallback(() => {
    setGridSupplier((n) => n + 1);
    router.refresh();
  }, [router]);

  React.useEffect(() => {
    setGridCustomer((n) => n + 1);
    setGridSupplier((n) => n + 1);
  }, [tab]);

  const [openPartner, setOpenPartner] = React.useState(false);
  const [editingPartner, setEditingPartner] = React.useState<PartnerRow | null>(null);
  const [pendingPartner, setPendingPartner] = React.useState(false);
  const [formErrorPartner, setFormErrorPartner] = React.useState<string | null>(null);
  const fileCustomerImportRef = React.useRef<HTMLInputElement>(null);
  const fileSupplierImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);

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

  const resetPartner = () => {
    setEditingPartner(null);
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
    setFormErrorPartner(null);
  };

  const openEditPartner = (row: PartnerRow) => {
    setEditingPartner(row);
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
    setFormErrorPartner(null);
    setOpenPartner(true);
  };

  const submitPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingPartner(true);
    setFormErrorPartner(null);
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
      if (editingPartner) await updatePartner(editingPartner.id, payload);
      else await createPartner(payload);
      setOpenPartner(false);
      resetPartner();
      bumpCustomers();
    } catch (err) {
      setFormErrorPartner(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setPendingPartner(false);
    }
  };

  const onDeletePartner = async (row: PartnerRow) => {
    if (!confirm("Xóa khách hàng " + row.code + "?")) return;
    try {
      await deletePartner(row.id);
      bumpCustomers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không xóa được (có thể đang được dùng).");
    }
  };

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
        bumpCustomers();
      } else {
        alert(res.message ?? "Nhập thất bại.");
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
        alert(res.message ?? "Nhập xong.");
        bumpSuppliers();
      } else {
        alert(res.message ?? "Nhập thất bại.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
    }
  };

  const columnsCustomers = React.useMemo<ColumnDef<PartnerRow, unknown>[]>(
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
      { accessorKey: "address", header: "Địa chỉ", meta: { filterKey: "address", filterType: "text" } },
      { accessorKey: "tax_id", header: "MST" },
      { accessorKey: "default_discount_percent", header: "CK %" },
      { accessorKey: "notes", header: "Ghi chú", meta: { filterKey: "notes", filterType: "text" } },
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
        accessorKey: "created_at",
        header: "Tạo lúc",
        size: 160,
        cell: ({ getValue }) => formatDate(String(getValue())),
      },
      {
        accessorKey: "updated_at",
        header: "Cập nhật",
        size: 160,
        cell: ({ getValue }) => formatDate(String(getValue())),
      },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DataGridMenuEditItem onSelect={() => openEditPartner(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDeletePartner(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [],
  );

  const [openSupplier, setOpenSupplier] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<SupplierRow | null>(null);
  const [pendingSupplier, setPendingSupplier] = React.useState(false);
  const [formErrorSupplier, setFormErrorSupplier] = React.useState<string | null>(null);
  const [sCode, setSCode] = React.useState("");
  const [sName, setSName] = React.useState("");
  const [sRepresentativeName, setSRepresentativeName] = React.useState("");
  const [sPhone, setSPhone] = React.useState("");
  const [sAddress, setSAddress] = React.useState("");
  const [sTaxId, setSTaxId] = React.useState("");
  const [sNotes, setSNotes] = React.useState("");
  const [sActive, setSActive] = React.useState(true);

  const resetSupplier = () => {
    setEditingSupplier(null);
    setSCode("");
    setSName("");
    setSRepresentativeName("");
    setSPhone("");
    setSAddress("");
    setSTaxId("");
    setSNotes("");
    setSActive(true);
    setFormErrorSupplier(null);
  };

  const openEditSupplier = (row: SupplierRow) => {
    setEditingSupplier(row);
    setSCode(row.code);
    setSName(row.name);
    setSRepresentativeName(row.representative_name ?? "");
    setSPhone(row.phone ?? "");
    setSAddress(row.address ?? "");
    setSTaxId(row.tax_id ?? "");
    setSNotes(row.notes ?? "");
    setSActive(row.is_active);
    setFormErrorSupplier(null);
    setOpenSupplier(true);
  };

  const submitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingSupplier(true);
    setFormErrorSupplier(null);
    try {
      const payload = {
        code: sCode.trim(),
        name: sName.trim(),
        representative_name: sRepresentativeName.trim() || null,
        phone: sPhone.trim() || null,
        address: sAddress.trim() || null,
        tax_id: sTaxId.trim() || null,
        notes: sNotes.trim() || null,
        is_active: sActive,
      };
      if (editingSupplier) await updateSupplier(editingSupplier.id, payload);
      else await createSupplier(payload);
      setOpenSupplier(false);
      resetSupplier();
      bumpSuppliers();
    } catch (err) {
      setFormErrorSupplier(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setPendingSupplier(false);
    }
  };

  const onDeleteSupplier = async (row: SupplierRow) => {
    if (!confirm("Xóa NCC " + row.code + "?")) return;
    try {
      await deleteSupplier(row.id);
      bumpSuppliers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không xóa được");
    }
  };

  const columnsSuppliers = React.useMemo<ColumnDef<SupplierRow, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Mã NCC", meta: { filterKey: "code", filterType: "text" } },
      { accessorKey: "name", header: "Tên", meta: { filterKey: "name", filterType: "text" } },
      { accessorKey: "representative_name", header: "Đại diện", meta: { filterKey: "representative_name", filterType: "text" } },
      { accessorKey: "phone", header: "SĐT" },
      { accessorKey: "address", header: "Địa chỉ", meta: { filterKey: "address", filterType: "text" } },
      { accessorKey: "tax_id", header: "MST" },
      { accessorKey: "notes", header: "Ghi chú", meta: { filterKey: "notes", filterType: "text" } },
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
        accessorKey: "created_at",
        header: "Tạo lúc",
        size: 160,
        cell: ({ getValue }) => formatDate(String(getValue())),
      },
      {
        accessorKey: "updated_at",
        header: "Cập nhật",
        size: 160,
        cell: ({ getValue }) => formatDate(String(getValue())),
      },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DataGridMenuEditItem onSelect={() => openEditSupplier(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDeleteSupplier(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <DetailTabStrip
        items={[
          { id: "customers", label: "Khách hàng" },
          { id: "suppliers", label: "Nhà cung cấp" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as PartnerTab)}
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
          moduleId="partners_customers"
          title="Khách hàng (phòng khám & labo)"
          columns={columnsCustomers}
          list={listPartners}
          reloadSignal={gridCustomer}
          renderRowDetail={(row) => <PartnerRowDetailPanel row={row} />}
          rowDetailTitle={(r) => "Khách " + r.code}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                type="button"
                size="sm"
                disabled={importBusy}
                onClick={() => fileCustomerImportRef.current?.click()}
              >
                {importBusy ? "Đang nhập…" : "Nhập Excel (danh sách KH)"}
              </Button>
              <Button
                variant="primary"
                type="button"
                size="sm"
                onClick={() => {
                  resetPartner();
                  setOpenPartner(true);
                }}
              >
                Thêm khách
              </Button>
            </div>
          }
          getRowId={(r) => r.id}
        />
      ) : (
        <ExcelDataGrid<SupplierRow>
          moduleId="partners_suppliers"
          title="Nhà cung cấp"
          columns={columnsSuppliers}
          list={listSuppliers}
          reloadSignal={gridSupplier}
          renderRowDetail={(row) => <SupplierRowDetailPanel row={row} />}
          rowDetailTitle={(r) => "NCC " + r.code}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                type="button"
                size="sm"
                disabled={importBusy}
                onClick={() => fileSupplierImportRef.current?.click()}
              >
                {importBusy ? "Đang nhập…" : "Nhập Excel (NCC)"}
              </Button>
              <Button
                variant="primary"
                type="button"
                size="sm"
                onClick={() => {
                  resetSupplier();
                  setOpenSupplier(true);
                }}
              >
                Thêm NCC
              </Button>
            </div>
          }
          getRowId={(r) => r.id}
        />
      )}

      <Dialog open={openPartner} onOpenChange={(v) => { setOpenPartner(v); if (!v) resetPartner(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingPartner ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
            <DialogDescription>Nhập thông tin khách hàng.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitPartner(e)} className="grid gap-4 sm:grid-cols-2">
            {formErrorPartner ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{formErrorPartner}</p> : null}
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
              <Select
                id="p-type"
                value={partnerType}
                onChange={(e) => setPartnerType(e.target.value as PartnerRow["partner_type"])}
              >
                {partnerTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-rn">Người đại diện</Label>
              <Input id="p-rn" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-ph">SĐT</Label>
              <Input id="p-ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="p-addr">Địa chỉ</Label>
              <Input id="p-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-tax">MST</Label>
              <Input id="p-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-disc">Chiết khấu %</Label>
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
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Hoạt động
            </label>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpenPartner(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" disabled={pendingPartner}>
                {pendingPartner ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openSupplier} onOpenChange={(v) => { setOpenSupplier(v); if (!v) resetSupplier(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Sửa NCC" : "Thêm NCC"}</DialogTitle>
            <DialogDescription>Danh mục nhà cung cấp (bảng suppliers).</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitSupplier(e)} className="grid gap-4 sm:grid-cols-2">
            {formErrorSupplier ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{formErrorSupplier}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="s-code">Mã NCC</Label>
              <Input id="s-code" value={sCode} onChange={(e) => setSCode(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-name">Tên</Label>
              <Input id="s-name" value={sName} onChange={(e) => setSName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-rn">Người đại diện</Label>
              <Input id="s-rn" value={sRepresentativeName} onChange={(e) => setSRepresentativeName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-ph">SĐT</Label>
              <Input id="s-ph" value={sPhone} onChange={(e) => setSPhone(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="s-addr">Địa chỉ</Label>
              <Input id="s-addr" value={sAddress} onChange={(e) => setSAddress(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-tax">MST</Label>
              <Input id="s-tax" value={sTaxId} onChange={(e) => setSTaxId(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="s-note">Ghi chú</Label>
              <Textarea id="s-note" value={sNotes} onChange={(e) => setSNotes(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={sActive} onChange={(e) => setSActive(e.target.checked)} /> Hoạt động
            </label>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpenSupplier(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" disabled={pendingSupplier}>
                {pendingSupplier ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
