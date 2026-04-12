"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { LabOrderStatusQuickDialog } from "@/components/modules/orders/lab-order-status-quick-dialog";
import { LabOrderPrintButton } from "@/components/shared/reports/lab-order-print-button";
import { Card } from "@/components/ui/card";
import { DetailPreview } from "@/components/ui/detail-preview";
import { listProductPicker } from "@/lib/actions/products";
import {
  createLabOrderLine,
  deleteLabOrderLine,
  getLabOrder,
  getPartnerDefaultDiscount,
  getSuggestedLinePrice,
  listLabOrderLines,
  updateLabOrderLine,
  updateLabOrderStatus,
  type LabOrderLineRow,
  type LabOrderRow,
} from "@/lib/actions/lab-orders";
import { formatOrderStatus, orderStatusBadgeClassName } from "@/lib/format/labels";

export function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [gridReload, setGridReload] = React.useState(0);
  const [header, setHeader] = React.useState<Record<string, unknown> | null>(null);
  const [products, setProducts] = React.useState<
    { id: string; code: string; name: string; unit_price: number }[]
  >([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LabOrderLineRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [productId, setProductId] = React.useState("");
  const [tooth, setTooth] = React.useState("");
  const [shade, setShade] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [price, setPrice] = React.useState("0");
  const [disc, setDisc] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quickStatus, setQuickStatus] = React.useState<LabOrderRow["status"]>("draft");
  const [quickPending, setQuickPending] = React.useState(false);
  const [quickErr, setQuickErr] = React.useState<string | null>(null);

  const loadHeader = React.useCallback(async () => {
    const h = await getLabOrder(id);
    setHeader(h);
  }, [id]);

  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    void loadHeader();
    router.refresh();
  }, [router, loadHeader]);

  React.useEffect(() => {
    void loadHeader();
    void listProductPicker().then(setProducts).catch(() => {});
  }, [loadHeader]);

  const partnerId = (header?.partner_id as string) ?? "";

  const suggestPrice = React.useCallback(async () => {
    if (!partnerId || !productId) return;
    const [p, d] = await Promise.all([
      getSuggestedLinePrice(partnerId, productId),
      getPartnerDefaultDiscount(partnerId),
    ]);
    setPrice(String(p));
    setDisc(String(d));
  }, [partnerId, productId]);

  React.useEffect(() => {
    void suggestPrice();
  }, [suggestPrice]);

  const listLines = React.useCallback(
    async (args: import("@/components/shared/data-grid/excel-data-grid").ListArgs) => {
      const rows = await listLabOrderLines(id);
      let filtered = rows;
      const g = args.globalSearch.trim().toLowerCase();
      if (g) {
        filtered = filtered.filter(
          (r) =>
            r.tooth_positions.toLowerCase().includes(g) ||
            (r.shade ?? "").toLowerCase().includes(g) ||
            (r.product_code ?? "").toLowerCase().includes(g),
        );
      }
      const total = filtered.length;
      const from = (args.page - 1) * args.pageSize;
      return { rows: filtered.slice(from, from + args.pageSize), total };
    },
    [id],
  );

  const reset = () => {
    setEditing(null);
    setProductId(products[0]?.id ?? "");
    setTooth("");
    setShade("");
    setQty("1");
    setPrice("0");
    setDisc("0");
    setNotes("");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: LabOrderLineRow) => {
    setEditing(row);
    setProductId(row.product_id);
    setTooth(row.tooth_positions);
    setShade(row.shade ?? "");
    setQty(String(row.quantity));
    setPrice(String(row.unit_price));
    setDisc(String(row.discount_percent));
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
        order_id: id,
        product_id: productId,
        tooth_positions: tooth.trim(),
        shade: shade.trim() || null,
        quantity: Number(qty),
        unit_price: Number(price),
        discount_percent: Number(disc) || 0,
        notes: notes.trim() || null,
      };
      if (editing) await updateLabOrderLine(editing.id, payload);
      else await createLabOrderLine(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (row: LabOrderLineRow) => {
    if (!confirm("Xóa dòng này?")) return;
    try {
      await deleteLabOrderLine(row.id, id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    }
  };

  const columns = React.useMemo<ColumnDef<LabOrderLineRow, unknown>[]>(
    () => [
      { accessorKey: "product_code", header: "Mã SP" },
      { accessorKey: "product_name", header: "Tên SP" },
      { accessorKey: "tooth_positions", header: "Vị trí răng" },
      { accessorKey: "shade", header: "Màu" },
      { accessorKey: "quantity", header: "SL" },
      { accessorKey: "unit_price", header: "Đơn giá" },
      { accessorKey: "discount_percent", header: "CK %" },
      { accessorKey: "line_amount", header: "Thành tiền" },
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

  const renderLineDetail = React.useCallback((row: LabOrderLineRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Mã SP", value: row.product_code },
          { label: "Tên SP", value: row.product_name },
          { label: "Vị trí răng", value: row.tooth_positions },
          { label: "Màu", value: row.shade },
          { label: "Số lượng", value: row.quantity },
          { label: "Đơn giá", value: row.unit_price },
          { label: "CK %", value: row.discount_percent },
          { label: "Thành tiền", value: row.line_amount },
          { label: "Ghi chú", value: row.notes, span: "full" },
          { label: "ID dòng", value: row.id, span: "full" },
          { label: "Tạo lúc", value: row.created_at },
        ]}
      />
    );
  }, []);

  const partners = header?.partners as { code?: string; name?: string } | null;
  const orderStatus = (header?.status as LabOrderRow["status"] | undefined) ?? "draft";
  const orderNumberStr = header ? String(header.order_number) : "";

  const openQuickStatus = () => {
    setQuickStatus(orderStatus);
    setQuickErr(null);
    setQuickOpen(true);
  };

  const saveQuickStatus = async () => {
    setQuickPending(true);
    setQuickErr(null);
    try {
      await updateLabOrderStatus(id, quickStatus);
      setQuickOpen(false);
      await loadHeader();
      bumpGrid();
      router.refresh();
    } catch (e2) {
      setQuickErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setQuickPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" asChild>
          <Link href="/orders">← Danh sách đơn</Link>
        </Button>
      </div>
      {header ? (
        <Card className="space-y-2 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--on-surface)]">
                Đơn {String(header.order_number)}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className={orderStatusBadgeClassName(orderStatus)} title={formatOrderStatus(orderStatus)}>
                  {formatOrderStatus(orderStatus)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={openQuickStatus}
                >
                  Đổi trạng thái
                </Button>
              </div>
              <p className="text-sm text-[var(--on-surface-muted)]">
                Khách: {partners?.code} — {partners?.name} · BN: {String(header.patient_name)} · Ngày nhận:{" "}
                {String(header.received_at)}
              </p>
            </div>
            <LabOrderPrintButton orderId={id} label="In / lưu PDF (trình duyệt)" />
          </div>
        </Card>
      ) : (
        <p className="text-[var(--on-surface-muted)]">Đang tải…</p>
      )}

      <ExcelDataGrid<LabOrderLineRow>
        moduleId={"lab_order_lines_" + id}
        title="Dòng đơn hàng"
        columns={columns}
        list={listLines}
        reloadSignal={gridReload}
        renderRowDetail={renderLineDetail}
        rowDetailTitle={(r) => "Dòng " + (r.product_code ?? r.id.slice(0, 8))}
        toolbarExtra={
          <Button variant="primary" type="button" onClick={openCreate}>
            Thêm dòng
          </Button>
        }
        getRowId={(r) => r.id}
      />

      <LabOrderStatusQuickDialog
        open={quickOpen}
        onOpenChange={(v) => {
          setQuickOpen(v);
          if (!v) setQuickErr(null);
        }}
        orderLabel={orderNumberStr}
        value={quickStatus}
        onValueChange={setQuickStatus}
        onConfirm={saveQuickStatus}
        pending={quickPending}
        error={quickErr}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa dòng" : "Thêm dòng"}</DialogTitle>
            <DialogDescription>Giá gợi ý theo bảng giá KH / giá SP.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ln-p">Sản phẩm</Label>
              <Select id="ln-p" value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">Chọn…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-tooth">Vị trí răng</Label>
              <Input id="ln-tooth" value={tooth} onChange={(e) => setTooth(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-shade">Màu</Label>
              <Input id="ln-shade" value={shade} onChange={(e) => setShade(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-qty">Số lượng</Label>
              <Input
                id="ln-qty"
                type="number"
                min={0.01}
                step={0.01}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-price">Đơn giá</Label>
              <Input
                id="ln-price"
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ln-disc">Chiết khấu %</Label>
              <Input
                id="ln-disc"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={disc}
                onChange={(e) => setDisc(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ln-notes">Ghi chú</Label>
              <Textarea id="ln-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
