"use client";

import * as React from "react";
import {
  deleteProductSupplierLink,
  listProductSupplierLinks,
  setPrimaryProductSupplier,
  upsertProductSupplierLink,
  type ProductSupplierLinkRow,
} from "@/lib/actions/product-suppliers";
import { listSupplierPicker } from "@/lib/actions/suppliers";
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

export function ProductSuppliersPanel({ productId }: { productId: string }) {
  const [rows, setRows] = React.useState<ProductSupplierLinkRow[] | null>(null);
  const [suppliers, setSuppliers] = React.useState<{ id: string; code: string; name: string }[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState("");
  const [supplierSku, setSupplierSku] = React.useState("");
  const [refPrice, setRefPrice] = React.useState("");
  const [leadDays, setLeadDays] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [makePrimary, setMakePrimary] = React.useState(false);

  const reload = React.useCallback(() => {
    setErr(null);
    void listProductSupplierLinks(productId)
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Lỗi tải"));
  }, [productId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    void listSupplierPicker()
      .then(setSuppliers)
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setSupplierId(suppliers[0]?.id ?? "");
    setSupplierSku("");
    setRefPrice("");
    setLeadDays("");
    setNotes("");
    setMakePrimary(false);
    setOpen(true);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return;
    setPending(true);
    setErr(null);
    try {
      await upsertProductSupplierLink({
        product_id: productId,
        supplier_id: supplierId,
        supplier_sku: supplierSku.trim() || null,
        reference_purchase_price: refPrice.trim() === "" ? null : Number(refPrice),
        lead_time_days: leadDays.trim() === "" ? null : Number(leadDays),
        notes: notes.trim() || null,
        is_primary: makePrimary,
      });
      setOpen(false);
      reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lỗi lưu");
    } finally {
      setPending(false);
    }
  };

  const onSetPrimary = async (supplier_id: string) => {
    if (!confirm("Đặt NCC này làm NCC chính cho mua hàng / phiếu nhập?")) return;
    setPending(true);
    try {
      await setPrimaryProductSupplier(productId, supplier_id);
      reload();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Xóa liên kết NCC này?")) return;
    setPending(true);
    try {
      await deleteProductSupplierLink(id);
      reload();
    } catch (e2) {
      alert(e2 instanceof Error ? e2.message : "Lỗi");
    } finally {
      setPending(false);
    }
  };

  if (rows === null) {
    return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải NCC…</p>;
  }

  return (
    <div className="space-y-3">
      {err ? <p className="text-sm text-[#b91c1c]">{err}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" size="sm" onClick={openAdd} disabled={pending}>
          Thêm NCC
        </Button>
        <p className="text-xs text-[var(--on-surface-muted)]">
          NCC chính được gợi ý khi lập phiếu nhập; giá tham chiếu tự điền nếu trùng NCC trên phiếu.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-muted)]">Chưa gắn NCC — thêm ít nhất một NCC cung ứng.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
                <th className="px-3 py-2">NCC</th>
                <th className="px-3 py-2">Mã hàng NCC</th>
                <th className="px-3 py-2 text-right">Giá mua TC</th>
                <th className="px-3 py-2 text-right">Lead (ngày)</th>
                <th className="px-3 py-2">Chính</th>
                <th className="px-3 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.supplier_code ?? "—"}</span>
                    <span className="ml-1 text-[var(--on-surface-muted)]">{r.supplier_name ?? ""}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.supplier_sku ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.reference_purchase_price != null
                      ? r.reference_purchase_price.toLocaleString("vi-VN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.lead_time_days ?? "—"}</td>
                  <td className="px-3 py-2">{r.is_primary ? "Có" : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {!r.is_primary ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="min-h-8"
                          disabled={pending}
                          onClick={() => void onSetPrimary(r.supplier_id)}
                        >
                          Chọn chính
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-8 text-[#b91c1c]"
                        disabled={pending}
                        onClick={() => void onDelete(r.id)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Thêm / cập nhật NCC cho vật tư</DialogTitle>
            <DialogDescription>
              Cùng cặp (sản phẩm, NCC) chỉ một dòng — lưu sẽ ghi đè mã hàng NCC và giá tham chiếu.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitAdd(e)} className="grid gap-4 sm:grid-cols-2">
            {err ? <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ps-sup">Nhà cung cấp</Label>
              <Select
                id="ps-sup"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">Chọn…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ps-sku">Mã hàng NCC</Label>
              <Input id="ps-sku" value={supplierSku} onChange={(e) => setSupplierSku(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ps-price">Giá mua tham chiếu</Label>
              <Input
                id="ps-price"
                type="number"
                min={0}
                step={0.01}
                value={refPrice}
                onChange={(e) => setRefPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ps-lead">Lead time (ngày)</Label>
              <Input
                id="ps-lead"
                type="number"
                min={0}
                step={1}
                value={leadDays}
                onChange={(e) => setLeadDays(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ps-notes">Ghi chú</Label>
              <Input id="ps-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                id="ps-primary"
                className="h-5 w-5 rounded-[var(--radius-sm)] border border-[var(--border-ghost)]"
                checked={makePrimary}
                onChange={(e) => setMakePrimary(e.target.checked)}
              />
              <Label htmlFor="ps-primary" className="normal-case tracking-normal">
                Đặt làm NCC chính
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
    </div>
  );
}
