"use client";

import * as React from "react";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import {
  listPartnerPricesByProductId,
  type PartnerPriceRow,
} from "@/lib/actions/partner-prices";
import type { ProductRow } from "@/lib/actions/products";
import { ProductSuppliersPanel } from "@/components/modules/master/product-suppliers-panel";

function formatProductUsageLabel(u: string) {
  if (u === "inventory") return "Kho / NVL";
  if (u === "sales") return "Bán / labo";
  return "Kho + bán";
}

function ProductPricesBlock({ productId }: { productId: string }) {
  const [rows, setRows] = React.useState<PartnerPriceRow[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setErr(null);
    void listPartnerPricesByProductId(productId, 80)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải giá");
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (err) return <p className="text-sm text-[#b91c1c]">{err}</p>;
  if (rows === null) return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải giá theo KH…</p>;
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--on-surface-muted)]">Chưa có dòng giá riêng theo khách.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
            <th className="px-3 py-2">Mã KH</th>
            <th className="px-3 py-2">Tên KH</th>
            <th className="px-3 py-2 text-right">Đơn giá</th>
            <th className="px-3 py-2">Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((pr) => (
            <tr key={pr.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 font-medium">{pr.partner_code ?? "—"}</td>
              <td className="max-w-[14rem] truncate px-3 py-2">{pr.partner_name ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {pr.unit_price.toLocaleString("vi-VN")}
              </td>
              <td className="px-3 py-2 text-xs tabular-nums text-[var(--on-surface-muted)]">
                {pr.updated_at?.slice(0, 10) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductRowDetailPanel({ row }: { row: ProductRow }) {
  const [tab, setTab] = React.useState<"info" | "suppliers" | "prices">("info");

  React.useEffect(() => {
    setTab("info");
  }, [row.id]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DetailTabStrip
        items={[
          { id: "info", label: "Thông tin" },
          { id: "suppliers", label: "NCC & kho" },
          { id: "prices", label: "Giá theo KH" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === "info" ? (
        <DetailPreview
          fields={[
            { label: "Mã SP", value: row.code },
            { label: "Tên", value: row.name },
            { label: "ĐVT", value: row.unit },
            { label: "Phạm vi", value: formatProductUsageLabel(row.product_usage) },
            { label: "Tồn kho (posted)", value: row.quantity_on_hand },
            {
              label: "NCC chính",
              value:
                row.primary_supplier_code != null
                  ? row.primary_supplier_code + " — " + (row.primary_supplier_name ?? "")
                  : "—",
              span: "full",
            },
            { label: "Số NCC đã gắn", value: row.supplier_link_count },
            { label: "Đơn giá niêm yết", value: row.unit_price.toLocaleString("vi-VN") },
            { label: "Bảo hành (năm)", value: row.warranty_years ?? "—" },
            { label: "Hoạt động", value: row.is_active ? "Có" : "Không" },
            { label: "Tạo lúc", value: row.created_at },
            { label: "Cập nhật", value: row.updated_at },
          ]}
        />
      ) : null}
      {tab === "suppliers" ? <ProductSuppliersPanel productId={row.id} /> : null}
      {tab === "prices" ? <ProductPricesBlock productId={row.id} /> : null}
    </div>
  );
}
