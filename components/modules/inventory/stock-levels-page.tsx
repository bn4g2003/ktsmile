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
import { formatDate } from "@/lib/format/date";
import { listProductPicker } from "@/lib/actions/products";
import { listMaterialPicker } from "@/lib/actions/materials";
import {
  adjustOpeningQuantityForProduct,
  createOutboundStockRequest,
  deleteLatestSingleLineDraftOutboundByProduct,
  getLatestSingleLineDraftOutboundByProduct,
  listProductStock,
  type ProductStockRow,
} from "@/lib/actions/stock";

type StockTab = "nvl" | "sp";

/** Kỳ mặc định: cả tháng hiện tại (để lưới có Tồn đầu / Nhập–Xuất kỳ / Trị giá xuất). */
function monthRangeDefaults(): { date_from: string; date_to: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date_from = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const date_to = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { date_from, date_to };
}

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
  const [filters, setFilters] = React.useState<Record<string, string>>(() => monthRangeDefaults());
  const [reqPending, setReqPending] = React.useState(false);
  const [openOpeningEdit, setOpenOpeningEdit] = React.useState(false);
  const [openingRow, setOpeningRow] = React.useState<ProductStockRow | null>(null);
  const [openingQty, setOpeningQty] = React.useState("");
  const [openingNote, setOpeningNote] = React.useState("");
  const [openingPending, setOpeningPending] = React.useState(false);
  const [openingErr, setOpeningErr] = React.useState<string | null>(null);

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

  const editDraftRequestFromRow = React.useCallback(
    async (row: ProductStockRow) => {
      try {
        const doc = await getLatestSingleLineDraftOutboundByProduct(row.product_id);
        if (!doc) {
          alert("Chưa có phiếu xuất nháp 1 dòng cho " + row.product_code + ". Hãy tạo YCXK trước.");
          return;
        }
        router.push("/inventory/documents/" + doc.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Không mở được phiếu nháp.");
      }
    },
    [router],
  );

  const deleteDraftRequestFromRow = React.useCallback(
    async (row: ProductStockRow) => {
      if (!confirm("Xóa phiếu xuất nháp gần nhất của " + row.product_code + "?")) return;
      try {
        const res = await deleteLatestSingleLineDraftOutboundByProduct(row.product_id);
        if (!res.deleted) {
          alert("Không tìm thấy phiếu nháp 1 dòng để xóa cho " + row.product_code + ".");
          return;
        }
        bumpGrid();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Không xóa được phiếu nháp.");
      }
    },
    [bumpGrid],
  );

  const openOpeningEditor = React.useCallback(
    (row: ProductStockRow) => {
      const dateFrom = filters["date_from"]?.trim();
      if (!dateFrom) {
        alert("Chọn 'Từ ngày' trong Kỳ báo cáo trước khi sửa tồn đầu.");
        return;
      }
      setOpeningRow(row);
      setOpeningQty(String(row.opening_quantity ?? 0));
      setOpeningNote("");
      setOpeningErr(null);
      setOpenOpeningEdit(true);
    },
    [filters],
  );

  const submitOpeningEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingRow) return;
    const dateFrom = filters["date_from"]?.trim();
    if (!dateFrom) {
      setOpeningErr("Thiếu Từ ngày của kỳ báo cáo.");
      return;
    }
    const desired = Number(openingQty);
    if (!Number.isFinite(desired)) {
      setOpeningErr("Tồn đầu mới không hợp lệ.");
      return;
    }
    setOpeningPending(true);
    setOpeningErr(null);
    try {
      await adjustOpeningQuantityForProduct({
        product_id: openingRow.product_id,
        date_from: dateFrom,
        desired_opening_quantity: desired,
        note: openingNote.trim() || null,
      });
      setOpenOpeningEdit(false);
      bumpGrid();
    } catch (e2) {
      setOpeningErr(e2 instanceof Error ? e2.message : "Không điều chỉnh được tồn đầu.");
    } finally {
      setOpeningPending(false);
    }
  };

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
          const v = String(getValue() ?? "");
          if (v === "inventory") return "Kho / NVL";
          if (v === "sales") return "Bán / labo";
          return "Kho + bán";
        },
      },
      {
        accessorKey: "opening_quantity",
        header: "Tồn đầu",
        cell: ({ getValue }) => {
          const v = getValue();
          return v != null ? (
            <span className="font-medium text-[var(--on-surface-muted)]">{Number(v).toLocaleString()}</span>
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "inbound_quantity",
        header: "Nhập kỳ",
        cell: ({ getValue }) => {
          const v = getValue();
          return v != null ? (
            <span className="font-semibold text-emerald-600">+{Number(v).toLocaleString()}</span>
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "outbound_quantity",
        header: "Xuất kỳ",
        cell: ({ getValue }) => {
          const v = getValue();
          return v != null ? (
            <span className="font-semibold text-rose-600">-{Number(v).toLocaleString()}</span>
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "closing_quantity",
        header: "Tồn cuối",
        cell: ({ getValue }) => {
          const v = getValue();
          return v != null ? (
            <span className="font-bold text-[var(--primary)]">{Number(v).toLocaleString()}</span>
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "outbound_amount",
        header: "Trị giá xuất",
        cell: ({ getValue }) => {
          const v = getValue();
          return v != null ? (
            <div className="text-right font-medium text-rose-700 tabular-nums">
              {Number(v).toLocaleString("vi-VN")}
            </div>
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "quantity_on_hand",
        header: "Tồn hiện tại",
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--on-surface-muted)]">{Number(getValue() ?? 0).toLocaleString()}</span>
        ),
      },
      { accessorKey: "primary_supplier_code", header: "NCC chính", cell: ({ row }) => row.original.primary_supplier_code ? row.original.primary_supplier_code + (row.original.primary_supplier_name ? " — " + row.original.primary_supplier_name : "") : "—" },
      { accessorKey: "supplier_link_count", header: "Số NCC" },
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
    ],
    [],
  );

  const actionColumns = React.useMemo<ColumnDef<ProductStockRow, unknown>[]>(
    () => [
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
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <>
            <DataGridMenuEditItem onSelect={() => void editDraftRequestFromRow(row.original)}>
              Sửa phiếu nháp
            </DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void deleteDraftRequestFromRow(row.original)}>
              Xóa phiếu nháp
            </DataGridMenuDeleteItem>
            <DataGridMenuEditItem onSelect={() => openOpeningEditor(row.original)}>
              Edit tồn đầu
            </DataGridMenuEditItem>
          </>
        ),
      },
    ],
    [deleteDraftRequestFromRow, editDraftRequestFromRow, openOpeningEditor, openRequestFromRow],
  );

  const columns = React.useMemo<ColumnDef<ProductStockRow, unknown>[]>(
    () => [...baseColumns, ...actionColumns],
    [actionColumns, baseColumns],
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
        filters={filters}
        onFiltersChange={setFilters}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-2 py-1 shadow-[inset_0_0_0_1px_var(--border-ghost)]">
              <span className="text-[10px] font-bold uppercase text-[var(--on-surface-muted)]">
                Kỳ báo cáo:
              </span>
              <Input
                type="date"
                className="h-7 w-32 border-none bg-transparent p-0 text-xs focus-visible:ring-0"
                value={filters["date_from"] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((prev) => {
                    if (!v) {
                      const { date_from: _, ...rest } = prev;
                      return rest;
                    }
                    return { ...prev, date_from: v };
                  });
                }}
              />
              <span className="text-[10px] text-[var(--on-surface-muted)]">—</span>
              <Input
                type="date"
                className="h-7 w-32 border-none bg-transparent p-0 text-xs focus-visible:ring-0"
                value={filters["date_to"] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((prev) => {
                    if (!v) {
                      const { date_to: _, ...rest } = prev;
                      return rest;
                    }
                    return { ...prev, date_to: v };
                  });
                }}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setFilters(monthRangeDefaults())}
            >
              Tháng này
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={openRequestFromToolbar}
            >
              Yêu cầu xuất kho…
            </Button>
          </div>
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
      <Dialog open={openOpeningEdit} onOpenChange={setOpenOpeningEdit}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit tồn đầu</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ tạo phiếu điều chỉnh kho tại ngày trước kỳ báo cáo để cập nhật tồn đầu.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitOpeningEdit(e)} className="grid gap-4">
            {openingErr ? <p className="text-sm text-[#b91c1c]">{openingErr}</p> : null}
            <div className="grid gap-2">
              <Label>Sản phẩm</Label>
              <Input value={openingRow ? `${openingRow.product_code} — ${openingRow.product_name}` : ""} readOnly />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Từ ngày kỳ báo cáo</Label>
                <Input value={filters["date_from"] ?? ""} readOnly />
              </div>
              <div className="grid gap-2">
                <Label>Tồn đầu mới</Label>
                <Input
                  type="number"
                  step={0.0001}
                  value={openingQty}
                  onChange={(e) => setOpeningQty(e.target.value)}
                  onFocus={(e) => {
                    if ((e.target.value ?? "").trim() === "0") setOpeningQty("");
                  }}
                  onBlur={(e) => {
                    if ((e.target.value ?? "").trim() === "") setOpeningQty("0");
                  }}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stk-opening-note">Ghi chú điều chỉnh</Label>
              <Input
                id="stk-opening-note"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Tuỳ chọn"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpenOpeningEdit(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" disabled={openingPending}>
                {openingPending ? "Đang lưu…" : "Lưu tồn đầu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
