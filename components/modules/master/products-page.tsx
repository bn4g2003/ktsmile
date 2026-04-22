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
import { MaterialRowDetailPanel } from "@/components/modules/master/material-row-detail-panel";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importProductsFromExcel } from "@/lib/actions/products-import";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type ProductRow,
} from "@/lib/actions/products";
import {
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
  type MaterialRow,
} from "@/lib/actions/materials";

type CatalogTab = "sales" | "inventory";

export function ProductsPage({ initialCatalogTab = "sales" }: { initialCatalogTab?: CatalogTab }) {
  const router = useRouter();
  const [catalogTab, setCatalogTab] = React.useState<CatalogTab>(initialCatalogTab);
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editingSales, setEditingSales] = React.useState<ProductRow | null>(null);
  const [editingNvl, setEditingNvl] = React.useState<MaterialRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("0");
  const [warranty, setWarranty] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const fileImportRef = React.useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = React.useState(false);

  React.useEffect(() => {
    setCatalogTab(initialCatalogTab);
  }, [initialCatalogTab]);

  const setCatalogTabAndUrl = React.useCallback(
    (t: CatalogTab) => {
      setCatalogTab(t);
      const path = t === "inventory" ? "/master/products?tab=inventory" : "/master/products";
      router.replace(path, { scroll: false });
    },
    [router],
  );

  const reset = () => {
    setEditingSales(null);
    setEditingNvl(null);
    setCode("");
    setName("");
    setUnit("");
    setUnitPrice("0");
    setWarranty("");
    setIsActive(true);
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEditSales = (row: ProductRow) => {
    setEditingSales(row);
    setEditingNvl(null);
    setCode(row.code);
    setName(row.name);
    setUnit(row.unit);
    setUnitPrice(String(row.unit_price));
    setWarranty(row.warranty_years != null ? String(row.warranty_years) : "");
    setIsActive(row.is_active);
    setErr(null);
    setOpen(true);
  };

  const openEditNvl = (row: MaterialRow) => {
    setEditingNvl(row);
    setEditingSales(null);
    setCode(row.code);
    setName(row.name);
    setUnit(row.unit);
    setUnitPrice("0");
    setWarranty("");
    setIsActive(row.is_active);
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      if (catalogTab === "sales") {
        const payload = {
          code: code.trim(),
          name: name.trim(),
          unit: unit.trim(),
          unit_price: Number(unitPrice),
          warranty_years: warranty.trim() === "" ? null : Number(warranty),
          is_active: isActive,
          product_usage: "sales" as const,
        };
        if (editingSales) await updateProduct(editingSales.id, payload);
        else await createProduct(payload);
      } else {
        const payload = {
          code: code.trim(),
          name: name.trim(),
          unit: unit.trim(),
          is_active: isActive,
        };
        if (editingNvl) await updateMaterial(editingNvl.id, payload);
        else await createMaterial(payload);
      }
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

  const onDeleteNvl = async (row: MaterialRow) => {
    if (!confirm("Xóa NVL " + row.code + "?")) return;
    try {
      await deleteMaterial(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được");
    }
  };

  const salesColumns = React.useMemo<ColumnDef<ProductRow, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Mã SP", meta: { filterKey: "code", filterType: "text" } },
      { accessorKey: "name", header: "Tên", meta: { filterKey: "name", filterType: "text" } },
      { accessorKey: "unit", header: "ĐVT" },
      { accessorKey: "unit_price", header: "Đơn giá", cell: ({ getValue }) => Number(getValue()).toLocaleString("vi-VN") },
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
            <DataGridMenuEditItem onSelect={() => openEditSales(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDelete(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [openEditSales],
  );

  const nvlColumns = React.useMemo<ColumnDef<MaterialRow, unknown>[]>(
    () => [
      { accessorKey: "code", header: "Mã NVL", meta: { filterKey: "code", filterType: "text" } },
      { accessorKey: "name", header: "Tên NVL", meta: { filterKey: "name", filterType: "text" } },
      { accessorKey: "unit", header: "ĐVT" },
      { accessorKey: "quantity_on_hand", header: "Tồn kho" },
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
            <DataGridMenuEditItem onSelect={() => openEditNvl(row.original)}>Sửa</DataGridMenuEditItem>
            <DataGridMenuDeleteItem onSelect={() => void onDeleteNvl(row.original)}>Xóa</DataGridMenuDeleteItem>
          </>
        ),
      },
    ],
    [openEditNvl],
  );

  const gridTitle = catalogTab === "sales" ? "Sản phẩm (bán / labo)" : "Nguyên vật liệu (kho + NCC)";

  return (
    <>
      <div className="mb-4">
        <DetailTabStrip
          items={[
            { id: "sales", label: "Sản phẩm (bán / labo)" },
            { id: "inventory", label: "Nguyên vật liệu (kho)" },
          ]}
          value={catalogTab}
          onChange={(id) => setCatalogTabAndUrl(id as CatalogTab)}
        />
      </div>
      {catalogTab === "sales" ? (
        <ExcelDataGrid<ProductRow>
          moduleId="products_sales"
          title={gridTitle}
          columns={salesColumns}
          list={listProducts}
          prependFilters={{ catalog_segment: "sales" }}
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
                Thêm sản phẩm
              </Button>
            </div>
          }
          getRowId={(r) => r.id}
        />
      ) : (
        <ExcelDataGrid<MaterialRow>
          moduleId="materials_inventory"
          title={gridTitle}
          columns={nvlColumns}
          list={listMaterials}
          reloadSignal={gridReload}
          renderRowDetail={(row) => <MaterialRowDetailPanel row={row} />}
          rowDetailTitle={(r) => "NVL " + r.code}
          toolbarExtra={
            <Button variant="primary" type="button" size="sm" onClick={openCreate}>
              Thêm NVL
            </Button>
          }
          getRowId={(r) => r.id}
        />
      )}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {catalogTab === "sales"
                ? (editingSales ? "Sửa sản phẩm" : "Thêm sản phẩm")
                : (editingNvl ? "Sửa nguyên vật liệu" : "Thêm nguyên vật liệu")}
            </DialogTitle>
            <DialogDescription>
              {catalogTab === "sales"
                ? "Danh mục sản phẩm bán/labo. Kho NVL quản lý ở tab Nguyên vật liệu."
                : "Danh mục NVL tách riêng; gán NCC tại tab Xem → NCC & kho."}
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
                required={catalogTab === "sales"}
                disabled={catalogTab !== "sales"}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="pr-war">Bảo hành (năm)</Label>
              <Input
                id="pr-war"
                type="number"
                min={0}
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                disabled={catalogTab !== "sales"}
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
