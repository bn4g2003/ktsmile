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
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Textarea } from "@/components/ui/textarea";
import { StockVoucherPrintButton } from "@/components/shared/reports/stock-voucher-print-button";
import { listSupplierPicker } from "@/lib/actions/suppliers";
import { formatMovement, formatPostingStatus } from "@/lib/format/labels";
import { formatDate } from "@/lib/format/date";
import { listMaterialPicker } from "@/lib/actions/materials";
import {
  createInboundMaterialPurchase,
  createOutboundStockRequest,
  createStockDocument,
  deleteStockDocument,
  listStockDocuments,
  updateStockDocument,
  type StockDocumentRow,
} from "@/lib/actions/stock";
import {
  listSupplierPurchasableProducts,
  type SupplierPurchasableProduct,
} from "@/lib/actions/product-suppliers";

const movOpts = [
  { value: "inbound", label: "Nhập kho" },
  { value: "outbound", label: "Xuất kho" },
];

const postingOpts = [
  { value: "draft", label: formatPostingStatus("draft") },
  { value: "posted", label: formatPostingStatus("posted") },
];

type NvlFormLine = { key: string; product_id: string; qty: string; price: string };
type OutboundFormLine = { key: string; product_id: string; qty: string };
type InventoryDocTab = "inbound" | "outbound";

