"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StockVoucherPrintButton } from "@/components/shared/reports/stock-voucher-print-button";
import { Card } from "@/components/ui/card";
import { DetailPreview } from "@/components/ui/detail-preview";
import { formatMovement, formatPostingStatus } from "@/lib/format/labels";
import { formatDate } from "@/lib/format/date";
import { listProductPicker } from "@/lib/actions/products";
import { getProductSupplyMatch, type ProductSupplyMatch } from "@/lib/actions/product-suppliers";
import {
  createStockLine,
  deleteStockLine,
  getStockDocumentById,
  listStockLines,
  postStockDocument,
  updateStockLine,
  type StockDocumentHeader,
  type StockLineRow,
} from "@/lib/actions/stock";

export function InventoryDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [products, setProducts] = React.useState<
    { id: string; code: string; name: string; unit_price: number; product_usage?: string }[]
  >([]);
  const [supplyHint, setSupplyHint] = React.useState<ProductSupplyMatch | null>(null);
  /** Chỉ tự điền đơn giá từ danh mục NCC khi thêm dòng mới, không ghi đè khi sửa dòng. */
  const allowInboundPriceAuto = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StockLineRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [productId, setProductId] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [price, setPrice] = React.useState("0");
  const [docHeader, setDocHeader] = React.useState<StockDocumentHeader | null>(null);
  const [headerLoading, setHeaderLoading] = React.useState(true);
  const [postPending, setPostPending] = React.useState(false);
  const [postMsg, setPostMsg] = React.useState<string | null>(null);

  const reloadHeader = React.useCallback(async () => {
    const h = await getStockDocumentById(id);
    setDocHeader(h);
  }, [id]);

  React.useEffect(() => {
    let cancelled = false;
    setHeaderLoading(true);
    void reloadHeader()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHeaderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadHeader]);

  React.useEffect(() => {
    void listProductPicker({ forInventory: true }).then(setProducts).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!productId || !docHeader || docHeader.movement_type !== "inbound") {
      setSupplyHint(null);
      return;
    }
    let cancelled = false;
    void getProductSupplyMatch(productId, docHeader.supplier_id)
      .then((m) => {
        if (cancelled) return;
        setSupplyHint(m);
        if (
          allowInboundPriceAuto.current &&
          docHeader.supplier_id &&
          m.has_link_for_document_supplier &&
          m.reference_purchase_price != null
        ) {
          setPrice(String(m.reference_purchase_price));
        }
      })
      .catch(() => {
        if (!cancelled) setSupplyHint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, docHeader?.supplier_id, docHeader?.movement_type]);

  const onPostStock = async () => {
    setPostPending(true);
    setPostMsg(null);
    try {
      await postStockDocument(id);
      await reloadHeader();
      bumpGrid();
      router.refresh();
    } catch (e2) {
      setPostMsg(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPostPending(false);
    }
  };

  const listLines = React.useCallback(
    async (args: import("@/components/shared/data-grid/excel-data-grid").ListArgs) => {
      const rows = await listStockLines(id);
      let filtered = rows;
      const g = args.globalSearch.trim().toLowerCase();
      if (g) {
        filtered = filtered.filter(
          (r) =>
            (r.product_code ?? "").toLowerCase().includes(g) ||
            (r.product_name ?? "").toLowerCase().includes(g),
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
    setQty("1");
    setPrice("0");
    setErr(null);
  };

  const openCreate = () => {
    allowInboundPriceAuto.current = true;
    reset();
    setOpen(true);
  };

  const openEdit = (row: StockLineRow) => {
    allowInboundPriceAuto.current = false;
    setEditing(row);
    setProductId(row.product_id);
    setQty(String(row.quantity));
    setPrice(String(row.unit_price));
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const payload = {
        document_id: id,
        product_id: productId,
        quantity: Number(qty),
        unit_price: Number(price),
      };
      if (editing) await updateStockLine(editing.id, payload);
      else await createStockLine(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (row: StockLineRow) => {
    if (!confirm("Xóa dòng?")) return;
    try {
      await deleteStockLine(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    }
  };

  const columns = React.useMemo<ColumnDef<StockLineRow, unknown>[]>(
    () => [
      { accessorKey: "product_code", header: "Mã NVL" },
      { accessorKey: "product_name", header: "Tên NVL" },
      {
        accessorKey: "quantity",
        header: "Số lượng",
        cell: ({ getValue }) => Number(getValue() ?? 0).toLocaleString("vi-VN"),
      },
      {
        accessorKey: "unit_price",
        header: "Giá",
        cell: ({ getValue }) => Number(getValue() ?? 0).toLocaleString("vi-VN"),
      },
      {
        accessorKey: "line_amount",
        header: "Thành tiền",
        cell: ({ getValue }) => Number(getValue() ?? 0).toLocaleString("vi-VN"),
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

  const renderStockLineDetail = React.useCallback((row: StockLineRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Mã SP", value: row.product_code },
          { label: "Tên SP", value: row.product_name },
          { label: "Số lượng", value: row.quantity },
          { label: "Đơn giá", value: row.unit_price },
          { label: "Thành tiền", value: row.line_amount },
          { label: "ID dòng", value: row.id, span: "full" },
          { label: "Tạo lúc", value: formatDate(row.created_at) },
        ]}
      />
    );
  }, []);

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/inventory/documents">← Phiếu kho</Link>
      </Button>
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--on-surface)]">Chi tiết phiếu</h1>
            {headerLoading ? (
              <p className="text-sm text-[var(--on-surface-muted)]">Đang tải thông tin phiếu…</p>
            ) : docHeader ? (
              <p className="text-sm text-[var(--on-surface-muted)]">
                <span className="font-medium text-[var(--on-surface)]">{docHeader.document_number}</span>
                {" · "}
                {docHeader.document_date}
                {" · "}
                {formatMovement(docHeader.movement_type)}
                {" · "}
                {formatPostingStatus(docHeader.posting_status)}
                {docHeader.supplier_code
                  ? " · NCC: " + docHeader.supplier_code + (docHeader.supplier_name ? " (" + docHeader.supplier_name + ")" : "")
                  : ""}
              </p>
            ) : (
              <p className="text-sm text-[#b91c1c]">Không tìm thấy phiếu.</p>
            )}
            <p className="text-xs text-[var(--on-surface-muted)]">ID: {id}</p>
          </div>
          <StockVoucherPrintButton documentId={id} label="In / lưu PDF (trình duyệt)" />
        </div>
        {docHeader?.posting_status === "draft" ? (
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--primary)_28%,transparent)] bg-[var(--surface-muted)] p-4 space-y-3">
            <p className="text-sm leading-relaxed text-[var(--on-surface)]">
              Đây là <strong>yêu cầu</strong>: dòng phiếu đã lưu nhưng <strong>chưa trừ / cộng tồn kho</strong>. Khi đủ điều
              kiện (đủ tồn với phiếu xuất), bấm nút bên dưới để ghi nhận — tồn kho cập nhật theo view Nhập − Xuất.
            </p>
            {postMsg ? <p className="text-sm text-[#b91c1c]">{postMsg}</p> : null}
            <Button
              variant="primary"
              type="button"
              disabled={postPending}
              onClick={() => void onPostStock()}
            >
              {postPending ? "Đang ghi nhận…" : "Ghi nhận tồn kho"}
            </Button>
          </div>
        ) : null}
      </Card>
      <ExcelDataGrid<StockLineRow>
        moduleId={"stock_lines_" + id}
        title="Dòng phiếu"
        columns={columns}
        list={listLines}
        reloadSignal={gridReload}
        renderRowDetail={renderStockLineDetail}
        rowDetailTitle={(r) => "Dòng " + (r.product_code ?? r.id.slice(0, 8))}
        toolbarExtra={
          <Button variant="primary" type="button" onClick={openCreate}>
            Thêm dòng
          </Button>
        }
        getRowId={(r) => r.id}
      />
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            allowInboundPriceAuto.current = false;
            reset();
          }
        }}
      >
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa dòng" : "Thêm dòng"}</DialogTitle>
            <DialogDescription>Chọn SP, số lượng và đơn giá.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="sl-p">Sản phẩm</Label>
              <Select id="sl-p" value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">Chọn…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                    {p.product_usage === "inventory" ? " (NVL)" : p.product_usage === "sales" ? " (bán)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            {docHeader?.movement_type === "inbound" && docHeader.supplier_id && supplyHint ? (
              <div className="rounded-lg border border-[var(--border-ghost)] bg-[var(--surface-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--on-surface-muted)] sm:col-span-2">
                {!supplyHint.has_link_for_document_supplier ? (
                  <p className="m-0 text-[#b91c1c]">
                    Chưa cấp NCC <strong>{docHeader.supplier_code ?? ""}</strong> cho vật tư này trong danh mục
                    (Xem → NCC &amp; kho). Công nợ / đối soát vẫn theo NCC trên phiếu.
                  </p>
                ) : (
                  <p className="m-0">
                    Đã khớp danh mục NCC.
                    {supplyHint.supplier_sku ? " Mã hàng NCC: " + supplyHint.supplier_sku + "." : ""}
                  </p>
                )}
                {supplyHint.primary_supplier_id &&
                docHeader.supplier_id &&
                supplyHint.primary_supplier_id !== docHeader.supplier_id &&
                supplyHint.primary_supplier_code ? (
                  <p className="mt-1 m-0">
                    NCC chính của vật tư: <strong>{supplyHint.primary_supplier_code}</strong> (khác NCC trên phiếu).
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="sl-q">Số lượng</Label>
              <Input
                id="sl-q"
                type="number"
                min={0.0001}
                step={0.0001}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sl-pr">Đơn giá</Label>
              <Input
                id="sl-pr"
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
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
