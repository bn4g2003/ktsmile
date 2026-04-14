"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import {
  DataGridMenuDeleteItem,
  DataGridMenuEditItem,
  DataGridMenuLinkItem,
  dataGridPrintMenuItemButtonClassName,
} from "@/components/shared/data-grid/data-grid-action-buttons";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
import { listSupplierPicker } from "@/lib/actions/suppliers";
import { formatMovement, formatPostingStatus } from "@/lib/format/labels";
import { listProductPicker } from "@/lib/actions/products";
import {
  createOutboundStockRequest,
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

const postingOpts = [
  { value: "draft", label: formatPostingStatus("draft") },
  { value: "posted", label: formatPostingStatus("posted") },
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
  const [suppliers, setSuppliers] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [docNum, setDocNum] = React.useState("");
  const [docDate, setDocDate] = React.useState("");
  const [mov, setMov] = React.useState<"inbound" | "outbound">("inbound");
  const [supplierId, setSupplierId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [openRequest, setOpenRequest] = React.useState(false);
  const [reqProducts, setReqProducts] = React.useState<
    { id: string; code: string; name: string; unit_price: number }[]
  >([]);
  const [reqProductId, setReqProductId] = React.useState("");
  const [reqQty, setReqQty] = React.useState("1");
  const [reqReason, setReqReason] = React.useState("");
  const [reqErr, setReqErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    void listSupplierPicker().then(setSuppliers).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!openRequest) return;
    void listProductPicker().then(setReqProducts).catch(() => {});
  }, [openRequest]);

  const reset = () => {
    setEditing(null);
    setDocNum("");
    setDocDate(new Date().toISOString().slice(0, 10));
    setMov("inbound");
    setSupplierId("");
    setReason("");
    setNotes("");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openRequestDialog = () => {
    setReqProductId("");
    setReqQty("1");
    setReqReason("");
    setReqErr(null);
    setOpenRequest(true);
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqProductId) {
      setReqErr("Chọn sản phẩm.");
      return;
    }
    setPending(true);
    setReqErr(null);
    try {
      const newId = await createOutboundStockRequest({
        product_id: reqProductId,
        quantity: Number(reqQty),
        reason: reqReason.trim() || null,
      });
      setOpenRequest(false);
      bumpGrid();
      router.push("/inventory/documents/" + newId);
    } catch (e2) {
      setReqErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const openEdit = (row: StockDocumentRow) => {
    setEditing(row);
    setDocNum(row.document_number);
    setDocDate(row.document_date);
    setMov(row.movement_type);
    setSupplierId(row.supplier_id ?? "");
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
        supplier_id: supplierId || null,
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
      {
        accessorKey: "posting_status",
        header: "Ghi tồn",
        meta: {
          filterKey: "posting_status",
          filterType: "select",
          filterOptions: postingOpts,
        },
        cell: ({ getValue }) => formatPostingStatus(String(getValue())),
      },
      { accessorKey: "supplier_code", header: "Mã NCC" },
      { accessorKey: "supplier_name", header: "Nhà cung cấp" },
      { accessorKey: "line_count", header: "Số dòng" },
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <>
            <DropdownMenuItem asChild>
              <StockVoucherPrintButton
                documentId={row.original.id}
                label="PDF"
                variant="ghost"
                className={dataGridPrintMenuItemButtonClassName}
              />
            </DropdownMenuItem>
            <DataGridMenuEditItem onSelect={() => openEdit(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDelete(row.original)}>Xóa</DataGridMenuDeleteItem>
            <DataGridMenuLinkItem href={"/inventory/documents/" + row.original.id}>Dòng</DataGridMenuLinkItem>
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
          { label: "Ghi tồn", value: formatPostingStatus(row.posting_status) },
          { label: "Mã NCC", value: row.supplier_code },
          { label: "Nhà cung cấp", value: row.supplier_name },
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
        title="Phiếu nhập / xuất kho Vật tư & Phôi"
        columns={columns}
        list={listStockDocuments}
        reloadSignal={gridReload}
        renderRowDetail={renderStockDocDetail}
        rowDetailTitle={(r) => "Phiếu " + r.document_number}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" type="button" onClick={openRequestDialog}>
              Yêu cầu xuất kho
            </Button>
            <Button variant="primary" type="button" onClick={openCreate}>
              Thêm phiếu
            </Button>
          </div>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa phiếu" : "Thêm phiếu"}</DialogTitle>
            <DialogDescription>Chi tiết vật tư/phôi sứ thêm ở trang dòng phiếu.</DialogDescription>
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
              <Label htmlFor="sd-p">Nhà cung cấp (tuỳ chọn)</Label>
              <Select id="sd-p" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">—</option>
                {suppliers.map((p) => (
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
      <Dialog open={openRequest} onOpenChange={setOpenRequest}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Yêu cầu xuất kho</DialogTitle>
            <DialogDescription>
              Tạo phiếu xuất ở trạng thái nháp (chưa trừ tồn). Sau khi duyệt dòng phiếu, mở chi tiết và bấm «Ghi nhận tồn
              kho».
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitRequest(e)} className="grid gap-4 sm:grid-cols-2">
            {reqErr ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{reqErr}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ycxk-p">Sản phẩm</Label>
              <Select
                id="ycxk-p"
                value={reqProductId}
                onChange={(e) => setReqProductId(e.target.value)}
                required
              >
                <option value="">Chọn…</option>
                {reqProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ycxk-q">Số lượng</Label>
              <Input
                id="ycxk-q"
                type="number"
                min={0.0001}
                step={0.0001}
                value={reqQty}
                onChange={(e) => setReqQty(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ycxk-r">Lý do (tuỳ chọn)</Label>
              <Input id="ycxk-r" value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpenRequest(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" disabled={pending}>
                {pending ? "Đang tạo…" : "Tạo và mở phiếu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
