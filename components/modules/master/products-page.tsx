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
import { ProductRowDetailPanel } from "@/components/modules/master/product-row-detail-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importProductsFromExcel } from "@/lib/actions/products-import";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type ProductRow,
  type ProductUsage,
} from "@/lib/actions/products";

function formatProductUsage(u: ProductUsage) {
  if (u === "inventory") return "Kho / NVL";
  if (u === "sales") return "Bán / labo";
  return "Kho + bán";
}

export function ProductsPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("0");
  const [warranty, setWarranty] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [productUsage, setProductUsage] = React.useState<ProductUsage>("both");
  const fileImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);

  const reset = () => {
    setEditing(null);
    setCode("");
    setName("");
    setUnit("");
    setUnitPrice("0");
    setWarranty("");
    setIsActive(true);
    setProductUsage("both");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: ProductRow) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setUnit(row.unit);
    setUnitPrice(String(row.unit_price));
    setWarranty(row.warranty_years != null ? String(row.warranty_years) : "");
    setIsActive(row.is_active);
    setProductUsage(row.product_usage ?? "both");
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        unit: unit.trim(),
        unit_price: Number(unitPrice),
        warranty_years: warranty.trim() === "" ? null : Number(warranty),
        is_active: isActive,
        product_usage: productUsage,
      };
      if (editing) await updateProduct(editing.id, payload);
      else await createProduct(payload);
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
      const res = await importProductsFromExcel(fd);
      if (res.ok) {
        const warn = res.errors?.length
          ? "\n\nCảnh báo:\n" + res.errors.slice(0, 40).join("\n") + (res.errors.length > 40 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập xong.") + warn);
        bumpGrid();
      } else {
        const detail = res.errors?.length
          ? "\n\n" + res.errors.slice(0, 40).join("\n") + (res.errors.length > 40 ? "\n…" : "")
          : "";
        alert((res.message ?? "Nhập thất bại.") + detail);
      }
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi nhập file");
    } finally {
      setImportBusy(false);
    }
  };

  const onDelete = async (row: ProductRow) => {
    if (!confirm("Xóa SP " + row.code + "?")) return;
    try {
      await deleteProduct(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được");
    }
  };

  const columns = React.useMemo<ColumnDef<ProductRow, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Mã SP", meta: { filterKey: "code", filterType: "text" } },
      { accessorKey: "name", header: "Tên", meta: { filterKey: "name", filterType: "text" } },
      { accessorKey: "unit", header: "ĐVT" },
      { accessorKey: "unit_price", header: "Đơn giá" },
      {
        accessorKey: "product_usage",
        header: "Phạm vi",
        meta: {
          filterKey: "product_usage",
          filterType: "select",
          filterOptions: [
            { value: "both", label: "Kho + bán" },
            { value: "inventory", label: "Kho / NVL" },
            { value: "sales", label: "Bán / labo" },
          ],
        },
        cell: ({ getValue }) => formatProductUsage(getValue() as ProductUsage),
      },
      {
        accessorKey: "quantity_on_hand",
        header: "Tồn kho",
        cell: ({ getValue }) => String(getValue()),
      },
      {
        id: "primary_supplier_code",
        accessorFn: (r) => r.primary_supplier_code ?? "",
        header: "NCC chính",
        cell: ({ row }) => {
          const c = row.original.primary_supplier_code;
          const n = row.original.primary_supplier_name;
          if (!c && !n) return "—";
          return (c ?? "") + (n ? " — " + n : "");
        },
      },
      { accessorKey: "supplier_link_count", header: "Số NCC" },
      { accessorKey: "warranty_years", header: "BH (năm)" },
      {
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

  return (
    <>
      <ExcelDataGrid<ProductRow>
        moduleId="products"
        title="Sản phẩm & nguyên vật liệu (kho + NCC)"
        columns={columns}
        list={listProducts}
        reloadSignal={gridReload}
        renderRowDetail={(row) => <ProductRowDetailPanel row={row} />}
        rowDetailTitle={(r) => "Sản phẩm " + r.code}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileImportRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(ev) => void onExcelSelected(ev)}
            />
            <Button
              variant="secondary"
              type="button"
              size="sm"
              disabled={importBusy}
              onClick={onPickExcel}
            >
              {importBusy ? "Đang nhập…" : "Nhập Excel (bảng giá)"}
            </Button>
            <Button variant="primary" type="button" size="sm" onClick={openCreate}>
              Thêm SP
            </Button>
          </div>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle>
            <DialogDescription>
              Phạm vi &quot;Kho / NVL&quot; dùng cho phiếu kho; gắn NCC ở tab Xem → NCC &amp; kho. Import Excel
              giữ mặc định kho + bán.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="pr-code">Mã</Label>
              <Input id="pr-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pr-name">Tên</Label>
              <Input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pr-unit">ĐVT</Label>
              <Input id="pr-unit" value={unit} onChange={(e) => setUnit(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pr-price">Đơn giá</Label>
              <Input
                id="pr-price"
                type="number"
                min={0}
                step={0.01}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="pr-usage">Phạm vi sử dụng</Label>
              <select
                id="pr-usage"
                className="min-h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-ghost)] bg-[var(--surface-card)] px-3 text-sm"
                value={productUsage}
                onChange={(e) => setProductUsage(e.target.value as ProductUsage)}
              >
                <option value="both">Kho + bán (mặc định)</option>
                <option value="inventory">Chủ yếu kho / nguyên vật liệu</option>
                <option value="sales">Chủ yếu bán / labo</option>
              </select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="pr-war">Bảo hành (năm)</Label>
              <Input
                id="pr-war"
                type="number"
                min={0}
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                id="pr-act"
                className="h-5 w-5 rounded-[var(--radius-sm)] border border-[var(--border-ghost)]"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Label htmlFor="pr-act" className="normal-case tracking-normal">
                Đang hoạt động
              </Label>
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
