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
import { DetailPreview } from "@/components/ui/detail-preview";
import { Textarea } from "@/components/ui/textarea";
import { StockVoucherPrintButton } from "@/components/shared/reports/stock-voucher-print-button";
import { listPartnerPicker } from "@/lib/actions/partners";
import { formatMovement } from "@/lib/format/labels";
import {
  createStockDocument,
  deleteStockDocument,
  listStockDocuments,
  updateStockDocument,
  type StockDocumentRow,
} from "@/lib/actions/stock";

const movOpts = [
  { value: "inbound", label: "Nhập kho" },
  { value: "outbound", label: "Xuất kho" },
];

export function InventoryDocumentsPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StockDocumentRow | null>(null);
  const [partners, setPartners] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [docNum, setDocNum] = React.useState("");
  const [docDate, setDocDate] = React.useState("");
  const [mov, setMov] = React.useState<"inbound" | "outbound">("inbound");
  const [partnerId, setPartnerId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    void listPartnerPicker().then(setPartners).catch(() => {});
  }, []);

  const reset = () => {
    setEditing(null);
    setDocNum("");
    setDocDate(new Date().toISOString().slice(0, 10));
    setMov("inbound");
    setPartnerId("");
    setReason("");
    setNotes("");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: StockDocumentRow) => {
    setEditing(row);
    setDocNum(row.document_number);
    setDocDate(row.document_date);
    setMov(row.movement_type);
    setPartnerId(row.partner_id ?? "");
    setReason(row.reason ?? "");
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
        document_number: docNum.trim(),
        document_date: docDate,
        movement_type: mov,
        partner_id: partnerId || null,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      };
      if (editing) await updateStockDocument(editing.id, payload);
      else await createStockDocument(payload);
      setOpen(false);
      reset();
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (row: StockDocumentRow) => {
    if (!confirm("Xóa phiếu " + row.document_number + "?")) return;
    try {
      await deleteStockDocument(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    }
  };

  const columns = React.useMemo<ColumnDef<StockDocumentRow, unknown>[]>(
    () => [
      {
        accessorKey: "document_number",
        header: "Số phiếu",
        meta: { filterKey: "document_number", filterType: "text" },
        cell: ({ row, getValue }) => (
          <Link
            className="font-medium text-[color-mix(in_srgb,var(--primary)_55%,var(--on-surface))] hover:underline"
            href={"/inventory/documents/" + row.original.id}
          >
            {String(getValue())}
          </Link>
        ),
      },
      {
        accessorKey: "document_date",
        header: "Ngày",
        meta: { filterKey: "document_date_from", filterType: "text" },
      },
      {
        id: "document_date_to",
        header: "Đến",
        meta: { filterKey: "document_date_to", filterType: "text" },
        cell: () => "",
      },
      {
        accessorKey: "movement_type",
        header: "Loại",
        meta: {
          filterKey: "movement_type",
          filterType: "select",
          filterOptions: movOpts,
        },
        cell: ({ getValue }) => formatMovement(String(getValue())),
      },
      { accessorKey: "partner_code", header: "Mã ĐT" },
      { accessorKey: "partner_name", header: "Đối tác" },
      { accessorKey: "line_count", header: "Số dòng" },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <StockVoucherPrintButton documentId={row.original.id} label="PDF" />
            <DataGridEditButton type="button" onClick={() => openEdit(row.original)} />
            <DataGridDeleteButton type="button" onClick={() => void onDelete(row.original)} />
            <DataGridAuxLink href={"/inventory/documents/" + row.original.id}>Dòng</DataGridAuxLink>
          </>
        ),
      },
    ],
    [],
  );

  const renderStockDocDetail = React.useCallback((row: StockDocumentRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Số phiếu", value: row.document_number },
          { label: "Ngày", value: row.document_date },
          { label: "Loại", value: formatMovement(row.movement_type) },
          { label: "Mã ĐT", value: row.partner_code },
          { label: "Đối tác", value: row.partner_name },
          { label: "Số dòng", value: row.line_count },
          { label: "Lý do", value: row.reason, span: "full" },
          { label: "Ghi chú", value: row.notes, span: "full" },
          { label: "ID", value: row.id, span: "full" },
          { label: "Tạo lúc", value: row.created_at },
          { label: "Cập nhật", value: row.updated_at },
        ]}
      />
    );
  }, []);

  return (
    <>
      <ExcelDataGrid<StockDocumentRow>
        moduleId="stock_documents"
        title="Phiếu nhập / xuất kho"
        columns={columns}
        list={listStockDocuments}
        reloadSignal={gridReload}
        renderRowDetail={renderStockDocDetail}
        rowDetailTitle={(r) => "Phiếu " + r.document_number}
        toolbarExtra={
          <Button variant="primary" type="button" onClick={openCreate}>
            Thêm phiếu
          </Button>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa phiếu" : "Thêm phiếu"}</DialogTitle>
            <DialogDescription>Chi tiết vật tư thêm ở trang dòng phiếu.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="sd-num">Số phiếu</Label>
              <Input id="sd-num" value={docNum} onChange={(e) => setDocNum(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sd-date">Ngày</Label>
              <Input
                id="sd-date"
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sd-mov">Loại</Label>
              <Select id="sd-mov" value={mov} onChange={(e) => setMov(e.target.value as typeof mov)}>
                {movOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sd-p">Đối tác (tuỳ chọn)</Label>
              <Select id="sd-p" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">—</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="sd-reason">Lý do / Ghi chú ngắn</Label>
              <Input id="sd-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="sd-notes">Ghi chú</Label>
              <Textarea id="sd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