export function InventoryDocumentsPage({ initialTab = "inbound" }: { initialTab?: InventoryDocTab }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<InventoryDocTab>(initialTab);
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
  const [reqDocDate, setReqDocDate] = React.useState("");
  const [reqReason, setReqReason] = React.useState("");
  const [reqNotes, setReqNotes] = React.useState("");
  const [reqLines, setReqLines] = React.useState<OutboundFormLine[]>([]);
  const [reqErr, setReqErr] = React.useState<string | null>(null);
  const [reqPending, setReqPending] = React.useState(false);

  const [openNvlInbound, setOpenNvlInbound] = React.useState(false);
  const [nvlSupplierId, setNvlSupplierId] = React.useState("");
  const [nvlDocDate, setNvlDocDate] = React.useState("");
  const [nvlNotes, setNvlNotes] = React.useState("");
  const [nvlCatalog, setNvlCatalog] = React.useState<SupplierPurchasableProduct[]>([]);
  const [nvlLines, setNvlLines] = React.useState<NvlFormLine[]>([]);
  const [nvlErr, setNvlErr] = React.useState<string | null>(null);
  const [nvlPending, setNvlPending] = React.useState(false);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const setTabAndUrl = React.useCallback(
    (next: InventoryDocTab) => {
      setTab(next);
      const path = next === "outbound" ? "/inventory/documents?tab=outbound" : "/inventory/documents";
      router.replace(path, { scroll: false });
    },
    [router],
  );

  React.useEffect(() => {
    void listSupplierPicker().then(setSuppliers).catch(() => { });
  }, []);

  React.useEffect(() => {
    if (!openRequest) return;
    void listMaterialPicker().then(setReqProducts).catch(() => { });
  }, [openRequest]);

  React.useEffect(() => {
    if (!openNvlInbound || !nvlSupplierId) {
      setNvlCatalog([]);
      return;
    }
    let cancelled = false;
    void listSupplierPurchasableProducts(nvlSupplierId)
      .then((rows) => {
        if (!cancelled) setNvlCatalog(rows);
      })
      .catch(() => {
        if (!cancelled) setNvlCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [openNvlInbound, nvlSupplierId]);

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
    setReqDocDate(new Date().toISOString().slice(0, 10));
    setReqReason("");
    setReqNotes("");
    setReqLines([{ key: newNvlLineKey(), product_id: "", qty: "1" }]);
    setReqErr(null);
    setOpenRequest(true);
  };

  const newNvlLineKey = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "nvl-" + String(Date.now()) + "-" + String(Math.random()).slice(2, 8);

  const openNvlInboundDialog = () => {
    setNvlSupplierId(suppliers[0]?.id ?? "");
    setNvlDocDate(new Date().toISOString().slice(0, 10));
    setNvlNotes("");
    setNvlErr(null);
    setNvlLines([{ key: newNvlLineKey(), product_id: "", qty: "1", price: "" }]);
    setOpenNvlInbound(true);
  };

  const updateNvlLine = React.useCallback((key: string, patch: Partial<NvlFormLine>) => {
    setNvlLines((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const addNvlLine = () => {
    setNvlLines((prev) => [...prev, { key: newNvlLineKey(), product_id: "", qty: "1", price: "" }]);
  };

  const removeNvlLine = (key: string) => {
    setNvlLines((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const submitNvlInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nvlSupplierId) {
      setNvlErr("Chọn nhà cung cấp.");
      return;
    }
    if (nvlLines.some((l) => !l.product_id.trim())) {
      setNvlErr("Chọn vật tư cho mọi dòng hoặc xóa dòng trống.");
      return;
    }
    const linesPayload = nvlLines.map((l) => ({
      product_id: l.product_id,
      quantity: Number(l.qty),
      unit_price: l.price.trim() === "" ? null : Number(l.price),
    }));
    if (linesPayload.length === 0) {
      setNvlErr("Thêm ít nhất một dòng vật tư.");
      return;
    }
    for (const l of linesPayload) {
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
        setNvlErr("Số lượng mỗi dòng phải lớn hơn 0.");
        return;
      }
      if (l.unit_price != null && (!Number.isFinite(l.unit_price) || l.unit_price < 0)) {
        setNvlErr("Đơn giá không hợp lệ.");
        return;
      }
    }
    setNvlPending(true);
    setNvlErr(null);
    try {
      const { documentId } = await createInboundMaterialPurchase({
        supplier_id: nvlSupplierId,
        document_date: nvlDocDate,
        notes: nvlNotes.trim() || null,
        lines: linesPayload,
      });
      setOpenNvlInbound(false);
      bumpGrid();
      router.push("/inventory/documents/" + documentId);
    } catch (e2) {
      setNvlErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setNvlPending(false);
    }
  };

  const updateReqLine = React.useCallback((key: string, patch: Partial<OutboundFormLine>) => {
    setReqLines((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const addReqLine = () => {
    setReqLines((prev) => [...prev, { key: newNvlLineKey(), product_id: "", qty: "1" }]);
  };

  const removeReqLine = (key: string) => {
    setReqLines((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqLines.some((l) => !l.product_id.trim())) {
      setReqErr("Chọn vật tư cho mọi dòng hoặc xóa dòng trống.");
      return;
    }
    const linesPayload = reqLines.map((l) => ({
      product_id: l.product_id,
      quantity: Number(l.qty),
    }));
    if (linesPayload.length === 0) {
      setReqErr("Thêm ít nhất một dòng vật tư.");
      return;
    }
    for (const l of linesPayload) {
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
        setReqErr("Số lượng mỗi dòng phải lớn hơn 0.");
        return;
      }
    }
    setReqPending(true);
    setReqErr(null);
    try {
      const { documentId } = await createOutboundStockRequest({
        document_date: reqDocDate,
        reason: reqReason.trim() || null,
        notes: reqNotes.trim() || null,
        lines: linesPayload,
      });
      setOpenRequest(false);
      bumpGrid();
      router.push("/inventory/documents/" + documentId);
    } catch (e2) {
      setReqErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setReqPending(false);
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
        meta: { filterKey: "document_date", filterType: "date_range" },
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
      { accessorKey: "supplier_code", header: "Mã NCC", meta: { filterKey: "supplier_code", filterType: "text" } },
      { accessorKey: "supplier_name", header: "Nhà cung cấp", meta: { filterKey: "supplier_name", filterType: "text" } },
      {
        accessorKey: "product_names",
        header: "Tên NVL",
        cell: ({ getValue }) => {
          const val = getValue();
          return val ? String(val) : "—";
        },
      },
      {
        accessorKey: "product_prices",
        header: "Giá",
        cell: ({ getValue }) => {
          const val = getValue();
          return val ? String(val) : "—";
        },
      },
      {
        accessorKey: "total_quantity",
        header: "Tổng SL",
        cell: ({ getValue }) => Number(getValue() ?? 0).toLocaleString("vi-VN"),
      },
      {
        accessorKey: "total_amount",
        header: "Tổng tiền",
        size: 120,
        cell: ({ getValue }) => (
          <div className="text-right font-semibold tabular-nums">
            {Number(getValue() ?? 0).toLocaleString("vi-VN")}
          </div>
        ),
      },
      { accessorKey: "line_count", header: "Số dòng", size: 90 },
      { accessorKey: "reason", header: "Lý do / Mô tả", size: 200, meta: { filterKey: "reason", filterType: "text" } },
      { accessorKey: "notes", header: "Ghi chú", size: 200 },
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
          { label: "Tên NVL", value: row.product_names || "—", span: "full" },
          { label: "Giá", value: row.product_prices || "—", span: "full" },
          { label: "Số dòng", value: row.line_count },
          { label: "Tổng số lượng", value: row.total_quantity.toLocaleString("vi-VN") },
          { label: "Tổng tiền", value: row.total_amount.toLocaleString("vi-VN") },
          { label: "Lý do", value: row.reason, span: "full" },
          { label: "Ghi chú", value: row.notes, span: "full" },
          { label: "ID", value: row.id, span: "full" },
          { label: "Tạo lúc", value: formatDate(row.created_at) },
          { label: "Cập nhật", value: formatDate(row.updated_at) },
        ]}
      />
    );
  }, []);

  return (
    <>
      <div className="mb-4">
        <DetailTabStrip
          items={[
            { id: "inbound", label: "Kho nhập (NCC/NVL)" },
            { id: "outbound", label: "Kho xuất" },
          ]}
          value={tab}
          onChange={(id) => setTabAndUrl(id as InventoryDocTab)}
        />
      </div>
      <ExcelDataGrid<StockDocumentRow>
        key={tab}
        moduleId={tab === "outbound" ? "stock_documents_outbound" : "stock_documents_inbound"}
        title={tab === "outbound" ? "Phiếu xuất kho Vật tư & Phôi" : "Phiếu nhập kho Vật tư & Phôi"}
        columns={columns}
        list={listStockDocuments}
        prependFilters={{ movement_type: tab }}
        reloadSignal={gridReload}
        renderRowDetail={renderStockDocDetail}
        rowDetailTitle={(r) => "Phiếu " + r.document_number}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            {tab === "inbound" ? (
              <>
                <Button variant="primary" type="button" onClick={openNvlInboundDialog}>
                  Nhập NVL từ NCC
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" type="button" onClick={openRequestDialog}>
                  Yêu cầu xuất kho
                </Button>
              </>
            )}
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
        <DialogContent size="xl" className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yêu cầu xuất kho</DialogTitle>
            <DialogDescription>
              Tạo phiếu xuất ở trạng thái nháp (chưa trừ tồn). Sau khi duyệt dòng phiếu, mở chi tiết và bấm «Ghi nhận tồn
              kho».
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitRequest(e)} className="grid gap-4">
            {reqErr ? <p className="text-sm text-[#b91c1c]">{reqErr}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ycxk-date">Ngày phiếu</Label>
                <Input
                  id="ycxk-date"
                  type="date"
                  value={reqDocDate}
                  onChange={(e) => setReqDocDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ycxk-reason">Lý do (tuỳ chọn)</Label>
                <Input id="ycxk-reason" value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="ycxk-notes">Ghi chú phiếu</Label>
                <Textarea id="ycxk-notes" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Dòng vật tư</Label>
                <Button type="button" variant="secondary" size="sm" onClick={addReqLine}>
                  + Thêm dòng
                </Button>
              </div>
              <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-ghost)] p-3">
                {reqLines.map((line) => (
                  <div
                    key={line.key}
                    className="grid gap-2 border-b border-[var(--border-ghost)] pb-3 last:border-b-0 last:pb-0 sm:grid-cols-12 sm:items-end"
                  >
                    <div className="grid gap-1 sm:col-span-8">
                      <Label className="text-xs text-[var(--on-surface-muted)]">Vật tư</Label>
                      <Select
                        value={line.product_id}
                        onChange={(e) => updateReqLine(line.key, { product_id: e.target.value })}
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
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs text-[var(--on-surface-muted)]">SL</Label>
                      <Input
                        type="number"
                        min={0.0001}
                        step={0.0001}
                        value={line.qty}
                        onChange={(e) => updateReqLine(line.key, { qty: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex justify-end sm:col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[#b91c1c]"
                        disabled={reqLines.length <= 1}
                        onClick={() => removeReqLine(line.key)}
                      >
                        Xóa dòng
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpenRequest(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" disabled={reqPending}>
                {reqPending ? "Đang tạo phiếu…" : "Tạo phiếu xuất & mở chi tiết"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openNvlInbound} onOpenChange={setOpenNvlInbound}>
        <DialogContent size="xl" className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nhập hàng nguyên vật liệu từ NCC</DialogTitle>
            <DialogDescription>
              Chỉ chọn được vật tư đã gắn với NCC trong danh mục (SP &amp; NVL → Xem → NCC &amp; kho). Phiếu nhập được
              tạo đã ghi tồn (posted). Đơn giá để trống sẽ lấy giá tham chiếu trong danh mục, nếu không có thì 0.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitNvlInbound(e)} className="grid gap-4">
            {nvlErr ? <p className="text-sm text-[#b91c1c]">{nvlErr}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="nvl-sup">Nhà cung cấp</Label>
                <Select
                  id="nvl-sup"
                  value={nvlSupplierId}
                  onChange={(e) => setNvlSupplierId(e.target.value)}
                  required
                >
                  <option value="">Chọn NCC…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nvl-date">Ngày phiếu</Label>
                <Input
                  id="nvl-date"
                  type="date"
                  value={nvlDocDate}
                  onChange={(e) => setNvlDocDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="nvl-notes">Ghi chú phiếu</Label>
                <Textarea id="nvl-notes" value={nvlNotes} onChange={(e) => setNvlNotes(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Dòng vật tư</Label>
                <Button type="button" variant="secondary" size="sm" onClick={addNvlLine} disabled={!nvlSupplierId}>
                  + Thêm dòng
                </Button>
              </div>
              {!nvlSupplierId ? (
                <p className="text-sm text-[var(--on-surface-muted)]">Chọn NCC để tải danh sách vật tư được phép nhập.</p>
              ) : nvlCatalog.length === 0 ? (
                <p className="text-sm text-[#b91c1c]">
                  Chưa có vật tư nào gắn với NCC này. Vào Danh mục SP &amp; NVL → tab Kho → Xem từng vật tư → NCC
                  &amp; kho để thêm liên kết.
                </p>
              ) : (
                <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-ghost)] p-3">
                  {nvlLines.map((line) => (
                    <div
                      key={line.key}
                      className="grid gap-2 border-b border-[var(--border-ghost)] pb-3 last:border-b-0 last:pb-0 sm:grid-cols-12 sm:items-end"
                    >
                      <div className="grid gap-1 sm:col-span-5">
                        <Label className="text-xs text-[var(--on-surface-muted)]">Vật tư</Label>
                        <Select
                          value={line.product_id}
                          onChange={(e) => {
                            const pid = e.target.value;
                            const ref = nvlCatalog.find((c) => c.product_id === pid);
                            updateNvlLine(line.key, {
                              product_id: pid,
                              price:
                                ref?.reference_purchase_price != null
                                  ? String(ref.reference_purchase_price)
                                  : "",
                            });
                          }}
                          required
                        >
                          <option value="">Chọn…</option>
                          {nvlCatalog.map((p) => (
                            <option key={p.product_id} value={p.product_id}>
                              {p.product_code} — {p.product_name}
                              {p.supplier_sku ? " (" + p.supplier_sku + ")" : ""}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid gap-1 sm:col-span-2">
                        <Label className="text-xs text-[var(--on-surface-muted)]">SL</Label>
                        <Input
                          type="number"
                          min={0.0001}
                          step={0.0001}
                          value={line.qty}
                          onChange={(e) => updateNvlLine(line.key, { qty: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-1 sm:col-span-3">
                        <Label className="text-xs text-[var(--on-surface-muted)]">Đơn giá (để trống = giá DM)</Label>
                        <CurrencyInput
                          value={line.price}
                          onChange={(val) => updateNvlLine(line.key, { price: val })}
                          placeholder="Tự điền"
                        />
                      </div>
                      <div className="flex justify-end sm:col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#b91c1c]"
                          disabled={nvlLines.length <= 1}
                          onClick={() => removeNvlLine(line.key)}
                        >
                          Xóa dòng
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpenNvlInbound(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={nvlPending || !nvlSupplierId || nvlCatalog.length === 0}
              >
                {nvlPending ? "Đang tạo phiếu…" : "Tạo phiếu nhập & mở chi tiết"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
