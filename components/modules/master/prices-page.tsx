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
import { DetailPreview } from "@/components/ui/detail-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { listPartnerPicker } from "@/lib/actions/partners";
import { listProductPicker } from "@/lib/actions/products";
import {
  createPartnerPrice,
  deletePartnerPrice,
  listPartnerPrices,
  updatePartnerPrice,
  type PartnerPriceRow,
} from "@/lib/actions/partner-prices";

export function PricesPage() {
  const router = useRouter();
  const [gridReload, setGridReload] = React.useState(0);
  const bumpGrid = React.useCallback(() => {
    setGridReload((n) => n + 1);
    router.refresh();
  }, [router]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PartnerPriceRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [partners, setPartners] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [products, setProducts] = React.useState<
    { id: string; code: string; name: string; unit_price: number }[]
  >([]);
  const [partnerId, setPartnerId] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("0");

  React.useEffect(() => {
    void (async () => {
      try {
        const [p, pr] = await Promise.all([listPartnerPicker(), listProductPicker()]);
        setPartners(p);
        setProducts(pr);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const reset = () => {
    setEditing(null);
    setPartnerId(partners[0]?.id ?? "");
    setProductId(products[0]?.id ?? "");
    setUnitPrice("0");
    setErr(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (row: PartnerPriceRow) => {
    setEditing(row);
    setPartnerId(row.partner_id);
    setProductId(row.product_id);
    setUnitPrice(String(row.unit_price));
    setErr(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const payload = {
        partner_id: partnerId,
        product_id: productId,
        unit_price: Number(unitPrice),
      };
      if (editing) await updatePartnerPrice(editing.id, payload);
      else await createPartnerPrice(payload);
      setOpen(false);
      reset();
      bumpGrid();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (row: PartnerPriceRow) => {
    if (!confirm("Xóa dòng giá này?")) return;
    try {
      await deletePartnerPrice(row.id);
      bumpGrid();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Không xóa được");
    }
  };

  const columns = React.useMemo<ColumnDef<PartnerPriceRow, unknown>[]>(
    () => [
      { accessorKey: "partner_code", header: "Mã KH" },
      { accessorKey: "partner_name", header: "Tên KH" },
      { accessorKey: "product_code", header: "Mã SP" },
      { accessorKey: "product_name", header: "Tên SP" },
      { accessorKey: "unit_price", header: "Đơn giá" },
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

  const renderPriceDetail = React.useCallback((row: PartnerPriceRow) => {
    return (
      <DetailPreview
        fields={[
          { label: "Mã KH", value: row.partner_code },
          { label: "Tên KH", value: row.partner_name },
          { label: "Mã SP", value: row.product_code },
          { label: "Tên SP", value: row.product_name },
          { label: "Đơn giá", value: row.unit_price },
          { label: "ID dòng", value: row.id, span: "full" },
          { label: "Tạo lúc", value: row.created_at },
          { label: "Cập nhật", value: row.updated_at },
        ]}
      />
    );
  }, []);

  return (
    <>
      <ExcelDataGrid<PartnerPriceRow>
        moduleId="partner_prices"
        title="Giá theo khách hàng"
        columns={columns}
        list={listPartnerPrices}
        reloadSignal={gridReload}
        renderRowDetail={renderPriceDetail}
        rowDetailTitle={(r) =>
          (r.partner_code ?? "") + " × " + (r.product_code ?? "")
        }
        toolbarExtra={
          <Button variant="primary" type="button" size="sm" onClick={openCreate}>
            Thêm giá
          </Button>
        }
        getRowId={(r) => r.id}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent size="xl" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa giá" : "Thêm giá"}</DialogTitle>
            <DialogDescription>Giá ưu tiên khi lập đơn cho đối tác.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="pp-p">Đối tác</Label>
              <Select
                id="pp-p"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                required
              >
                <option value="">Chọn…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="pp-pr">Sản phẩm</Label>
              <Select
                id="pp-pr"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                <option value="">Chọn…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="pp-up">Đơn giá</Label>
              <Input
                id="pp-up"
                type="number"
                min={0}
                step={0.01}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
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
    </>
  );
}
