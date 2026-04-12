"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridAuxLink,
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
import { LabOrderRowDetailPanel } from "@/components/modules/orders/lab-order-row-detail-panel";
import { LabOrderStatusQuickDialog } from "@/components/modules/orders/lab-order-status-quick-dialog";
import { Textarea } from "@/components/ui/textarea";
import { listPartnerPicker } from "@/lib/actions/partners";
import {
  formatOrderStatus,
  labOrderStatusOptions,
  orderStatusBadgeClassName,
} from "@/lib/format/labels";
import { LabOrderPrintButton } from "@/components/shared/reports/lab-order-print-button";
import { importLabOrdersFromExcel } from "@/lib/actions/lab-orders-import";
import {
  createLabOrder,
  deleteLabOrder,
  listLabOrders,
  updateLabOrder,
  updateLabOrderStatus,
  type LabOrderRow,
} from "@/lib/actions/lab-orders";

export function OrdersPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LabOrderRow | null>(null);
  const [partners, setPartners] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [orderNumber, setOrderNumber] = React.useState("");
  const [receivedAt, setReceivedAt] = React.useState("");
  const [partnerId, setPartnerId] = React.useState("");
  const [patientName, setPatientName] = React.useState("");
  const [status, setStatus] = React.useState("draft");
  const [notes, setNotes] = React.useState("");
  const fileImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quickRow, setQuickRow] = React.useState<LabOrderRow | null>(null);
  const [quickStatus, setQuickStatus] = React.useState<LabOrderRow["status"]>("draft");
  const [quickPending, setQuickPending] = React.useState(false);
  const [quickErr, setQuickErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    void listPartnerPicker().then(setPartners).catch(() => {});
  }, []);

  const reset = () => {
    setEditing(null);
    setOrderNumber("");
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setPartnerId(partners[0]?.id ?? "");
    setPatientName("");
    setStatus("draft");
    setNotes("");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: LabOrderRow) => {
    setEditing(row);
    setOrderNumber(row.order_number);
    setReceivedAt(row.received_at);
    setPartnerId(row.partner_id);
    setPatientName(row.patient_name);
    setStatus(row.status);
    setNotes(row.notes ?? "");
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const payload = {
        order_number: orderNumber.trim(),
        received_at: receivedAt,
        partner_id: partnerId,
        patient_name: patientName.trim(),
        status: status as LabOrderRow["status"],
        notes: notes.trim() || null,
      };
      if (editing) await updateLabOrder(editing.id, payload);
      else await createLabOrder(payload);
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
      const res = await importLabOrdersFromExcel(fd);
      if (res.ok) {
        const warn = res.errors?.length
          ? "\n\nCảnh báo (dòng bỏ qua):\n" +
            res.errors.slice(0, 35).join("\n") +
            (res.errors.length > 35 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập xong.") + warn);
        bumpGrid();
      } else {
        const detail = res.errors?.length
          ? "\n\n" + res.errors.slice(0, 30).join("\n") + (res.errors.length > 30 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập thất bại.") + detail);
      }
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
    }
  };

  const onDelete = async (row: LabOrderRow) => {
    if (!confirm("Xóa đơn " + row.order_number + "? (cả dòng chi tiết)")) return;
    try {
      await deleteLabOrder(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được");
    }
  };

  const openQuickStatus = React.useCallback((row: LabOrderRow) => {
    setQuickRow(row);
    setQuickStatus(row.status);
    setQuickErr(null);
    setQuickOpen(true);
  }, []);

  const saveQuickStatus = React.useCallback(async () => {
    if (!quickRow) return;
    setQuickPending(true);
    setQuickErr(null);
    try {
      await updateLabOrderStatus(quickRow.id, quickStatus);
      setQuickOpen(false);
      setQuickRow(null);
      bumpGrid();
    } catch (e2) {
      setQuickErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setQuickPending(false);
    }
  }, [quickRow, quickStatus, bumpGrid]);

  const columns = React.useMemo<ColumnDef<LabOrderRow, unknown>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: "Số đơn",
        meta: { filterKey: "order_number", filterType: "text" },
        cell: ({ row, getValue }) => (
          <Link
            className="font-medium text-[color-mix(in_srgb,var(--primary)_55%,var(--on-surface))] underline-offset-2 hover:underline"
            href={"/orders/" + row.original.id}
          >
            {String(getValue())}
          </Link>
        ),
      },
      {
        accessorKey: "received_at",
        header: "Ngày nhận",
        meta: { filterKey: "received_from", filterType: "text" },
      },
      {
        id: "received_to",
        header: "Đến",
        meta: { filterKey: "received_to", filterType: "text" },
        cell: () => "",
      },
      { accessorKey: "partner_code", header: "Mã KH" },
      { accessorKey: "partner_name", header: "Khách" },
      { accessorKey: "patient_name", header: "Bệnh nhân" },
      {
        accessorKey: "status",
        header: "Trạng thái",
        meta: {
          filterKey: "status",
          filterType: "select",
          filterOptions: [...labOrderStatusOptions],
        },
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={orderStatusBadgeClassName(row.original.status)}
              title={formatOrderStatus(row.original.status)}
            >
              {formatOrderStatus(row.original.status)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => openQuickStatus(row.original)}
            >
              Đổi
            </Button>
          </div>
        ),
      },
      { accessorKey: "total_amount", header: "Tổng tiền" },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <LabOrderPrintButton orderId={row.original.id} label="PDF" />
            <DataGridEditButton type="button" onClick={() => openEdit(row.original)} />
            <DataGridDeleteButton type="button" onClick={() => void onDelete(row.original)} />
            <DataGridAuxLink href={"/orders/" + row.original.id}>Dòng SP</DataGridAuxLink>
          </>
        ),
      },
    ],
    [openQuickStatus],
  );

  return (
    <>
      <ExcelDataGrid<LabOrderRow>
        moduleId="lab_orders"
        title="Đơn hàng phục hình"
        columns={columns}
        list={listLabOrders}
        reloadSignal={gridReload}
        renderRowDetail={(row) => <LabOrderRowDetailPanel row={row} />}
        rowDetailTitle={(r) => "Đơn " + r.order_number}
        toolbarExtra={
          <>
            <input
              ref={fileImportRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(ev) => void onExcelSelected(ev)}
            />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={importBusy}
              onClick={onPickExcel}
            >
              {importBusy ? "Đang nhập…" : "Nhập Excel"}
            </Button>
            <Button variant="primary" size="sm" type="button" onClick={openCreate}>
              Thêm đơn
            </Button>
          </>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa đơn" : "Thêm đơn"}</DialogTitle>
            <DialogDescription>Chi tiết răng/màu thêm ở trang dòng đơn.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="lo-num">Số đơn</Label>
              <Input id="lo-num" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lo-date">Ngày nhận</Label>
              <Input
                id="lo-date"
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lo-p">Khách hàng</Label>
              <Select id="lo-p" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
                <option value="">Chọn…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lo-pat">Tên bệnh nhân</Label>
              <Input id="lo-pat" value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lo-st">Trạng thái</Label>
              <Select id="lo-st" value={status} onChange={(e) => setStatus(e.target.value)}>
                {labOrderStatusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lo-notes">Ghi chú</Label>
              <Textarea id="lo-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
      <LabOrderStatusQuickDialog
        open={quickOpen}
        onOpenChange={(v) => {
          setQuickOpen(v);
          if (!v) {
            setQuickRow(null);
            setQuickErr(null);
          }
        }}
        orderLabel={quickRow?.order_number ?? ""}
        value={quickStatus}
        onValueChange={setQuickStatus}
        onConfirm={saveQuickStatus}
        pending={quickPending}
        error={quickErr}
      />
    </>
  );
}
