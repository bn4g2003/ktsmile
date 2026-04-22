"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import { Button } from "@/components/ui/button";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailPreview } from "@/components/ui/detail-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { listProductPicker } from "@/lib/actions/products";
import { listMaterialPicker } from "@/lib/actions/materials";
import { createOutboundStockRequest, listProductStock, type ProductStockRow } from "@/lib/actions/stock";

type StockTab = "nvl" | "sp";

export function StockLevelsPage({ initialTab = "nvl" }: { initialTab?: StockTab }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<StockTab>(initialTab);
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [openRequest, setOpenRequest] = React.useState(false);
  const [reqProducts, setReqProducts] = React.useState<
    { id: string; code: string; name: string; unit_price: number; product_usage?: string }[]
  >([]);
  const [reqProductId, setReqProductId] = React.useState("");
  const [reqQty, setReqQty] = React.useState("1");
  const [reqReason, setReqReason] = React.useState("");
  const [reqErr, setReqErr] = React.useState<string | null>(null);
  const [reqPending, setReqPending] = React.useState(false);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const setTabAndUrl = React.useCallback(
    (next: StockTab) => {
      setTab(next);
      const path = next === "sp" ? "/inventory/stock?tab=sp" : "/inventory/stock";
      router.replace(path, { scroll: false });
    },
    [router],
  );

  React.useEffect(() => {
    if (!openRequest) return;
    if (tab === "nvl") {
      void listMaterialPicker().then(setReqProducts).catch(() => {});
      return;
    }
    void listProductPicker({ forSales: true }).then(setReqProducts).catch(() => {});
  }, [openRequest, tab]);

  const openRequestFromToolbar = React.useCallback(() => {
    setReqProductId("");
    setReqQty("1");
    setReqReason("");
    setReqErr(null);
    setOpenRequest(true);
  }, []);

  const openRequestFromRow = React.useCallback((row: ProductStockRow) => {
    setReqProductId(row.product_id);
    setReqQty("1");
    setReqReason("");
    setReqErr(null);
    setOpenRequest(true);
  }, []);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqProductId) {
      setReqErr("Chọn sản phẩm.");
      return;
    }
    setReqPending(true);
    setReqErr(null);
    try {
      const { documentId } = await createOutboundStockRequest({
        document_date: new Date().toISOString().slice(0, 10),
        reason: reqReason.trim() || "Xuất từ tồn kho",
        lines: [
          {
            product_id: reqProductId,
            quantity: Number(reqQty),
          },
        ],
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

  const renderStockDetail = React.useCallback((row: ProductStockRow) => {
    const usage =
      row.product_usage === "inventory"
        ? "Kho / NVL"
        : row.product_usage === "sales"
          ? "Bán / labo"
          : "Kho + bán";
    const ncc =
      row.primary_supplier_code != null
        ? row.primary_supplier_code + (row.primary_supplier_name ? " — " + row.primary_supplier_name : "")
        : "—";
    return (
      <DetailPreview
        fields={[
          { label: "Mã SP", value: row.product_code },
          { label: "Tên SP", value: row.product_name },
          { label: "ĐVT", value: row.unit },
          { label: "Phạm vi", value: usage },
          { label: "NCC chính (mua)", value: ncc, span: "full" },
          { label: "Tổng nhập", value: row.total_inbound },
          { label: "Tổng xuất", value: row.total_outbound },
          { label: "Tồn trong kỳ", value: row.quantity_on_hand },
          { label: "Product ID", value: row.product_id, span: "full" },
        ]}
      />
    );
  }, []);

  const baseColumns = React.useMemo<ColumnDef<ProductStockRow, unknown>[]>(
    () => [
      { accessorKey: "product_code", header: "Mã SP", meta: { filterKey: "product_code", filterType: "text" } },
      { accessorKey: "product_name", header: "Tên SP", meta: { filterKey: "product_name", filterType: "text" } },
      { accessorKey: "unit", header: "ĐVT", meta: { filterKey: "unit", filterType: "text" } },
      {
        accessorKey: "product_usage",
        header: "Phạm vi",
        cell: ({ getValue }) => {
          const u = getValue() as string;
          if (u === "inventory") return "NVL";
          if (u === "sales") return "Bán";
          return "Cả hai";
        },
      },
      {
        id: "ncc",
        accessorFn: (r) => r.primary_supplier_code ?? "",
        header: "NCC chính",
        cell: ({ row }) => row.original.primary_supplier_code ?? "—",
      },
      {
        accessorKey: "total_inbound",
        header: "Tổng nhập",
        cell: ({ getValue }) => (
          <span className="font-semibold text-emerald-600">{Number(getValue() ?? 0).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "total_outbound",
        header: "Tổng xuất",
        cell: ({ getValue }) => (
          <span className="font-semibold text-rose-600">{Number(getValue() ?? 0).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "quantity_on_hand",
        header: "Tồn trong kỳ",
        cell: ({ getValue }) => (
          <span className="font-bold text-[var(--primary)]">{Number(getValue() ?? 0).toLocaleString()}</span>
        ),
      },
    ],
    [],
  );

  const outboundActionCol = React.useMemo<ColumnDef<ProductStockRow, unknown>>(
    () => ({
      id: "ycxk",
      header: "YCXK",
      enableHiding: false,
      meta: { filterType: "none" },
      cell: ({ row }) => (
        <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => openRequestFromRow(row.original)}>
          Yêu cầu xuất
        </Button>
      ),
    }),
    [openRequestFromRow],
  );

  const columns = React.useMemo<ColumnDef<ProductStockRow, unknown>[]>(
    () => [...baseColumns, outboundActionCol],
    [baseColumns, outboundActionCol],
  );

  const gridTitle = tab === "sp" ? "Kho SP — tồn sản phẩm" : "Kho NVL — tồn vật tư & phôi";

  return (
    <>
      <div className="mb-4">
        <DetailTabStrip
          items={[
            { id: "nvl", label: "Kho NVL" },
            { id: "sp", label: "Kho SP" },
          ]}
          value={tab}
          onChange={(id) => setTabAndUrl(id as StockTab)}
        />
      </div>
      <ExcelDataGrid<ProductStockRow>
        key={tab}
        moduleId={tab === "sp" ? "v_product_stock_sp" : "v_product_stock_nvl"}
        title={gridTitle}
        columns={columns}
        list={listProductStock}
        prependFilters={{ stock_segment: tab }}
        reloadSignal={gridReload}
        getRowId={(r) => r.product_id}
        renderRowDetail={renderStockDetail}
        rowDetailTitle={(r) => "Tồn " + r.product_code}
        toolbarExtra={
          <Button variant="secondary" type="button" onClick={openRequestFromToolbar}>
            Yêu cầu xuất kho…
          </Button>
        }
      />
      <Dialog open={openRequest} onOpenChange={setOpenRequest}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{tab === "sp" ? "Yêu cầu xuất kho sản phẩm" : "Yêu cầu xuất kho vật tư"}</DialogTitle>
            <DialogDescription>
              Phiếu xuất được tạo ở trạng thái nháp; tồn kho vật tư/phôi chỉ thay đổi sau khi ghi nhận trên trang chi tiết phiếu. Thành phẩm xuất bán trực tiếp không qua kho này.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitRequest(e)} className="grid gap-4 sm:grid-cols-2">
            {reqErr ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{reqErr}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="stk-ycxk-p">Sản phẩm</Label>
              <Select
                id="stk-ycxk-p"
                value={reqProductId}
                onChange={(e) => setReqProductId(e.target.value)}
                required
              >
                <option value="">Chọn…</option>
                {reqProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                    {p.product_usage === "inventory" ? " (NVL)" : p.product_usage === "sales" ? " (SP)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stk-ycxk-q">Số lượng</Label>
              <Input
                id="stk-ycxk-q"
                type="number"
                min={0.0001}
                step={0.0001}
                value={reqQty}
                onChange={(e) => setReqQty(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stk-ycxk-r">Lý do (tuỳ chọn)</Label>
              <Input id="stk-ycxk-r" value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpenRequest(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" disabled={reqPending}>
                {reqPending ? "Đang tạo…" : "Tạo và mở phiếu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
