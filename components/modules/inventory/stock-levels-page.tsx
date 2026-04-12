"use client";

import { type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ExcelDataGrid } from "@/components/shared/data-grid/excel-data-grid";
import { Button } from "@/components/ui/button";
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
import { createOutboundStockRequest, listProductStock, type ProductStockRow } from "@/lib/actions/stock";

export function StockLevelsPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [openRequest, setOpenRequest] = React.useState(false);
  const [reqProducts, setReqProducts] = React.useState<
    { id: string; code: string; name: string; unit_price: number }[]
  >([]);
  const [reqProductId, setReqProductId] = React.useState("");
  const [reqQty, setReqQty] = React.useState("1");
  const [reqReason, setReqReason] = React.useState("");
  const [reqErr, setReqErr] = React.useState<string | null>(null);
  const [reqPending, setReqPending] = React.useState(false);

  React.useEffect(() => {
    if (!openRequest) return;
    void listProductPicker().then(setReqProducts).catch(() => {});
  }, [openRequest]);

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
      setReqPending(false);
    }
  };

  const renderStockDetail = React.useCallback((row: ProductStockRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Mã SP", value: row.product_code },
          { label: "Tên SP", value: row.product_name },
          { label: "ĐVT", value: row.unit },
          { label: "Tồn", value: row.quantity_on_hand },
          { label: "Product ID", value: row.product_id, span: "full" },
        ]}
      />
    );
  }, []);

  const columns = React.useMemo<ColumnDef<ProductStockRow, unknown>[]>(
    () => [
      { accessorKey: "product_code", header: "Mã SP", meta: { filterKey: "product_code", filterType: "text" } },
      { accessorKey: "product_name", header: "Tên SP" },
      { accessorKey: "unit", header: "ĐVT" },
      { accessorKey: "quantity_on_hand", header: "Tồn" },
      {
        id: "ycxk",
        header: "YCXK",
        enableHiding: false,
        meta: { filterType: "none" },
        cell: ({ row }) => (
          <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => openRequestFromRow(row.original)}>
            Yêu cầu xuất
          </Button>
        ),
      },
    ],
    [openRequestFromRow],
  );

  return (
    <>
      <ExcelDataGrid<ProductStockRow>
        moduleId="v_product_stock"
        title="Tồn kho (Nhập − Xuất)"
        columns={columns}
        list={listProductStock}
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
            <DialogTitle>Yêu cầu xuất kho</DialogTitle>
            <DialogDescription>
              Phiếu xuất được tạo ở trạng thái nháp; tồn kho chỉ thay đổi sau khi ghi nhận trên trang chi tiết phiếu.
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
