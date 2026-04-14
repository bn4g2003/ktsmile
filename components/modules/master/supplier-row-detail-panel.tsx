"use client";

import Link from "next/link";
import * as React from "react";
import { DetailPreview } from "@/components/ui/detail-preview";
import { DetailTabStrip } from "@/components/ui/detail-tab-strip";
import { listSupplierPurchasableProducts, type SupplierPurchasableProduct } from "@/lib/actions/product-suppliers";
import { getSupplierPayableSnapshot, type SupplierPayableSnapshot } from "@/lib/actions/payables";
import { listInboundDocumentsBySupplier, type StockDocumentRow } from "@/lib/actions/stock";
import type { SupplierRow } from "@/lib/actions/suppliers";

function SupplierInboundOrdersBlock({ supplierId }: { supplierId: string }) {
  const [rows, setRows] = React.useState<StockDocumentRow[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setErr(null);
    void listInboundDocumentsBySupplier(supplierId, 40)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải phiếu nhập");
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (err) return <p className="text-sm text-[#b91c1c]">{err}</p>;
  if (rows === null) return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải phiếu nhập…</p>;
  if (rows.length === 0) return <p className="text-sm text-[var(--on-surface-muted)]">Chưa có phiếu nhập.</p>;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
            <th className="px-3 py-2">Số phiếu</th>
            <th className="px-3 py-2">Ngày</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2">Lý do</th>
            <th className="px-3 py-2 text-right">Số dòng</th>
            <th className="px-3 py-2 text-right">Tổng SL</th>
            <th className="px-3 py-2 text-right">Tổng tiền</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 font-medium">
                <Link
                  href={"/inventory/documents/" + d.id}
                  className="text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  {d.document_number}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums text-[var(--on-surface-muted)]">{d.document_date}</td>
              <td className="px-3 py-2">{d.posting_status === "posted" ? "Đã ghi nhận" : "Nháp"}</td>
              <td className="max-w-[16rem] truncate px-3 py-2">{d.reason ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{d.line_count}</td>
              <td className="px-3 py-2 text-right tabular-nums">{d.total_quantity.toLocaleString("vi-VN")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{d.total_amount.toLocaleString("vi-VN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierFinanceBlock({ supplierId }: { supplierId: string }) {
  const [snap, setSnap] = React.useState<SupplierPayableSnapshot | null | "empty">(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setSnap(null);
    setErr(null);
    void getSupplierPayableSnapshot(supplierId)
      .then((r) => {
        if (!cancelled) setSnap(r ?? "empty");
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải công nợ");
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (err) return <p className="text-sm text-[#b91c1c]">{err}</p>;
  if (snap === null) return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải…</p>;
  if (snap === "empty") return <p className="text-sm text-[var(--on-surface-muted)]">Không lấy được số liệu công nợ.</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--on-surface-muted)]">
        Tháng {snap.month}/{snap.year} (logic cùng trang Công nợ NCC).
      </p>
      <DetailPreview
        fields={[
          { label: "Nợ đầu kỳ", value: snap.opening.toLocaleString("vi-VN") },
          { label: "PS nhập trong tháng", value: snap.inbound_month.toLocaleString("vi-VN") },
          { label: "Đã trả trong tháng", value: snap.payments_month.toLocaleString("vi-VN") },
          { label: "Nợ cuối kỳ", value: snap.closing.toLocaleString("vi-VN") },
        ]}
      />
    </div>
  );
}

function SupplierMaterialsBlock({ supplierId }: { supplierId: string }) {
  const [rows, setRows] = React.useState<SupplierPurchasableProduct[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setErr(null);
    void listSupplierPurchasableProducts(supplierId)
      .then((r) => {
        if (!cancelled) setRows(r.filter((x) => x.product_usage === "inventory"));
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Lỗi tải NVL");
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (err) return <p className="text-sm text-[#b91c1c]">{err}</p>;
  if (rows === null) return <p className="text-sm text-[var(--on-surface-muted)]">Đang tải NVL cung cấp…</p>;
  if (rows.length === 0) return <p className="text-sm text-[var(--on-surface-muted)]">NCC này chưa gắn NVL nào.</p>;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] shadow-[inset_0_0_0_1px_var(--border-ghost)]">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border-ghost)] bg-[var(--surface-muted)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-faint)]">
            <th className="px-3 py-2">Mã NVL</th>
            <th className="px-3 py-2">Tên NVL</th>
            <th className="px-3 py-2">ĐVT</th>
            <th className="px-3 py-2">Mã NCC</th>
            <th className="px-3 py-2 text-right">Giá tham chiếu</th>
            <th className="px-3 py-2">Chính</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.product_id} className="border-b border-[var(--border-ghost)] last:border-b-0">
              <td className="px-3 py-2 font-medium">{r.product_code}</td>
              <td className="max-w-[16rem] truncate px-3 py-2">{r.product_name}</td>
              <td className="px-3 py-2">{r.unit}</td>
              <td className="px-3 py-2">{r.supplier_sku ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.reference_purchase_price != null ? r.reference_purchase_price.toLocaleString("vi-VN") : "—"}
              </td>
              <td className="px-3 py-2">{r.is_primary ? "Có" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SupplierRowDetailPanel({ row }: { row: SupplierRow }) {
  const [tab, setTab] = React.useState<"info" | "orders" | "finance" | "materials">("info");

  React.useEffect(() => {
    setTab("info");
  }, [row.id]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DetailTabStrip
        items={[
          { id: "info", label: "Thông tin" },
          { id: "orders", label: "Đơn nhập" },
          { id: "finance", label: "Công nợ & PS" },
          { id: "materials", label: "NVL cung cấp" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === "info" ? (
        <DetailPreview
          fields={[
            { label: "Mã NCC", value: row.code },
            { label: "Tên", value: row.name },
            { label: "Đại diện", value: row.representative_name },
            { label: "SĐT", value: row.phone },
            { label: "MST", value: row.tax_id },
            { label: "Hoạt động", value: row.is_active ? "Có" : "Không" },
            { label: "Địa chỉ", value: row.address, span: "full" },
            { label: "Ghi chú", value: row.notes, span: "full" },
            { label: "Tạo lúc", value: row.created_at },
            { label: "Cập nhật", value: row.updated_at },
          ]}
        />
      ) : null}
      {tab === "orders" ? <SupplierInboundOrdersBlock supplierId={row.id} /> : null}
      {tab === "finance" ? <SupplierFinanceBlock supplierId={row.id} /> : null}
      {tab === "materials" ? <SupplierMaterialsBlock supplierId={row.id} /> : null}
    </div>
  );
}
